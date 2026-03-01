"""
Provably Fair Engine
====================

Cryptographically verifiable random number generation.
Players can verify every outcome is fair and predetermined.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models import ServerSeed, ClientSeed, User


@dataclass
class GameResult:
    """Result of a provably fair calculation"""
    raw_hash: str  # Full HMAC result
    raw_value: int  # Numeric value from hash
    normalized: float  # Value between 0-1
    server_seed_hash: str  # Commitment (shown before bet)
    client_seed: str
    nonce: int
    
    def verify(self, revealed_server_seed: str) -> bool:
        """Verify the result with revealed server seed"""
        # Check server seed matches commitment
        if hashlib.sha256(revealed_server_seed.encode()).hexdigest() != self.server_seed_hash:
            return False
        
        # Regenerate result
        message = f"{self.client_seed}:{self.nonce}"
        expected_hash = hmac.new(
            revealed_server_seed.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return expected_hash == self.raw_hash


class ProvablyFairEngine:
    """
    Provably Fair 2.0 Implementation
    
    Flow:
    1. Server generates seed batch OFFLINE, stores hash commitments
    2. User is shown server_seed_hash BEFORE betting
    3. User provides (or system generates) client_seed
    4. Outcome = HMAC-SHA256(server_seed, client_seed:nonce)
    5. After rotating seed, server reveals old seed for verification
    
    This ensures:
    - Server cannot change outcome after bet (committed to hash)
    - Player can influence outcome (client seed)
    - All results are deterministic and verifiable
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    @staticmethod
    def generate_seed() -> str:
        """Generate a cryptographically secure random seed"""
        return secrets.token_hex(32)
    
    @staticmethod
    def hash_seed(seed: str) -> str:
        """Hash a seed for commitment"""
        return hashlib.sha256(seed.encode()).hexdigest()
    
    async def generate_seed_batch(
        self, 
        user_id: UUID, 
        count: int = 10
    ) -> List[ServerSeed]:
        """
        Pre-generate a batch of server seeds for a user.
        
        In production, this should be done OFFLINE for maximum security.
        """
        seeds = []
        
        for _ in range(count):
            seed = self.generate_seed()
            seed_hash = self.hash_seed(seed)
            
            server_seed = ServerSeed(
                user_id=user_id,
                seed=seed,
                seed_hash=seed_hash,
                is_active=False,
                nonce=0
            )
            self.session.add(server_seed)
            seeds.append(server_seed)
        
        # Activate the first seed
        if seeds:
            seeds[0].is_active = True
        
        await self.session.flush()
        return seeds
    
    async def get_active_server_seed(self, user_id: UUID) -> Optional[ServerSeed]:
        """Get user's current active server seed"""
        result = await self.session.execute(
            select(ServerSeed)
            .where(ServerSeed.user_id == user_id)
            .where(ServerSeed.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def get_or_create_client_seed(self, user_id: UUID) -> ClientSeed:
        """Get or create user's active client seed"""
        result = await self.session.execute(
            select(ClientSeed)
            .where(ClientSeed.user_id == user_id)
            .where(ClientSeed.is_active == True)
        )
        client_seed = result.scalar_one_or_none()
        
        if not client_seed:
            client_seed = ClientSeed(
                user_id=user_id,
                seed=self.generate_seed()[:16],  # Shorter for UX
                is_active=True
            )
            self.session.add(client_seed)
            await self.session.flush()
        
        return client_seed
    
    async def set_client_seed(self, user_id: UUID, seed: str) -> ClientSeed:
        """Set a new client seed (user-provided)"""
        # Deactivate old seed
        await self.session.execute(
            update(ClientSeed)
            .where(ClientSeed.user_id == user_id)
            .where(ClientSeed.is_active == True)
            .values(is_active=False)
        )
        
        # Create new seed
        client_seed = ClientSeed(
            user_id=user_id,
            seed=seed[:64],  # Limit length
            is_active=True
        )
        self.session.add(client_seed)
        await self.session.flush()
        
        return client_seed
    
    async def rotate_server_seed(self, user_id: UUID) -> Tuple[ServerSeed, ServerSeed]:
        """
        Rotate to a new server seed.
        
        Returns (old_seed, new_seed)
        The old seed is now revealed and can be verified.
        """
        # Get current active seed
        old_seed = await self.get_active_server_seed(user_id)
        
        if not old_seed:
            raise ValueError("No active server seed found")
        
        # Deactivate and reveal old seed
        old_seed.is_active = False
        old_seed.revealed_at = datetime.utcnow()
        
        # Find next inactive seed or generate new one
        result = await self.session.execute(
            select(ServerSeed)
            .where(ServerSeed.user_id == user_id)
            .where(ServerSeed.is_active == False)
            .where(ServerSeed.revealed_at == None)
            .order_by(ServerSeed.id.asc())
            .limit(1)
        )
        new_seed = result.scalar_one_or_none()
        
        if not new_seed:
            # Generate new batch
            new_seeds = await self.generate_seed_batch(user_id, count=10)
            new_seed = new_seeds[0]
        
        new_seed.is_active = True
        await self.session.flush()
        
        return old_seed, new_seed
    
    def generate_outcome(
        self,
        server_seed: str,
        client_seed: str,
        nonce: int
    ) -> GameResult:
        """
        Generate a provably fair outcome.
        
        The outcome is deterministic based on:
        - server_seed: Known only to server until revealed
        - client_seed: Provided by player
        - nonce: Increments with each bet
        """
        message = f"{client_seed}:{nonce}"
        
        raw_hash = hmac.new(
            server_seed.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Use first 8 hex chars (32 bits) for primary value
        raw_value = int(raw_hash[:8], 16)
        
        # Normalize to 0-1 range
        normalized = raw_value / 0xFFFFFFFF
        
        return GameResult(
            raw_hash=raw_hash,
            raw_value=raw_value,
            normalized=normalized,
            server_seed_hash=self.hash_seed(server_seed),
            client_seed=client_seed,
            nonce=nonce
        )
    
    async def generate_bet_outcome(
        self,
        user_id: UUID,
        increment_nonce: bool = True
    ) -> Tuple[GameResult, int]:
        """
        Generate outcome for a bet.
        
        Returns (result, server_seed_id)
        """
        server_seed = await self.get_active_server_seed(user_id)
        if not server_seed:
            # Auto-generate seeds for new user
            seeds = await self.generate_seed_batch(user_id)
            server_seed = seeds[0]
        
        client_seed = await self.get_or_create_client_seed(user_id)
        
        current_nonce = server_seed.nonce
        
        result = self.generate_outcome(
            server_seed=server_seed.seed,
            client_seed=client_seed.seed,
            nonce=current_nonce
        )
        
        if increment_nonce:
            server_seed.nonce += 1
            await self.session.flush()
        
        return result, server_seed.id
    
    @staticmethod
    def dice_result(normalized: float, precision: int = 2) -> Decimal:
        """
        Convert normalized value to dice roll (0.00 - 99.99)
        
        Dice game: Player picks over/under target
        """
        return Decimal(str(round(normalized * 100, precision)))
    
    @staticmethod
    def crash_result(normalized: float, house_edge: float = 0.03) -> Decimal:
        """
        Convert normalized value to crash multiplier.
        
        Uses the standard crash formula with house edge.
        Formula: 1 / (1 - normalized * (1 - house_edge))
        
        This gives exponential distribution with expected RTP = 1 - house_edge
        """
        # Avoid division by zero at edge
        if normalized >= (1 - house_edge):
            normalized = 1 - house_edge - 0.0001
        
        multiplier = 1 / (1 - normalized)
        
        # Apply house edge
        multiplier = multiplier * (1 - house_edge)
        
        # Minimum 1.00x
        return Decimal(str(max(1.00, round(multiplier, 2))))
    
    @staticmethod
    def limbo_result(normalized: float, house_edge: float = 0.03) -> Decimal:
        """
        Convert normalized value to limbo multiplier.
        
        Similar to crash but instant result.
        """
        if normalized >= (1 - house_edge):
            normalized = 1 - house_edge - 0.0001
        
        multiplier = 1 / (1 - normalized)
        multiplier = multiplier * (1 - house_edge)
        
        return Decimal(str(max(1.00, round(multiplier, 2))))
    
    @staticmethod
    def plinko_result(
        normalized: float, 
        rows: int = 16, 
        hash_full: str = None
    ) -> List[str]:
        """
        Generate Plinko path (sequence of L/R bounces).
        
        Uses multiple bytes from hash for each row.
        """
        if hash_full is None:
            raise ValueError("Full hash required for Plinko")
        
        path = []
        for i in range(rows):
            # Use different bytes for each row
            byte_value = int(hash_full[i*2:(i+1)*2], 16)
            direction = "R" if byte_value >= 128 else "L"
            path.append(direction)
        
        return path
    
    @staticmethod
    def mines_generate_mines(
        normalized: float,
        hash_full: str,
        grid_size: int = 25,
        mine_count: int = 5
    ) -> List[int]:
        """
        Generate mine positions for Mines game.
        
        Uses Fisher-Yates shuffle seeded by hash.
        """
        # Create position array
        positions = list(range(grid_size))
        
        # Use hash segments to shuffle
        for i in range(grid_size - 1, 0, -1):
            # Get random index from hash
            hash_segment = hash_full[(i % 32) * 2: (i % 32) * 2 + 2]
            j = int(hash_segment, 16) % (i + 1)
            positions[i], positions[j] = positions[j], positions[i]
        
        # First N positions are mines
        return sorted(positions[:mine_count])
    
    @staticmethod
    def wheel_result(normalized: float, segments: int = 50) -> int:
        """
        Generate wheel/roulette segment.
        
        Returns segment index (0 to segments-1)
        """
        return int(normalized * segments) % segments
    
    async def get_verification_data(
        self, 
        user_id: UUID
    ) -> dict:
        """Get data needed for user to verify their bets"""
        server_seed = await self.get_active_server_seed(user_id)
        client_seed = await self.get_or_create_client_seed(user_id)
        
        # Get previous revealed seeds
        result = await self.session.execute(
            select(ServerSeed)
            .where(ServerSeed.user_id == user_id)
            .where(ServerSeed.revealed_at != None)
            .order_by(ServerSeed.revealed_at.desc())
            .limit(10)
        )
        revealed_seeds = result.scalars().all()
        
        return {
            "active_server_seed_hash": server_seed.seed_hash if server_seed else None,
            "current_nonce": server_seed.nonce if server_seed else 0,
            "client_seed": client_seed.seed if client_seed else None,
            "revealed_seeds": [
                {
                    "seed": s.seed,
                    "seed_hash": s.seed_hash,
                    "nonce_count": s.nonce,
                    "revealed_at": s.revealed_at.isoformat()
                }
                for s in revealed_seeds
            ]
        }


def verify_bet(
    server_seed: str,
    server_seed_hash: str,
    client_seed: str,
    nonce: int,
    game_type: str
) -> dict:
    """
    Standalone verification function.
    
    Can be used client-side to verify any bet.
    """
    # Verify server seed matches hash
    computed_hash = hashlib.sha256(server_seed.encode()).hexdigest()
    if computed_hash != server_seed_hash:
        return {"valid": False, "error": "Server seed doesn't match hash"}
    
    # Generate result
    message = f"{client_seed}:{nonce}"
    raw_hash = hmac.new(
        server_seed.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    raw_value = int(raw_hash[:8], 16)
    normalized = raw_value / 0xFFFFFFFF
    
    # Calculate game-specific result
    if game_type == "dice":
        result = round(normalized * 100, 2)
    elif game_type == "crash" or game_type == "limbo":
        result = max(1.00, round((1 / (1 - normalized)) * 0.97, 2))
    elif game_type == "wheel":
        result = int(normalized * 50) % 50
    else:
        result = normalized
    
    return {
        "valid": True,
        "raw_hash": raw_hash,
        "raw_value": raw_value,
        "normalized": normalized,
        "result": result
    }

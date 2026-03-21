"""
Proof of Reserves
=================

Generates cryptographic proof that the platform's total on-chain assets
are >= total user liabilities.

Key components:
- Merkle tree of all user balances (users can verify their leaf)
- Aggregated liability totals per currency
- Wallet balance snapshots (hot + warm + cold)
- Reserve ratio computation
- Historical snapshots for audit trail
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any, Tuple
from uuid import uuid4

import redis.asyncio as aioredis
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models import UserBalance, Currency
from casino.services.wallet_manager import MultiTierWalletManager

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Merkle Tree
# ---------------------------------------------------------------------------

def _hash_leaf(user_id: str, currency: str, balance: str) -> str:
    """Hash a single user balance leaf: SHA-256(user_id || currency || balance)."""
    data = f"{user_id}:{currency}:{balance}"
    return hashlib.sha256(data.encode()).hexdigest()


def _hash_pair(left: str, right: str) -> str:
    """Hash two child hashes together for the Merkle tree."""
    combined = left + right if left <= right else right + left
    return hashlib.sha256(combined.encode()).hexdigest()


def build_merkle_tree(leaves: List[str]) -> Tuple[str, List[List[str]]]:
    """
    Build a Merkle tree from a list of leaf hashes.

    Returns ``(root_hash, layers)`` where ``layers[0]`` is the leaf layer.
    """
    if not leaves:
        return hashlib.sha256(b"empty").hexdigest(), [[]]

    layers: List[List[str]] = [leaves[:]]
    current = leaves[:]

    while len(current) > 1:
        next_level: List[str] = []
        for i in range(0, len(current), 2):
            left = current[i]
            right = current[i + 1] if i + 1 < len(current) else left
            next_level.append(_hash_pair(left, right))
        layers.append(next_level)
        current = next_level

    return current[0], layers


def get_merkle_proof(leaf_index: int, layers: List[List[str]]) -> List[Dict[str, str]]:
    """
    Generate a Merkle proof for the leaf at ``leaf_index``.

    Returns a list of ``{"hash": ..., "position": "left"|"right"}`` entries
    that, when combined with the leaf hash, reconstruct the root.
    """
    proof: List[Dict[str, str]] = []
    idx = leaf_index

    for layer in layers[:-1]:  # skip root layer
        if idx % 2 == 0:
            sibling_idx = idx + 1
            position = "right"
        else:
            sibling_idx = idx - 1
            position = "left"

        if sibling_idx < len(layer):
            proof.append({"hash": layer[sibling_idx], "position": position})
        else:
            proof.append({"hash": layer[idx], "position": position})

        idx //= 2

    return proof


def verify_merkle_proof(leaf_hash: str, proof: List[Dict[str, str]], root: str) -> bool:
    """Verify that a leaf hash belongs to the Merkle tree with the given root."""
    current = leaf_hash
    for step in proof:
        if step["position"] == "right":
            current = _hash_pair(current, step["hash"])
        else:
            current = _hash_pair(step["hash"], current)
    return current == root


# ---------------------------------------------------------------------------
# Proof of Reserves Service
# ---------------------------------------------------------------------------

@dataclass
class ReserveSnapshot:
    """A single point-in-time proof of reserves."""
    snapshot_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: str = ""
    # Per-currency data
    currencies: Dict[str, Dict[str, str]] = field(default_factory=dict)
    # Aggregate
    total_assets_usd: str = "0"
    total_liabilities_usd: str = "0"
    reserve_ratio: str = "0"
    solvent: bool = True
    # Merkle root for all user balances
    merkle_root: str = ""
    total_users: int = 0
    total_leaf_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ProofOfReservesService:
    """
    Generates and stores proof-of-reserve snapshots.

    Snapshots are stored in Redis with a configurable retention period.
    """

    SNAPSHOT_RETENTION = 100          # Keep last 100 snapshots
    REDIS_KEY_SNAPSHOTS = "por:snapshots"
    REDIS_KEY_LATEST = "por:latest"

    # Simple USD price map for non-stablecoin aggregation (would use
    # AntiArbitrageEngine.get_market_price in production)
    STABLECOINS = {"USDT", "USDC"}

    def __init__(
        self,
        db: AsyncSession,
        wallet_manager: MultiTierWalletManager,
        redis_client: aioredis.Redis,
    ):
        self.db = db
        self.wallet = wallet_manager
        self.redis = redis_client

    # ------------------------------------------------------------------
    # Liability computation
    # ------------------------------------------------------------------

    async def compute_liabilities(self) -> Dict[str, Decimal]:
        """
        Sum all user balances (available + locked + frozen + bonus)
        grouped by currency.  This is what the platform *owes* users.
        """
        result = await self.db.execute(
            select(
                UserBalance.currency,
                func.sum(UserBalance.available + UserBalance.locked + UserBalance.frozen + UserBalance.bonus_balance),
            ).group_by(UserBalance.currency)
        )
        liabilities: Dict[str, Decimal] = {}
        for row in result.all():
            cur_enum, total = row
            cur_label = cur_enum.value.upper() if hasattr(cur_enum, "value") else str(cur_enum).upper()
            liabilities[cur_label] = total or Decimal("0")
        return liabilities

    # ------------------------------------------------------------------
    # Merkle tree of user balances
    # ------------------------------------------------------------------

    async def build_balance_merkle(self) -> Tuple[str, List[List[str]], int]:
        """
        Build a Merkle tree over all user-balance rows.

        Each leaf = SHA-256(user_id : currency : total_balance).
        Returns ``(root, layers, leaf_count)``.
        """
        result = await self.db.execute(
            select(
                UserBalance.user_id,
                UserBalance.currency,
                (UserBalance.available + UserBalance.locked + UserBalance.frozen + UserBalance.bonus_balance).label("total"),
            ).order_by(UserBalance.user_id, UserBalance.currency)
        )
        rows = result.all()

        leaves: List[str] = []
        for row in rows:
            uid = str(row.user_id)
            cur = row.currency.value if hasattr(row.currency, "value") else str(row.currency)
            bal = str(row.total)
            leaves.append(_hash_leaf(uid, cur, bal))

        root, layers = build_merkle_tree(leaves)
        return root, layers, len(leaves)

    # ------------------------------------------------------------------
    # Snapshot generation
    # ------------------------------------------------------------------

    async def generate_snapshot(self, usd_prices: Optional[Dict[str, Decimal]] = None) -> ReserveSnapshot:
        """
        Generate a full proof-of-reserves snapshot.

        ``usd_prices`` maps currency → USD price for non-stablecoins.
        If omitted, only per-currency data is available (no aggregate USD).
        """
        if usd_prices is None:
            usd_prices = {}

        now = datetime.utcnow().isoformat()

        # 1. Liabilities
        liabilities = await self.compute_liabilities()

        # 2. Wallet assets
        all_balances = await self.wallet.get_all_balances()
        assets: Dict[str, Decimal] = {b.currency: b.total for b in all_balances}

        # 3. Per-currency reserve data
        currencies: Dict[str, Dict[str, str]] = {}
        total_assets_usd = Decimal("0")
        total_liabilities_usd = Decimal("0")
        all_solvent = True

        for cur in self.wallet.CURRENCIES:
            a = assets.get(cur, Decimal("0"))
            l = liabilities.get(cur, Decimal("0"))
            ratio = (a / l) if l > 0 else None
            solvent = ratio >= Decimal("1") if ratio is not None else True

            price = Decimal("1") if cur in self.STABLECOINS else usd_prices.get(cur, Decimal("0"))
            total_assets_usd += a * price
            total_liabilities_usd += l * price

            if not solvent:
                all_solvent = False

            currencies[cur] = {
                "assets": str(a),
                "liabilities": str(l),
                "reserve_ratio": f"{ratio:.6f}" if ratio is not None else "N/A",
                "solvent": str(solvent),
            }

        # 4. Merkle root
        merkle_root, _layers, leaf_count = await self.build_balance_merkle()

        # Count unique users
        user_count_result = await self.db.execute(
            select(func.count(func.distinct(UserBalance.user_id)))
        )
        total_users = user_count_result.scalar() or 0

        overall_ratio = (
            (total_assets_usd / total_liabilities_usd)
            if total_liabilities_usd > 0
            else Decimal("1")
        )

        snapshot = ReserveSnapshot(
            timestamp=now,
            currencies=currencies,
            total_assets_usd=str(total_assets_usd),
            total_liabilities_usd=str(total_liabilities_usd),
            reserve_ratio=f"{overall_ratio:.6f}",
            solvent=all_solvent,
            merkle_root=merkle_root,
            total_users=total_users,
            total_leaf_count=leaf_count,
        )

        # Persist to Redis
        snap_json = json.dumps(snapshot.to_dict())
        pipe = self.redis.pipeline()
        pipe.lpush(self.REDIS_KEY_SNAPSHOTS, snap_json)
        pipe.ltrim(self.REDIS_KEY_SNAPSHOTS, 0, self.SNAPSHOT_RETENTION - 1)
        pipe.set(self.REDIS_KEY_LATEST, snap_json)
        await pipe.execute()

        logger.info(
            f"Proof of Reserves snapshot generated: "
            f"ratio={overall_ratio:.4f} solvent={all_solvent} "
            f"merkle_root={merkle_root[:16]}... users={total_users}"
        )

        return snapshot

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    async def get_latest_snapshot(self) -> Optional[Dict[str, Any]]:
        raw = await self.redis.get(self.REDIS_KEY_LATEST)
        return json.loads(raw) if raw else None

    async def get_snapshot_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        raw_list = await self.redis.lrange(self.REDIS_KEY_SNAPSHOTS, 0, limit - 1)
        return [json.loads(r) for r in raw_list]

    # ------------------------------------------------------------------
    # User-specific proof
    # ------------------------------------------------------------------

    async def get_user_proof(self, user_id: str) -> Dict[str, Any]:
        """
        Generate a Merkle inclusion proof for a specific user so they can
        independently verify their balance is included in the reserve proof.
        """
        result = await self.db.execute(
            select(
                UserBalance.user_id,
                UserBalance.currency,
                (UserBalance.available + UserBalance.locked + UserBalance.frozen + UserBalance.bonus_balance).label("total"),
            ).order_by(UserBalance.user_id, UserBalance.currency)
        )
        rows = result.all()

        leaves: List[str] = []
        user_indices: List[int] = []
        user_balances: List[Dict[str, str]] = []

        for i, row in enumerate(rows):
            uid = str(row.user_id)
            cur = row.currency.value if hasattr(row.currency, "value") else str(row.currency)
            bal = str(row.total)
            leaf = _hash_leaf(uid, cur, bal)
            leaves.append(leaf)

            if uid == user_id:
                user_indices.append(i)
                user_balances.append({"currency": cur, "balance": bal, "leaf_hash": leaf})

        if not user_indices:
            return {"found": False, "message": "No balance records found for user"}

        root, layers = build_merkle_tree(leaves)

        proofs = []
        for idx, bal_info in zip(user_indices, user_balances):
            proof = get_merkle_proof(idx, layers)
            proofs.append({
                **bal_info,
                "leaf_index": idx,
                "proof": proof,
                "verified": verify_merkle_proof(bal_info["leaf_hash"], proof, root),
            })

        return {
            "found": True,
            "merkle_root": root,
            "user_id": user_id,
            "balances": proofs,
        }

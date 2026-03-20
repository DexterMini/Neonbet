"""
Event-Sourced Ledger Service
============================

All balance mutations go through this service.
Provides atomic, auditable, and verifiable transactions.
"""

import hashlib
import json
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID, uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models import (
    User, UserBalance, LedgerEvent, LedgerEventType, Currency
)


class InsufficientBalanceError(Exception):
    """Raised when user doesn't have enough balance"""
    pass


class LedgerIntegrityError(Exception):
    """Raised when ledger checksum validation fails"""
    pass


class BalanceFrozenError(Exception):
    """Raised when trying to use frozen balance"""
    pass


class LedgerService:
    """
    Event-sourced ledger for all balance operations.
    
    Key principles:
    1. All balance changes are immutable events
    2. Current balance is derived from event sum
    3. Each event has a checksum chain for integrity
    4. Supports atomic multi-event transactions
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    def _compute_checksum(
        self,
        user_id: UUID,
        event_type: LedgerEventType,
        currency: Currency,
        amount: Decimal,
        balance_before: Decimal,
        balance_after: Decimal,
        reference_id: Optional[UUID],
        previous_checksum: Optional[str],
        created_at: datetime
    ) -> str:
        """Compute SHA-256 checksum for event integrity"""
        data = {
            "user_id": str(user_id),
            "event_type": event_type.value,
            "currency": currency.value,
            "amount": str(amount),
            "balance_before": str(balance_before),
            "balance_after": str(balance_after),
            "reference_id": str(reference_id) if reference_id else None,
            "previous_checksum": previous_checksum,
            "created_at": created_at.isoformat()
        }
        payload = json.dumps(data, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()
    
    async def get_last_checksum(self, user_id: UUID, currency: Currency) -> Optional[str]:
        """Get the last checksum in the user's ledger chain"""
        result = await self.session.execute(
            select(LedgerEvent.checksum)
            .where(LedgerEvent.user_id == user_id)
            .where(LedgerEvent.currency == currency)
            .order_by(LedgerEvent.id.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return row
    
    async def get_or_create_balance(
        self, 
        user_id: UUID, 
        currency: Currency
    ) -> UserBalance:
        """Get or create user balance record"""
        result = await self.session.execute(
            select(UserBalance)
            .where(UserBalance.user_id == user_id)
            .where(UserBalance.currency == currency)
            .with_for_update()  # Lock for update
        )
        balance = result.scalar_one_or_none()
        
        if not balance:
            balance = UserBalance(
                user_id=user_id,
                currency=currency,
                available=Decimal("0"),
                locked=Decimal("0"),
                frozen=Decimal("0")
            )
            self.session.add(balance)
            await self.session.flush()
        
        return balance
    
    async def record_event(
        self,
        user_id: UUID,
        event_type: LedgerEventType,
        currency: Currency,
        amount: Decimal,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LedgerEvent:
        """
        Record a ledger event and update balance.
        
        This is the core method - all balance changes go through here.
        """
        # Get current balance with lock
        balance = await self.get_or_create_balance(user_id, currency)
        
        balance_before = balance.available
        balance_after = balance_before + amount
        
        # Validate sufficient balance for debits
        if amount < 0 and balance_after < 0:
            raise InsufficientBalanceError(
                f"Insufficient balance. Available: {balance_before}, Required: {abs(amount)}"
            )
        
        # Get previous checksum for chain integrity
        previous_checksum = await self.get_last_checksum(user_id, currency)
        
        created_at = datetime.utcnow()
        
        # Compute checksum
        checksum = self._compute_checksum(
            user_id=user_id,
            event_type=event_type,
            currency=currency,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_id=reference_id,
            previous_checksum=previous_checksum,
            created_at=created_at
        )
        
        # Create event
        event = LedgerEvent(
            user_id=user_id,
            event_type=event_type,
            currency=currency,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=reference_type,
            reference_id=reference_id,
            event_metadata=metadata,
            checksum=checksum,
            previous_checksum=previous_checksum,
            created_at=created_at
        )
        self.session.add(event)
        
        # Update cached balance
        balance.available = balance_after
        
        # Update stats based on event type
        if event_type == LedgerEventType.DEPOSIT:
            balance.total_deposited += amount
        elif event_type == LedgerEventType.WITHDRAWAL:
            balance.total_withdrawn += abs(amount)
        elif event_type == LedgerEventType.BET_PLACED:
            balance.total_wagered += abs(amount)
        elif event_type == LedgerEventType.BET_WON:
            balance.total_won += amount
        
        await self.session.flush()
        
        return event
    
    async def credit(
        self,
        user_id: UUID,
        currency: Currency,
        amount: Decimal,
        event_type: LedgerEventType,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LedgerEvent:
        """Credit user balance (add funds)"""
        if amount <= 0:
            raise ValueError("Credit amount must be positive")
        
        return await self.record_event(
            user_id=user_id,
            event_type=event_type,
            currency=currency,
            amount=amount,
            reference_type=reference_type,
            reference_id=reference_id,
            metadata=metadata
        )
    
    async def debit(
        self,
        user_id: UUID,
        currency: Currency,
        amount: Decimal,
        event_type: LedgerEventType,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LedgerEvent:
        """Debit user balance (remove funds)"""
        if amount <= 0:
            raise ValueError("Debit amount must be positive")
        
        return await self.record_event(
            user_id=user_id,
            event_type=event_type,
            currency=currency,
            amount=-amount,  # Negative for debit
            reference_type=reference_type,
            reference_id=reference_id,
            metadata=metadata
        )
    
    async def lock_balance(
        self,
        user_id: UUID,
        currency: Currency,
        amount: Decimal,
        reference_id: UUID
    ) -> None:
        """Lock balance for a bet (move from available to locked)"""
        balance = await self.get_or_create_balance(user_id, currency)
        
        if balance.available < amount:
            raise InsufficientBalanceError(
                f"Insufficient available balance. Available: {balance.available}, Required: {amount}"
            )
        
        balance.available -= amount
        balance.locked += amount
        await self.session.flush()
    
    async def unlock_balance(
        self,
        user_id: UUID,
        currency: Currency,
        amount: Decimal,
        reference_id: UUID
    ) -> None:
        """Unlock balance (move from locked back to available)"""
        balance = await self.get_or_create_balance(user_id, currency)
        
        if balance.locked < amount:
            raise ValueError(f"Locked balance insufficient: {balance.locked}")
        
        balance.locked -= amount
        balance.available += amount
        await self.session.flush()
    
    async def settle_bet_loss(
        self,
        user_id: UUID,
        currency: Currency,
        bet_amount: Decimal,
        bet_id: UUID
    ) -> LedgerEvent:
        """Settle a losing bet - remove from locked balance (already deducted from available by lock_balance)"""
        balance = await self.get_or_create_balance(user_id, currency)
        
        # Remove from locked (funds are forfeit)
        balance.locked -= bet_amount
        
        # Record the loss event with zero amount (balance already adjusted by lock_balance)
        return await self.record_event(
            user_id=user_id,
            event_type=LedgerEventType.BET_LOST,
            currency=currency,
            amount=Decimal("0"),
            reference_type="bet",
            reference_id=bet_id,
            metadata={"settlement": "loss", "bet_amount": str(bet_amount)}
        )
    
    async def settle_bet_win(
        self,
        user_id: UUID,
        currency: Currency,
        bet_amount: Decimal,
        payout: Decimal,
        bet_id: UUID
    ) -> LedgerEvent:
        """Settle a winning bet - return locked + add winnings"""
        balance = await self.get_or_create_balance(user_id, currency)
        
        # Return locked amount
        balance.locked -= bet_amount
        
        # Record the win event (full payout)
        return await self.record_event(
            user_id=user_id,
            event_type=LedgerEventType.BET_WON,
            currency=currency,
            amount=payout,
            reference_type="bet",
            reference_id=bet_id,
            metadata={
                "settlement": "win",
                "bet_amount": str(bet_amount),
                "profit": str(payout - bet_amount)
            }
        )
    
    async def verify_ledger_integrity(
        self, 
        user_id: UUID, 
        currency: Currency
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify the checksum chain for a user's ledger.
        
        Returns (is_valid, error_message)
        """
        result = await self.session.execute(
            select(LedgerEvent)
            .where(LedgerEvent.user_id == user_id)
            .where(LedgerEvent.currency == currency)
            .order_by(LedgerEvent.id.asc())
        )
        events = result.scalars().all()
        
        previous_checksum = None
        
        for event in events:
            # Verify chain link
            if event.previous_checksum != previous_checksum:
                return False, f"Chain broken at event {event.id}"
            
            # Recompute checksum
            expected_checksum = self._compute_checksum(
                user_id=event.user_id,
                event_type=event.event_type,
                currency=event.currency,
                amount=event.amount,
                balance_before=event.balance_before,
                balance_after=event.balance_after,
                reference_id=event.reference_id,
                previous_checksum=event.previous_checksum,
                created_at=event.created_at
            )
            
            if event.checksum != expected_checksum:
                return False, f"Checksum mismatch at event {event.id}"
            
            previous_checksum = event.checksum
        
        return True, None
    
    async def reconcile_balance(
        self, 
        user_id: UUID, 
        currency: Currency
    ) -> Tuple[Decimal, Decimal, bool]:
        """
        Reconcile cached balance against ledger sum.
        
        Returns (ledger_sum, cached_balance, matches)
        """
        # Sum all ledger events
        result = await self.session.execute(
            select(func.sum(LedgerEvent.amount))
            .where(LedgerEvent.user_id == user_id)
            .where(LedgerEvent.currency == currency)
        )
        ledger_sum = result.scalar_one_or_none() or Decimal("0")
        
        # Get cached balance
        balance = await self.get_or_create_balance(user_id, currency)
        cached_balance = balance.available + balance.locked
        
        matches = abs(ledger_sum - cached_balance) < Decimal("0.00000001")
        
        return ledger_sum, cached_balance, matches
    
    async def get_balance(self, user_id: UUID, currency: Currency) -> Dict[str, Decimal]:
        """Get user's current balance breakdown"""
        balance = await self.get_or_create_balance(user_id, currency)
        
        return {
            "available": balance.available,
            "locked": balance.locked,
            "frozen": balance.frozen,
            "total": balance.available + balance.locked,
            "bonus": balance.bonus_balance
        }
    
    async def get_transaction_history(
        self,
        user_id: UUID,
        currency: Optional[Currency] = None,
        event_types: Optional[List[LedgerEventType]] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[LedgerEvent]:
        """Get user's transaction history"""
        query = select(LedgerEvent).where(LedgerEvent.user_id == user_id)
        
        if currency:
            query = query.where(LedgerEvent.currency == currency)
        
        if event_types:
            query = query.where(LedgerEvent.event_type.in_(event_types))
        
        query = query.order_by(LedgerEvent.created_at.desc()).limit(limit).offset(offset)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())

"""
NOWPayments Integration Service
================================

Real crypto payment processing via NOWPayments API.
Supports BTC, ETH, SOL, USDT, USDC, LTC deposits and withdrawals.

Docs: https://documenter.getpostman.com/view/7907941/S1a32n38
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4

import httpx

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    """Payment processing error"""
    pass


class NOWPaymentsService:
    """
    NOWPayments payment processor integration.
    
    Flow:
    1. User clicks "Deposit" → we create a payment via API
    2. NOWPayments returns a unique pay_address + pay_amount
    3. User sends crypto to that address
    4. NOWPayments sends IPN callback when confirmed
    5. We credit user's balance via LedgerService
    """
    
    BASE_URL = "https://api.nowpayments.io/v1"
    SANDBOX_URL = "https://api-sandbox.nowpayments.io/v1"  # For testing
    
    # Map our currency symbols to NOWPayments symbols
    CURRENCY_MAP = {
        "BTC": "btc",
        "ETH": "eth",
        "SOL": "sol",
        "USDT": "usdttrc20",   # TRC-20 USDT (cheapest fees)
        "USDC": "usdcerc20",   # ERC-20 USDC
        "LTC": "ltc",
    }
    
    # Reverse map
    CURRENCY_REVERSE = {v: k for k, v in CURRENCY_MAP.items()}
    
    # Additional reverse mappings for IPN callbacks
    CURRENCY_REVERSE.update({
        "usdtbsc": "USDT",
        "usdterc20": "USDT",
        "usdttrc20": "USDT",
        "usdcsol": "USDC",
        "usdcerc20": "USDC",
    })
    
    def __init__(
        self,
        api_key: str,
        ipn_secret: str,
        sandbox: bool = False,
        callback_url: Optional[str] = None,
        success_url: Optional[str] = None,
    ):
        self.api_key = api_key
        self.ipn_secret = ipn_secret
        self.base_url = self.SANDBOX_URL if sandbox else self.BASE_URL
        self.callback_url = callback_url  # IPN endpoint
        self.success_url = success_url    # Redirect after payment
        
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "x-api-key": self.api_key,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
    
    async def close(self):
        await self._client.aclose()
    
    # ── Status ──────────────────────────────────────
    
    async def get_status(self) -> Dict[str, Any]:
        """Check API status"""
        resp = await self._client.get("/status")
        resp.raise_for_status()
        return resp.json()
    
    async def get_available_currencies(self) -> List[str]:
        """Get list of available currencies"""
        resp = await self._client.get("/currencies")
        resp.raise_for_status()
        return resp.json().get("currencies", [])
    
    async def get_minimum_amount(
        self,
        currency_from: str,
        currency_to: str = "usd",
    ) -> Decimal:
        """Get minimum payment amount"""
        resp = await self._client.get(
            "/min-amount",
            params={
                "currency_from": currency_from,
                "currency_to": currency_to,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return Decimal(str(data.get("min_amount", 0)))
    
    async def get_estimated_price(
        self,
        amount_usd: float,
        currency: str,
    ) -> Dict[str, Any]:
        """
        Get estimated crypto amount for a USD value.
        
        Returns: { "estimated_amount": 0.0023, "currency": "btc" }
        """
        now_currency = self.CURRENCY_MAP.get(currency.upper(), currency.lower())
        resp = await self._client.get(
            "/estimate",
            params={
                "amount": amount_usd,
                "currency_from": "usd",
                "currency_to": now_currency,
            },
        )
        resp.raise_for_status()
        return resp.json()
    
    # ── Payments (Deposits) ─────────────────────────
    
    async def create_payment(
        self,
        amount_usd: float,
        currency: str,
        order_id: str,
        order_description: str = "Casino Deposit",
    ) -> Dict[str, Any]:
        """
        Create a new payment (deposit).
        
        Args:
            amount_usd: Amount in USD
            currency: Our currency symbol (BTC, ETH, etc.)
            order_id: Our internal order/deposit ID
            order_description: Description shown to user
        
        Returns:
            {
                "payment_id": 123456,
                "payment_status": "waiting",
                "pay_address": "bc1q...",
                "pay_amount": 0.0023,
                "pay_currency": "btc",
                "price_amount": 100,
                "price_currency": "usd",
                "order_id": "...",
                "created_at": "...",
                ...
            }
        """
        now_currency = self.CURRENCY_MAP.get(currency.upper(), currency.lower())
        
        payload = {
            "price_amount": amount_usd,
            "price_currency": "usd",
            "pay_currency": now_currency,
            "order_id": order_id,
            "order_description": order_description,
            "ipn_callback_url": self.callback_url,
            "success_url": self.success_url,
            "is_fee_paid_by_user": False,  # We absorb fees
        }
        
        logger.info(f"Creating payment: {amount_usd} USD in {currency} (order: {order_id})")
        
        resp = await self._client.post("/payment", json=payload)
        
        if resp.status_code != 201 and resp.status_code != 200:
            error_data = resp.json() if resp.content else {}
            logger.error(f"Payment creation failed: {resp.status_code} {error_data}")
            raise PaymentError(
                f"Failed to create payment: {error_data.get('message', resp.status_code)}"
            )
        
        data = resp.json()
        logger.info(
            f"Payment created: ID={data.get('payment_id')}, "
            f"address={data.get('pay_address')}, "
            f"amount={data.get('pay_amount')} {data.get('pay_currency')}"
        )
        return data
    
    async def create_invoice(
        self,
        amount_usd: float,
        currency: str,
        order_id: str,
        order_description: str = "Casino Deposit",
    ) -> Dict[str, Any]:
        """
        Create an invoice — gives a hosted payment page URL.
        User gets redirected to NOWPayments hosted page.
        
        Returns:
            {
                "id": "invoice_id",
                "invoice_url": "https://nowpayments.io/payment/...",
                ...
            }
        """
        now_currency = self.CURRENCY_MAP.get(currency.upper(), currency.lower())
        
        payload = {
            "price_amount": amount_usd,
            "price_currency": "usd",
            "pay_currency": now_currency,
            "order_id": order_id,
            "order_description": order_description,
            "ipn_callback_url": self.callback_url,
            "success_url": self.success_url,
            "cancel_url": self.success_url,
            "is_fee_paid_by_user": False,
        }
        
        resp = await self._client.post("/invoice", json=payload)
        
        if resp.status_code not in (200, 201):
            error_data = resp.json() if resp.content else {}
            raise PaymentError(
                f"Failed to create invoice: {error_data.get('message', resp.status_code)}"
            )
        
        data = resp.json()
        logger.info(f"Invoice created: {data.get('id')} → {data.get('invoice_url')}")
        return data
    
    async def get_payment_status(self, payment_id: int) -> Dict[str, Any]:
        """Check payment status by ID"""
        resp = await self._client.get(f"/payment/{payment_id}")
        resp.raise_for_status()
        return resp.json()
    
    # ── Payouts (Withdrawals) ───────────────────────
    
    async def create_payout(
        self,
        amount: float,
        currency: str,
        address: str,
        withdrawal_id: str,
    ) -> Dict[str, Any]:
        """
        Create a payout (withdrawal) to a user's external address.
        
        Requires payouts API to be enabled on NOWPayments account.
        
        Returns payout details with status.
        """
        now_currency = self.CURRENCY_MAP.get(currency.upper(), currency.lower())
        
        payload = {
            "withdrawals": [
                {
                    "address": address,
                    "currency": now_currency,
                    "amount": amount,
                    "unique_external_id": withdrawal_id,
                }
            ]
        }
        
        logger.info(f"Creating payout: {amount} {currency} to {address[:12]}...")
        
        resp = await self._client.post("/payout", json=payload)
        
        if resp.status_code not in (200, 201):
            error_data = resp.json() if resp.content else {}
            logger.error(f"Payout failed: {resp.status_code} {error_data}")
            raise PaymentError(
                f"Payout failed: {error_data.get('message', resp.status_code)}"
            )
        
        data = resp.json()
        logger.info(f"Payout created: {data}")
        return data
    
    # ── IPN Verification ────────────────────────────
    
    def verify_ipn_signature(
        self,
        payload_body: bytes,
        signature_header: str,
    ) -> bool:
        """
        Verify the HMAC-SHA512 signature of an IPN callback.
        
        NOWPayments signs the JSON body with your IPN secret.
        The signature is sent in the `x-nowpayments-sig` header.
        """
        if not self.ipn_secret:
            logger.warning("IPN secret not configured — skipping verification")
            return True
        
        # Sort the JSON keys and compute HMAC
        try:
            payload_dict = json.loads(payload_body)
            sorted_payload = json.dumps(payload_dict, sort_keys=True)
            
            expected_sig = hmac.new(
                self.ipn_secret.encode("utf-8"),
                sorted_payload.encode("utf-8"),
                hashlib.sha512,
            ).hexdigest()
            
            return hmac.compare_digest(expected_sig, signature_header)
        except Exception as e:
            logger.error(f"IPN signature verification failed: {e}")
            return False
    
    def parse_ipn_callback(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse IPN callback data into our internal format.
        
        NOWPayments IPN statuses:
        - waiting       → Payment created, waiting for user to send
        - confirming    → Transaction detected, waiting confirmations
        - confirmed     → Confirmed, but not yet finished
        - sending       → Sending to your payout address
        - partially_paid → Only partial amount received
        - finished      → Payment complete ✓
        - failed        → Payment failed
        - refunded      → Payment refunded
        - expired       → Payment expired (user didn't pay)
        """
        now_currency = data.get("pay_currency", "").lower()
        our_currency = self.CURRENCY_REVERSE.get(now_currency, now_currency.upper())
        
        return {
            "payment_id": data.get("payment_id"),
            "status": data.get("payment_status"),
            "order_id": data.get("order_id"),
            "currency": our_currency,
            "pay_amount": Decimal(str(data.get("pay_amount", 0))),
            "actually_paid": Decimal(str(data.get("actually_paid", 0))),
            "price_amount_usd": Decimal(str(data.get("price_amount", 0))),
            "outcome_amount": Decimal(str(data.get("outcome_amount", 0))),
            "pay_address": data.get("pay_address"),
            "purchase_id": data.get("purchase_id"),
            "created_at": data.get("created_at"),
            "updated_at": data.get("updated_at"),
        }
    
    # ── Utilities ───────────────────────────────────
    
    def map_currency(self, our_symbol: str) -> str:
        """Map our symbol to NOWPayments symbol"""
        return self.CURRENCY_MAP.get(our_symbol.upper(), our_symbol.lower())
    
    def reverse_map_currency(self, now_symbol: str) -> str:
        """Map NOWPayments symbol to our symbol"""
        return self.CURRENCY_REVERSE.get(now_symbol.lower(), now_symbol.upper())


# ── Service factory ────────────────────────────────

_payment_service: Optional[NOWPaymentsService] = None


def get_payment_service() -> NOWPaymentsService:
    """Get or create the singleton payment service"""
    global _payment_service
    if _payment_service is None:
        import os
        # Try PAYMENT_ prefixed env vars first (matching PaymentSettings in config.py),
        # then fall back to unprefixed names for backwards compatibility
        api_key = os.getenv("PAYMENT_NOWPAYMENTS_API_KEY") or os.getenv("NOWPAYMENTS_API_KEY", "")
        ipn_secret = os.getenv("PAYMENT_NOWPAYMENTS_IPN_SECRET") or os.getenv("NOWPAYMENTS_IPN_SECRET", "")
        sandbox_str = os.getenv("PAYMENT_NOWPAYMENTS_SANDBOX") or os.getenv("NOWPAYMENTS_SANDBOX", "true")
        sandbox = sandbox_str.lower() == "true"
        callback_url = os.getenv("PAYMENT_NOWPAYMENTS_CALLBACK_URL") or os.getenv("NOWPAYMENTS_CALLBACK_URL", "")
        success_url = os.getenv("PAYMENT_NOWPAYMENTS_SUCCESS_URL") or os.getenv("NOWPAYMENTS_SUCCESS_URL", "")

        if not api_key:
            raise RuntimeError(
                "NOWPAYMENTS_API_KEY not configured. "
                "Set PAYMENT_NOWPAYMENTS_API_KEY or NOWPAYMENTS_API_KEY environment variable."
            )
        
        _payment_service = NOWPaymentsService(
            api_key=api_key,
            ipn_secret=ipn_secret,
            sandbox=sandbox,
            callback_url=callback_url,
            success_url=success_url,
        )
    return _payment_service


async def close_payment_service():
    """Close the payment service HTTP client"""
    global _payment_service
    if _payment_service:
        await _payment_service.close()
        _payment_service = None

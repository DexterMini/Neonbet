"""
Risk Engine
===========

Real-time fraud detection, velocity limits, and risk scoring.
Protects against:
- Bonus abuse
- Multi-accounting  
- Money laundering
- Collusion
- Advantage play
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Dict, List, Optional, Set, Any
from enum import Enum
from collections import defaultdict
import hashlib
import json

import redis.asyncio as redis


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskAction(str, Enum):
    ALLOW = "allow"
    REVIEW = "review"          # Manual review needed
    DELAY = "delay"            # Delay payout
    LIMIT = "limit"            # Reduce bet limits
    BLOCK = "block"            # Block action
    FREEZE = "freeze"          # Freeze account


class AlertType(str, Enum):
    VELOCITY_BREACH = "velocity_breach"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    HIGH_RISK_SCORE = "high_risk_score"
    DEVICE_FINGERPRINT = "device_fingerprint"
    IP_ANOMALY = "ip_anomaly"
    WITHDRAWAL_PATTERN = "withdrawal_pattern"
    COLLUSION_SUSPECTED = "collusion_suspected"
    BOT_BEHAVIOR = "bot_behavior"


@dataclass
class RiskAlert:
    """Risk alert for manual review"""
    alert_id: str
    user_id: str
    alert_type: AlertType
    risk_level: RiskLevel
    description: str
    evidence: Dict[str, Any]
    action_taken: RiskAction
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None


@dataclass
class VelocityLimit:
    """Rate limit configuration"""
    name: str
    max_count: int
    window_seconds: int
    action_on_breach: RiskAction


@dataclass  
class RiskScore:
    """User risk assessment"""
    user_id: str
    score: int  # 0-100, higher = more risky
    level: RiskLevel
    factors: Dict[str, int]  # Contributing factors
    last_updated: datetime


class RiskEngine:
    """
    Main risk engine for fraud detection and prevention.
    
    Features:
    - Velocity limiting (bets/hour, withdrawals/day, etc.)
    - Device fingerprinting
    - IP analysis
    - Behavioral analysis
    - Real-time risk scoring
    """
    
    # Velocity limits
    VELOCITY_LIMITS = {
        "bets_per_minute": VelocityLimit(
            "bets_per_minute", 30, 60, RiskAction.DELAY
        ),
        "bets_per_hour": VelocityLimit(
            "bets_per_hour", 500, 3600, RiskAction.LIMIT
        ),
        "withdrawals_per_day": VelocityLimit(
            "withdrawals_per_day", 5, 86400, RiskAction.REVIEW
        ),
        "deposits_per_hour": VelocityLimit(
            "deposits_per_hour", 10, 3600, RiskAction.REVIEW
        ),
        "failed_logins": VelocityLimit(
            "failed_logins", 5, 900, RiskAction.BLOCK
        ),
        "ip_changes_per_hour": VelocityLimit(
            "ip_changes_per_hour", 5, 3600, RiskAction.REVIEW
        ),
    }
    
    # Risk score thresholds
    RISK_THRESHOLDS = {
        RiskLevel.LOW: 25,
        RiskLevel.MEDIUM: 50,
        RiskLevel.HIGH: 75,
        RiskLevel.CRITICAL: 90
    }
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.alerts: List[RiskAlert] = []
        self._alert_callbacks = []
    
    # ========================
    # Velocity Limiting
    # ========================
    
    async def check_velocity(
        self, 
        user_id: str, 
        limit_type: str
    ) -> tuple[bool, Optional[RiskAction]]:
        """
        Check if user has exceeded velocity limit.
        
        Returns:
            (is_allowed, action_if_exceeded)
        """
        limit = self.VELOCITY_LIMITS.get(limit_type)
        if not limit:
            return True, None
        
        key = f"velocity:{user_id}:{limit_type}"
        
        # Get current count
        current = await self.redis.get(key)
        count = int(current) if current else 0
        
        if count >= limit.max_count:
            # Exceeded - create alert
            await self._create_alert(
                user_id=user_id,
                alert_type=AlertType.VELOCITY_BREACH,
                risk_level=RiskLevel.MEDIUM,
                description=f"Velocity limit exceeded: {limit_type}",
                evidence={
                    "limit_type": limit_type,
                    "count": count,
                    "max_allowed": limit.max_count,
                    "window_seconds": limit.window_seconds
                },
                action=limit.action_on_breach
            )
            return False, limit.action_on_breach
        
        return True, None
    
    async def increment_velocity(self, user_id: str, limit_type: str):
        """Increment velocity counter"""
        limit = self.VELOCITY_LIMITS.get(limit_type)
        if not limit:
            return
        
        key = f"velocity:{user_id}:{limit_type}"
        
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, limit.window_seconds)
        await pipe.execute()
    
    # ========================
    # Risk Scoring
    # ========================
    
    async def calculate_risk_score(
        self, 
        user_id: str,
        context: Dict[str, Any]
    ) -> RiskScore:
        """
        Calculate comprehensive risk score for user.
        
        Factors:
        - Account age
        - Verification level
        - Deposit/withdrawal ratio
        - Win rate anomalies
        - Betting patterns
        - Device/IP stability
        """
        factors = {}
        
        # Account age factor (new accounts = higher risk)
        account_age_days = context.get("account_age_days", 0)
        if account_age_days < 1:
            factors["new_account"] = 30
        elif account_age_days < 7:
            factors["new_account"] = 15
        elif account_age_days < 30:
            factors["new_account"] = 5
        
        # KYC level (unverified = higher risk)
        kyc_level = context.get("kyc_level", 0)
        if kyc_level == 0:
            factors["no_kyc"] = 20
        elif kyc_level == 1:
            factors["basic_kyc"] = 10
        
        # Deposit/Withdrawal ratio
        total_deposited = Decimal(str(context.get("total_deposited", 0)))
        total_withdrawn = Decimal(str(context.get("total_withdrawn", 0)))
        
        if total_deposited > 0:
            ratio = total_withdrawn / total_deposited
            if ratio > Decimal("0.9"):  # Withdrawing almost everything
                factors["high_withdrawal_ratio"] = 15
        
        # Win rate analysis
        win_rate = context.get("win_rate", 0.5)
        expected_win_rate = context.get("expected_win_rate", 0.49)
        
        if win_rate > expected_win_rate + 0.1:  # >10% above expected
            factors["abnormal_win_rate"] = 25
        
        # Betting pattern analysis
        avg_bet = Decimal(str(context.get("avg_bet", 0)))
        max_bet = Decimal(str(context.get("max_bet", 0)))
        
        if max_bet > avg_bet * 50:  # Huge bet size variance
            factors["erratic_betting"] = 15
        
        # IP/Device changes
        ip_changes = context.get("ip_changes_24h", 0)
        if ip_changes > 5:
            factors["ip_instability"] = 20
        
        device_changes = context.get("device_changes_24h", 0)
        if device_changes > 3:
            factors["device_instability"] = 20
        
        # Time pattern analysis (bots often play 24/7)
        hours_active = context.get("unique_hours_played_24h", 0)
        if hours_active > 20:
            factors["excessive_activity"] = 15
        
        # Calculate total score
        total_score = min(100, sum(factors.values()))
        
        # Determine risk level
        level = RiskLevel.LOW
        for risk_level, threshold in sorted(
            self.RISK_THRESHOLDS.items(), 
            key=lambda x: x[1],
            reverse=True
        ):
            if total_score >= threshold:
                level = risk_level
                break
        
        risk_score = RiskScore(
            user_id=user_id,
            score=total_score,
            level=level,
            factors=factors,
            last_updated=datetime.now(UTC)
        )
        
        # Cache score
        await self.redis.setex(
            f"risk_score:{user_id}",
            300,  # 5 min cache
            json.dumps({
                "score": total_score,
                "level": level.value,
                "factors": factors
            })
        )
        
        # Create alert if high risk
        if level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            await self._create_alert(
                user_id=user_id,
                alert_type=AlertType.HIGH_RISK_SCORE,
                risk_level=level,
                description=f"User has {level.value} risk score: {total_score}",
                evidence={"score": total_score, "factors": factors},
                action=RiskAction.REVIEW if level == RiskLevel.HIGH else RiskAction.LIMIT
            )
        
        return risk_score
    
    # ========================
    # Behavioral Analysis
    # ========================
    
    async def analyze_bet_pattern(
        self,
        user_id: str,
        bet_amounts: List[Decimal],
        timestamps: List[datetime]
    ) -> Dict[str, Any]:
        """
        Analyze betting patterns for suspicious behavior.
        
        Detects:
        - Martingale patterns (bonus abuse)
        - Consistent timing (bot behavior)
        - Round number bets (suspicious)
        """
        analysis = {
            "suspicious": False,
            "patterns_detected": [],
            "confidence": 0.0
        }
        
        if len(bet_amounts) < 10:
            return analysis
        
        # Check for Martingale pattern (doubling after loss)
        doubles_count = 0
        for i in range(1, len(bet_amounts)):
            ratio = bet_amounts[i] / bet_amounts[i-1] if bet_amounts[i-1] > 0 else 0
            if Decimal("1.9") <= ratio <= Decimal("2.1"):
                doubles_count += 1
        
        if doubles_count > len(bet_amounts) * 0.3:  # >30% doubles
            analysis["patterns_detected"].append("martingale")
            analysis["confidence"] += 0.4
        
        # Check for bot-like timing
        if len(timestamps) >= 2:
            intervals = []
            for i in range(1, len(timestamps)):
                diff = (timestamps[i] - timestamps[i-1]).total_seconds()
                intervals.append(diff)
            
            if intervals:
                avg_interval = sum(intervals) / len(intervals)
                variance = sum((x - avg_interval) ** 2 for x in intervals) / len(intervals)
                
                # Very consistent timing suggests automation
                if variance < 1.0 and avg_interval < 5:
                    analysis["patterns_detected"].append("bot_timing")
                    analysis["confidence"] += 0.5
        
        # Check for round number bets
        round_bets = sum(1 for b in bet_amounts if b == int(b) and b >= 10)
        if round_bets > len(bet_amounts) * 0.8:
            analysis["patterns_detected"].append("round_numbers")
            analysis["confidence"] += 0.2
        
        analysis["suspicious"] = analysis["confidence"] > 0.5
        
        if analysis["suspicious"]:
            await self._create_alert(
                user_id=user_id,
                alert_type=AlertType.SUSPICIOUS_PATTERN,
                risk_level=RiskLevel.MEDIUM,
                description="Suspicious betting pattern detected",
                evidence={
                    "patterns": analysis["patterns_detected"],
                    "confidence": analysis["confidence"]
                },
                action=RiskAction.REVIEW
            )
        
        return analysis
    
    async def detect_collusion(
        self,
        game_id: str,
        player_actions: Dict[str, List[Dict]]
    ) -> bool:
        """
        Detect potential collusion between players.
        
        Looks for:
        - Coordinated betting/folding
        - Chip dumping patterns
        - Unusual win/loss patterns between same players
        """
        # Implementation for multiplayer games
        # Track player interactions and look for suspicious patterns
        
        # Simplified: Check if same players consistently trade wins
        player_vs_player: Dict[tuple, Dict] = defaultdict(lambda: {"wins": 0, "losses": 0})
        
        for player, actions in player_actions.items():
            for action in actions:
                opponent = action.get("opponent")
                if opponent:
                    if action.get("won"):
                        player_vs_player[(player, opponent)]["wins"] += 1
                    else:
                        player_vs_player[(player, opponent)]["losses"] += 1
        
        # Look for asymmetric patterns
        for (p1, p2), stats in player_vs_player.items():
            reverse_stats = player_vs_player.get((p2, p1), {"wins": 0, "losses": 0})
            
            total_games = stats["wins"] + stats["losses"]
            if total_games >= 20:
                # Check if one player consistently wins
                if stats["wins"] / total_games > 0.8:
                    await self._create_alert(
                        user_id=p1,
                        alert_type=AlertType.COLLUSION_SUSPECTED,
                        risk_level=RiskLevel.HIGH,
                        description=f"Potential collusion detected between {p1} and {p2}",
                        evidence={
                            "player1": p1,
                            "player2": p2,
                            "p1_wins": stats["wins"],
                            "p1_losses": stats["losses"],
                            "game_count": total_games
                        },
                        action=RiskAction.FREEZE
                    )
                    return True
        
        return False
    
    # ========================
    # Device Fingerprinting  
    # ========================
    
    def generate_device_fingerprint(self, device_data: Dict[str, Any]) -> str:
        """Generate unique device fingerprint"""
        fp_data = {
            "user_agent": device_data.get("user_agent", ""),
            "screen_resolution": device_data.get("screen_resolution", ""),
            "timezone": device_data.get("timezone", ""),
            "language": device_data.get("language", ""),
            "platform": device_data.get("platform", ""),
            "webgl_vendor": device_data.get("webgl_vendor", ""),
            "canvas_hash": device_data.get("canvas_hash", ""),
        }
        
        fp_string = json.dumps(fp_data, sort_keys=True)
        return hashlib.sha256(fp_string.encode()).hexdigest()[:32]
    
    async def check_device_fingerprint(
        self,
        user_id: str,
        fingerprint: str
    ) -> tuple[bool, Optional[str]]:
        """
        Check if device fingerprint is associated with other accounts.
        
        Returns:
            (is_clean, linked_user_id)
        """
        # Check if fingerprint is linked to another user
        linked_user = await self.redis.get(f"fingerprint:{fingerprint}")
        
        if linked_user and linked_user.decode() != user_id:
            return False, linked_user.decode()
        
        # Store fingerprint for this user
        await self.redis.setex(
            f"fingerprint:{fingerprint}",
            86400 * 30,  # 30 days
            user_id
        )
        
        # Track user's fingerprints
        await self.redis.sadd(f"user_fingerprints:{user_id}", fingerprint)
        
        return True, None
    
    # ========================
    # Withdrawal Risk Assessment
    # ========================
    
    async def assess_withdrawal_risk(
        self,
        user_id: str,
        amount: Decimal,
        context: Dict[str, Any]
    ) -> tuple[RiskAction, str]:
        """
        Assess risk of withdrawal request.
        
        Returns recommended action and reason.
        """
        reasons = []
        
        # Check velocity
        allowed, action = await self.check_velocity(user_id, "withdrawals_per_day")
        if not allowed:
            return action, "Withdrawal limit exceeded"
        
        # Check if amount exceeds lifetime deposits
        total_deposited = Decimal(str(context.get("total_deposited", 0)))
        total_withdrawn = Decimal(str(context.get("total_withdrawn", 0)))
        
        if amount + total_withdrawn > total_deposited * Decimal("1.5"):
            reasons.append("withdrawal_exceeds_deposits")
        
        # Check account age
        account_age_days = context.get("account_age_days", 0)
        if account_age_days < 3 and amount > Decimal("1000"):
            reasons.append("new_account_large_withdrawal")
        
        # Check KYC level vs amount
        kyc_level = context.get("kyc_level", 0)
        if kyc_level == 0 and amount > Decimal("500"):
            return RiskAction.BLOCK, "KYC required for this withdrawal amount"
        if kyc_level == 1 and amount > Decimal("5000"):
            return RiskAction.BLOCK, "Enhanced KYC required for this withdrawal amount"
        
        # Check for rapid deposit-withdraw pattern
        last_deposit_minutes = context.get("minutes_since_last_deposit", float("inf"))
        if last_deposit_minutes < 30 and amount > total_deposited * Decimal("0.8"):
            reasons.append("rapid_deposit_withdraw")
        
        # Get current risk score
        risk_score = await self.get_cached_risk_score(user_id)
        
        if risk_score and risk_score["level"] in ["high", "critical"]:
            reasons.append("high_risk_user")
        
        # Determine action
        if "rapid_deposit_withdraw" in reasons or "new_account_large_withdrawal" in reasons:
            return RiskAction.DELAY, f"Withdrawal delayed for review: {', '.join(reasons)}"
        
        if len(reasons) >= 2:
            return RiskAction.REVIEW, f"Manual review required: {', '.join(reasons)}"
        
        if reasons:
            return RiskAction.ALLOW, f"Approved with notes: {', '.join(reasons)}"
        
        return RiskAction.ALLOW, "Approved"
    
    # ========================
    # Bet Risk Assessment
    # ========================
    
    async def assess_bet_risk(
        self,
        user_id: str,
        bet_amount: Decimal,
        game_type: str,
        potential_win: Decimal,
        context: Dict[str, Any]
    ) -> tuple[RiskAction, str]:
        """
        Assess risk of bet placement.
        
        Considers:
        - Bet size vs user history
        - Potential win vs house limits
        - User risk score
        - Velocity limits
        """
        # Check velocity
        allowed, action = await self.check_velocity(user_id, "bets_per_minute")
        if not allowed:
            return action, "Betting too fast"
        
        allowed, action = await self.check_velocity(user_id, "bets_per_hour")
        if not allowed:
            return action, "Hourly bet limit reached"
        
        # Check max potential win vs house limit
        max_win = Decimal(str(context.get("max_single_win", 1000000)))
        if potential_win > max_win:
            return RiskAction.BLOCK, f"Maximum potential win is ${max_win}"
        
        # Check bet size vs user's average
        avg_bet = Decimal(str(context.get("user_avg_bet", bet_amount)))
        if bet_amount > avg_bet * 20 and bet_amount > Decimal("1000"):
            return RiskAction.REVIEW, "Bet significantly larger than usual"
        
        # Check risk score
        risk_score = await self.get_cached_risk_score(user_id)
        
        if risk_score:
            if risk_score["level"] == "critical":
                return RiskAction.BLOCK, "Account under review"
            if risk_score["level"] == "high" and bet_amount > Decimal("500"):
                return RiskAction.LIMIT, "Bet limits applied to your account"
        
        # Increment velocity counter
        await self.increment_velocity(user_id, "bets_per_minute")
        await self.increment_velocity(user_id, "bets_per_hour")
        
        return RiskAction.ALLOW, "Approved"
    
    # ========================
    # Helper Methods
    # ========================
    
    async def get_cached_risk_score(self, user_id: str) -> Optional[Dict]:
        """Get cached risk score"""
        cached = await self.redis.get(f"risk_score:{user_id}")
        if cached:
            return json.loads(cached)
        return None
    
    async def _create_alert(
        self,
        user_id: str,
        alert_type: AlertType,
        risk_level: RiskLevel,
        description: str,
        evidence: Dict[str, Any],
        action: RiskAction
    ) -> RiskAlert:
        """Create and store risk alert"""
        alert = RiskAlert(
            alert_id=hashlib.sha256(
                f"{user_id}:{alert_type.value}:{datetime.now(UTC).timestamp()}".encode()
            ).hexdigest()[:16],
            user_id=user_id,
            alert_type=alert_type,
            risk_level=risk_level,
            description=description,
            evidence=evidence,
            action_taken=action
        )
        
        self.alerts.append(alert)
        
        # Store in Redis
        await self.redis.lpush(
            f"alerts:{user_id}",
            json.dumps({
                "alert_id": alert.alert_id,
                "type": alert.alert_type.value,
                "level": alert.risk_level.value,
                "description": alert.description,
                "action": alert.action_taken.value,
                "created_at": alert.created_at.isoformat()
            })
        )
        
        # Notify callbacks
        for callback in self._alert_callbacks:
            try:
                await callback(alert)
            except Exception:
                pass
        
        return alert
    
    def on_alert(self, callback):
        """Register alert callback"""
        self._alert_callbacks.append(callback)
    
    async def get_user_alerts(
        self, 
        user_id: str, 
        limit: int = 50
    ) -> List[Dict]:
        """Get recent alerts for user"""
        alerts = await self.redis.lrange(f"alerts:{user_id}", 0, limit - 1)
        return [json.loads(a) for a in alerts]
    
    async def get_pending_alerts(
        self, 
        risk_level: Optional[RiskLevel] = None
    ) -> List[RiskAlert]:
        """Get unresolved alerts, optionally filtered by level"""
        alerts = [a for a in self.alerts if not a.resolved]
        
        if risk_level:
            alerts = [a for a in alerts if a.risk_level == risk_level]
        
        return sorted(alerts, key=lambda x: x.created_at, reverse=True)

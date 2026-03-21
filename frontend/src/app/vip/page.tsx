'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ChevronRight, Crown, ArrowUpRight, Check, Star, Gem, Trophy, Zap, Shield, Gift, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, cn } from '@/lib/utils'
import { GameLayout } from '@/components/GameLayout'

const TIERS = [
  {
    name: 'Bronze', wager: 0, rakeback: '5%', lossback: '0%', levelUp: 0,
    weekly: '0.1%', monthly: '0.5%', dailyLimit: '$1,000', monthlyLimit: '$10,000',
    hex: '#CD7F32', gradient: 'from-amber-900/40 to-yellow-950/20', support: false, events: false, host: false,
    icon: Shield,
  },
  {
    name: 'Silver', wager: 5_000, rakeback: '10%', lossback: '3%', levelUp: 25,
    weekly: '0.2%', monthly: '1%', dailyLimit: '$5,000', monthlyLimit: '$50,000',
    hex: '#94A3B8', gradient: 'from-slate-700/40 to-slate-900/20', support: true, events: false, host: false,
    icon: Star,
  },
  {
    name: 'Gold', wager: 25_000, rakeback: '15%', lossback: '5%', levelUp: 100,
    weekly: '0.3%', monthly: '1.5%', dailyLimit: '$10,000', monthlyLimit: '$100,000',
    hex: '#FACC15', gradient: 'from-yellow-700/40 to-amber-950/20', support: true, events: false, host: false,
    icon: Trophy,
  },
  {
    name: 'Platinum', wager: 100_000, rakeback: '20%', lossback: '8%', levelUp: 500,
    weekly: '0.4%', monthly: '2%', dailyLimit: '$25,000', monthlyLimit: '$250,000',
    hex: '#22D3EE', gradient: 'from-cyan-800/40 to-cyan-950/20', support: true, events: true, host: false,
    icon: Zap,
  },
  {
    name: 'Diamond', wager: 500_000, rakeback: '25%', lossback: '10%', levelUp: 2_500,
    weekly: '0.5%', monthly: '2.5%', dailyLimit: '$50,000', monthlyLimit: '$500,000',
    hex: '#A78BFA', gradient: 'from-violet-800/40 to-purple-950/20', support: true, events: true, host: true,
    icon: Gem,
  },
  {
    name: 'VIP', wager: 2_000_000, rakeback: '30%', lossback: '12%', levelUp: 10_000,
    weekly: '0.6%', monthly: '3%', dailyLimit: '$100,000', monthlyLimit: '$1,000,000',
    hex: '#FB7185', gradient: 'from-rose-800/40 to-rose-950/20', support: true, events: true, host: true,
    icon: Crown,
  },
  {
    name: 'SVIP', wager: 10_000_000, rakeback: '35%', lossback: '15%', levelUp: 50_000,
    weekly: '0.7%', monthly: '3.5%', dailyLimit: '$500,000', monthlyLimit: '$5,000,000',
    hex: '#F59E0B', gradient: 'from-amber-700/50 to-yellow-950/30', support: true, events: true, host: true,
    icon: Crown,
  },
]

export default function VIPPage() {
  const { token, isAuthenticated, isHydrated } = useAuthStore()
  const [wagered, setWagered] = useState(0)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [vipData, setVipData] = useState<any>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token) return
    fetch('/api/v1/bets/stats/summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.total_wagered) setWagered(parseFloat(d.total_wagered)) })
      .catch(() => {})
  }, [isHydrated, isAuthenticated, token])

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token) return
    fetch('/api/v1/wallet/vip/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setVipData(d) })
      .catch(() => {})
  }, [isHydrated, isAuthenticated, token])

  const handleClaim = async (type: string) => {
    if (!token || claiming) return
    setClaiming(type)
    setClaimMsg(null)
    try {
      const res = await fetch(`/api/v1/wallet/vip/claim-${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setClaimMsg(`Claimed $${parseFloat(data.amount).toFixed(2)} USDT!`)
        // Refresh VIP data
        const refreshed = await fetch('/api/v1/wallet/vip/status', {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : null)
        if (refreshed) setVipData(refreshed)
      } else {
        setClaimMsg(data.detail || data.message || 'Nothing to claim')
      }
    } catch {
      setClaimMsg('Failed to claim')
    } finally {
      setClaiming(null)
      setTimeout(() => setClaimMsg(null), 4000)
    }
  }

  const currentIdx = useMemo(() => {
    let idx = 0
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (wagered >= TIERS[i].wager) { idx = i; break }
    }
    return idx
  }, [wagered])

  const current = TIERS[currentIdx]
  const next = TIERS[currentIdx + 1] || null
  const progress = next
    ? Math.min(100, ((wagered - current.wager) / (next.wager - current.wager)) * 100)
    : 100
  const remaining = next ? Math.max(0, next.wager - wagered) : 0

  return (
    <GameLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">

        {/* ─── Hero Banner ─── */}
        <div className="relative rounded-xl overflow-hidden mb-5">
          {/* Layered background */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-background to-amber-900/5" />
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse at 80% 30%, ${current.hex}15 0%, transparent 50%), radial-gradient(ellipse at 10% 80%, rgba(251,191,36,0.08) 0%, transparent 40%)`,
          }} />
          {/* Decorative crown watermark */}
          <div className="absolute top-1/2 right-[8%] -translate-y-1/2 opacity-[0.04] pointer-events-none">
            <Crown className="w-48 h-48 text-amber-400" />
          </div>

          <div className="relative px-5 py-6 sm:px-8 sm:py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/80">VIP Program</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
                Climb the Ranks
              </h1>
              <p className="text-xs sm:text-sm text-white/45 max-w-md leading-relaxed">
                Every wager earns you progress. Higher tiers unlock better rakeback, bigger bonuses, and exclusive perks.
              </p>
            </div>

            {/* Current tier badge — premium glass card */}
            <div className="flex-shrink-0 relative rounded-xl overflow-hidden min-w-[170px]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08]" />
              <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 20%, ${current.hex}20, transparent 60%)` }} />
              <div className="relative p-4">
                <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-medium mb-1.5">Your Tier</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3.5 h-3.5 rounded-full shadow-lg" style={{ background: current.hex, boxShadow: `0 0 12px ${current.hex}60` }} />
                  <span className="text-lg font-black text-white">{current.name}</span>
                </div>
                <div className="h-px bg-white/[0.06] mb-3" />
                <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-medium mb-1">Rakeback</p>
                <p className="text-xl font-black" style={{ color: current.hex }}>{current.rakeback}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Progress + Stats ─── */}
        <div className="bg-surface/60 backdrop-blur-sm rounded-xl border border-border/60 p-4 sm:p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-[0.15em] font-medium mb-1">Total Wagered</p>
              <p className="text-xl font-black text-white tabular-nums">{formatCurrency(wagered)}</p>
            </div>
            {next && (
              <div className="text-right">
                <p className="text-white/35 text-[10px] uppercase tracking-[0.15em] font-medium mb-1">Next Tier</p>
                <p className="text-white font-semibold text-sm">
                  <span style={{ color: next.hex }}>{next.name}</span>
                  <span className="text-white/40 font-normal ml-2 text-xs">
                    {formatCurrency(remaining)} remaining
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {next ? (
            <div>
              <div className="h-2.5 rounded-full bg-white/[0.04] border border-white/[0.04] overflow-hidden">
                <motion.div
                  className="h-full rounded-full relative"
                  style={{ background: `linear-gradient(90deg, ${current.hex}, ${next.hex})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full" />
                </motion.div>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-white/30 font-medium">{current.name}</span>
                <span className="text-[10px] text-white/50 font-bold">{Math.round(progress)}%</span>
                <span className="text-[10px] text-white/30 font-medium">{next.name}</span>
              </div>
            </div>
          ) : (
            <div className="py-2.5 px-4 rounded-lg bg-brand/10 border border-brand/15">
              <p className="text-xs text-brand font-medium">You&apos;ve reached the highest tier. All maximum rewards are active.</p>
            </div>
          )}

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-2.5 mt-4">
            {[
              { label: 'Lossback', val: current.lossback, icon: Shield },
              { label: 'Weekly Bonus', val: current.weekly, icon: Gift },
              { label: 'Monthly Bonus', val: current.monthly, icon: TrendingUp },
              { label: 'Daily Withdraw', val: current.dailyLimit, icon: Zap },
            ].map(s => {
              const SIcon = s.icon
              return (
                <div key={s.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.04] text-center">
                  <SIcon className="w-3.5 h-3.5 text-white/20 mx-auto mb-1.5" />
                  <p className="text-white text-sm font-bold">{s.val}</p>
                  <p className="text-white/30 text-[9px] uppercase tracking-wider mt-0.5 font-medium">{s.label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Rewards & Claims ─── */}
        {isAuthenticated && vipData && (
          <div className="bg-surface/60 backdrop-blur-sm rounded-xl border border-border/60 p-4 sm:p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white tracking-tight">Your Rewards</h2>
              {vipData.xp !== undefined && (
                <div className="flex items-center gap-1.5 bg-brand/10 border border-brand/20 rounded-lg px-3 py-1">
                  <Zap className="w-3 h-3 text-brand" />
                  <span className="text-xs font-bold text-brand">{vipData.xp.toLocaleString()} XP</span>
                </div>
              )}
            </div>

            {claimMsg && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-brand/10 border border-brand/20">
                <p className="text-xs text-brand font-medium">{claimMsg}</p>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Rakeback */}
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                <p className="text-white/30 text-[9px] uppercase tracking-wider font-medium mb-1">Rakeback</p>
                <p className="text-white text-lg font-black tabular-nums">${parseFloat(vipData.rakeback?.available || '0').toFixed(2)}</p>
                <p className="text-white/25 text-[10px] mb-2">{vipData.rakeback?.percent}% of house edge</p>
                <button
                  onClick={() => handleClaim('rakeback')}
                  disabled={claiming === 'rakeback' || parseFloat(vipData.rakeback?.available || '0') <= 0}
                  className="w-full text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-md bg-brand/15 text-brand border border-brand/20 hover:bg-brand/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {claiming === 'rakeback' ? 'Claiming...' : 'Claim'}
                </button>
              </div>

              {/* Lossback */}
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                <p className="text-white/30 text-[9px] uppercase tracking-wider font-medium mb-1">Lossback</p>
                <p className="text-white text-lg font-black tabular-nums">${parseFloat(vipData.lossback?.available || '0').toFixed(2)}</p>
                <p className="text-white/25 text-[10px] mb-2">{vipData.lossback?.percent}% of net losses</p>
                <button
                  onClick={() => handleClaim('lossback')}
                  disabled={claiming === 'lossback' || parseFloat(vipData.lossback?.available || '0') <= 0}
                  className="w-full text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/20 hover:bg-violet-500/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {claiming === 'lossback' ? 'Claiming...' : 'Claim Weekly'}
                </button>
              </div>

              {/* Weekly Bonus */}
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                <p className="text-white/30 text-[9px] uppercase tracking-wider font-medium mb-1">Weekly Bonus</p>
                <p className="text-white text-lg font-black">{current.weekly}</p>
                <p className="text-white/25 text-[10px] mb-2">of last week&apos;s wager</p>
                <button
                  onClick={() => handleClaim('weekly-bonus')}
                  disabled={claiming === 'weekly-bonus'}
                  className="w-full text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {claiming === 'weekly-bonus' ? 'Claiming...' : 'Claim'}
                </button>
              </div>

              {/* Monthly Bonus */}
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                <p className="text-white/30 text-[9px] uppercase tracking-wider font-medium mb-1">Monthly Bonus</p>
                <p className="text-white text-lg font-black">{current.monthly}</p>
                <p className="text-white/25 text-[10px] mb-2">of last month&apos;s wager</p>
                <button
                  onClick={() => handleClaim('monthly-bonus')}
                  disabled={claiming === 'monthly-bonus'}
                  className="w-full text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {claiming === 'monthly-bonus' ? 'Claiming...' : 'Claim'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Tier Cards ─── */}
        <div className="mb-5">
          <h2 className="text-sm font-bold text-white mb-3 tracking-tight">All Tiers</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {TIERS.map((tier, i) => {
              const isUnlocked = i <= currentIdx
              const isCurrent = i === currentIdx
              const TierIcon = tier.icon

              return (
                <div
                  key={tier.name}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={cn(
                    'relative rounded-lg border p-3 text-center transition-all cursor-default',
                    isCurrent
                      ? 'border-brand/30 bg-brand/[0.06]'
                      : isUnlocked
                        ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                        : 'border-white/[0.04] bg-white/[0.01] opacity-50',
                    hoveredIdx === i && !isCurrent && 'border-white/10 opacity-100',
                  )}
                >
                  {isCurrent && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black uppercase tracking-wider bg-brand text-background px-1.5 py-0.5 rounded-sm">
                      You
                    </span>
                  )}
                  <div
                    className="w-9 h-9 rounded-lg mx-auto mb-2 flex items-center justify-center border"
                    style={{
                      background: `linear-gradient(135deg, ${tier.hex}20, ${tier.hex}08)`,
                      borderColor: `${tier.hex}25`,
                      boxShadow: isCurrent ? `0 0 16px ${tier.hex}30` : 'none',
                    }}
                  >
                    <TierIcon className="w-4 h-4" style={{ color: tier.hex }} />
                  </div>
                  <p className="text-xs font-bold text-white">{tier.name}</p>
                  <p className="text-[10px] font-medium mt-0.5" style={{ color: `${tier.hex}cc` }}>{tier.rakeback}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Comparison Table ─── */}
        <div className="bg-surface/60 backdrop-blur-sm rounded-xl border border-border/60 overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-border/40">
            <h2 className="text-sm font-bold text-white tracking-tight">Tier Comparison</h2>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Tier', 'Wager', 'Rakeback', 'Lossback', 'Weekly', 'Monthly', 'Daily Limit', 'Support', 'Host'].map(h => (
                    <th key={h} className={cn(
                      'text-[10px] font-medium text-white/30 uppercase tracking-wider px-4 py-3',
                      h === 'Tier' ? 'text-left w-[130px]' : 'text-center'
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t, i) => {
                  const isCurr = i === currentIdx
                  return (
                    <tr
                      key={t.name}
                      className={cn(
                        'border-b border-white/[0.03] transition-colors',
                        isCurr
                          ? 'bg-brand/[0.04]'
                          : 'hover:bg-white/[0.015]',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: t.hex, boxShadow: isCurr ? `0 0 8px ${t.hex}50` : 'none' }}
                          />
                          <span className={cn('text-xs font-semibold', isCurr ? 'text-white' : 'text-white/70')}>
                            {t.name}
                          </span>
                          {isCurr && (
                            <span className="text-[8px] font-black text-brand bg-brand/15 px-1.5 py-0.5 rounded uppercase">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={cn('px-4 py-3 text-center text-xs tabular-nums', isCurr ? 'text-white font-medium' : 'text-white/40')}>
                        {t.wager > 0 ? formatCurrency(t.wager) : 'Free'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-xs font-bold', isCurr ? 'text-brand' : 'text-white/70')}>
                          {t.rakeback}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-xs font-medium', t.lossback === '0%' ? 'text-white/25' : isCurr ? 'text-violet-400 font-bold' : 'text-white/60')}>
                          {t.lossback === '0%' ? '—' : t.lossback}
                        </span>
                      </td>
                      <td className={cn('px-4 py-3 text-center text-xs', isCurr ? 'text-white' : 'text-white/40')}>
                        {t.weekly}
                      </td>
                      <td className={cn('px-4 py-3 text-center text-xs', isCurr ? 'text-white' : 'text-white/40')}>
                        {t.monthly}
                      </td>
                      <td className={cn('px-4 py-3 text-center text-xs tabular-nums', isCurr ? 'text-white' : 'text-white/40')}>
                        {t.dailyLimit}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.support ? (
                          <span className="text-[11px] text-amber-400 font-medium">Priority</span>
                        ) : (
                          <span className="text-[11px] text-white/25">Standard</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.host ? (
                          <span className="text-[11px] text-brand font-medium">Yes</span>
                        ) : (
                          <span className="text-[11px] text-white/20">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── How It Works ─── */}
        <div className="mb-5">
          <h2 className="text-sm font-bold text-white mb-3 tracking-tight">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                step: '01',
                icon: Zap,
                color: '#00E87B',
                title: 'Wager on any game',
                desc: 'Every dollar you wager across all games counts toward your VIP progression.',
              },
              {
                step: '02',
                icon: TrendingUp,
                color: '#A78BFA',
                title: 'Unlock higher tiers',
                desc: 'As your total wager grows, you automatically move up to the next tier with better rewards.',
              },
              {
                step: '03',
                icon: Gift,
                color: '#FACC15',
                title: 'Collect your rewards',
                desc: 'Rakeback is credited instantly. Weekly and monthly bonuses are paid on schedule.',
              },
            ].map(card => {
              const CIcon = card.icon
              return (
                <div key={card.step} className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-5 hover:border-white/[0.08] transition-colors group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{
                      background: `${card.color}10`,
                      borderColor: `${card.color}20`,
                    }}>
                      <CIcon className="w-4 h-4" style={{ color: card.color }} />
                    </div>
                    <span className="text-lg font-black text-white/10 font-mono">{card.step}</span>
                  </div>
                  <h3 className="text-xs font-bold text-white mb-1">{card.title}</h3>
                  <p className="text-[11px] text-white/35 leading-relaxed">{card.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── VIP Transfer CTA ─── */}
        <div className="relative rounded-xl overflow-hidden mb-5 border border-amber-500/15">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-amber-900/5 to-background" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-black text-white mb-1">Already VIP elsewhere?</h3>
              <p className="text-xs text-white/40 leading-relaxed">Transfer your VIP status from Stake, Rollbit, or any other platform. Keep your tier, get up to 35% rakeback and a personal VIP host.</p>
            </div>
            <Link
              href="/vip"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-background font-bold text-xs rounded-lg hover:from-amber-400 hover:to-yellow-400 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            >
              Transfer VIP Status <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* ─── Sign Up CTA ─── */}
        {!isAuthenticated && (
          <div className="relative rounded-xl overflow-hidden border border-brand/15">
            <div className="absolute inset-0 bg-gradient-to-r from-brand/10 via-brand/5 to-background" />
            <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-white mb-1">Start earning rewards today</h2>
                <p className="text-xs text-white/40">Create an account and begin your VIP journey.</p>
              </div>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand text-background font-bold text-xs rounded-lg hover:bg-brand/90 transition-all whitespace-nowrap"
              >
                Sign Up <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

      </div>
    </GameLayout>
  )
}

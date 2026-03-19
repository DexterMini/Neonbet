'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ChevronRight, Crown, ArrowUpRight, Check, MessageCircle, Sparkles, Shield } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, cn } from '@/lib/utils'

const TIERS = [
  {
    name: 'Bronze', wager: 0, rakeback: '5%', levelUp: 0,
    weekly: '0.1%', monthly: '0.5%', dailyLimit: '$1,000', monthlyLimit: '$10,000',
    hex: '#CD7F32', support: false, events: false, host: false,
  },
  {
    name: 'Silver', wager: 5_000, rakeback: '10%', levelUp: 25,
    weekly: '0.2%', monthly: '1%', dailyLimit: '$5,000', monthlyLimit: '$50,000',
    hex: '#94A3B8', support: true, events: false, host: false,
  },
  {
    name: 'Gold', wager: 25_000, rakeback: '15%', levelUp: 100,
    weekly: '0.3%', monthly: '1.5%', dailyLimit: '$10,000', monthlyLimit: '$100,000',
    hex: '#FACC15', support: true, events: false, host: false,
  },
  {
    name: 'Platinum', wager: 100_000, rakeback: '20%', levelUp: 500,
    weekly: '0.4%', monthly: '2%', dailyLimit: '$25,000', monthlyLimit: '$250,000',
    hex: '#22D3EE', support: true, events: true, host: false,
  },
  {
    name: 'Diamond', wager: 500_000, rakeback: '25%', levelUp: 2_500,
    weekly: '0.5%', monthly: '2.5%', dailyLimit: '$50,000', monthlyLimit: '$500,000',
    hex: '#A78BFA', support: true, events: true, host: true,
  },
  {
    name: 'VIP', wager: 2_000_000, rakeback: '30%', levelUp: 10_000,
    weekly: '0.6%', monthly: '3%', dailyLimit: '$100,000', monthlyLimit: '$1,000,000',
    hex: '#FB7185', support: true, events: true, host: true,
  },
  {
    name: 'SVIP', wager: 10_000_000, rakeback: '35%', levelUp: 50_000,
    weekly: '0.7%', monthly: '3.5%', dailyLimit: '$500,000', monthlyLimit: '$5,000,000',
    hex: '#F59E0B', support: true, events: true, host: true,
  },
]

export default function VIPPage() {
  const { token, isAuthenticated, isHydrated } = useAuthStore()
  const [wagered, setWagered] = useState(0)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token) return
    fetch('/api/v1/bets/stats/summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.total_wagered) setWagered(parseFloat(d.total_wagered)) })
      .catch(() => {})
  }, [isHydrated, isAuthenticated, token])

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
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10">

        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/" className="text-text-secondary hover:text-text-primary text-sm flex items-center gap-1">
            &larr; Back to Casino
          </Link>
        </div>

        {/* ─── Hero Banner ─── */}
        <div className="relative rounded-2xl overflow-hidden mb-8">
          {/* Gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${current.hex}22 0%, transparent 50%), linear-gradient(to right, #141620, #0A0B0F)`,
            }}
          />
          <div className="absolute inset-0 noise" />

          <div className="relative px-6 py-8 sm:px-10 sm:py-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-text-muted text-xs font-medium uppercase tracking-widest mb-2">VIP Program</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
                Climb the Ranks
              </h1>
              <p className="text-text-secondary text-sm sm:text-base max-w-md leading-relaxed">
                Every wager earns you progress. Higher tiers unlock better rakeback, bigger bonuses, and exclusive perks.
              </p>
            </div>

            {/* Current tier badge */}
            <div className="flex-shrink-0 bg-surface rounded-xl border border-border p-5 min-w-[180px]">
              <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">Your Tier</p>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: current.hex }} />
                <span className="text-xl font-bold text-text-primary">{current.name}</span>
              </div>
              <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1">Rakeback</p>
              <p className="text-lg font-bold" style={{ color: current.hex }}>{current.rakeback}</p>
            </div>
          </div>
        </div>

        {/* ─── Progress Section ─── */}
        <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Total Wagered</p>
              <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(wagered)}</p>
            </div>
            {next && (
              <div className="text-right">
                <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Next Tier</p>
                <p className="text-text-primary font-semibold">
                  {next.name}
                  <span className="text-text-muted font-normal ml-2">
                    {formatCurrency(remaining)} remaining
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {next ? (
            <div>
              <div className="h-2 rounded-full bg-background-elevated overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${current.hex}, ${next.hex})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[11px] text-text-muted">{current.name}</span>
                <span className="text-[11px] text-text-muted">{Math.round(progress)}%</span>
                <span className="text-[11px] text-text-muted">{next.name}</span>
              </div>
            </div>
          ) : (
            <div className="py-3 px-4 rounded-xl bg-brand-muted border border-brand/10">
              <p className="text-sm text-brand font-medium">You&apos;ve reached the highest tier. All maximum rewards are active.</p>
            </div>
          )}

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: 'Weekly Bonus', val: current.weekly },
              { label: 'Monthly Bonus', val: current.monthly },
              { label: 'Daily Withdraw', val: current.dailyLimit },
            ].map(s => (
              <div key={s.label} className="bg-background rounded-xl p-3 text-center border border-border/50">
                <p className="text-text-primary text-sm font-semibold">{s.val}</p>
                <p className="text-text-muted text-[10px] uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Tier Cards Grid ─── */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4">All Tiers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {TIERS.map((tier, i) => {
              const isUnlocked = i <= currentIdx
              const isCurrent = i === currentIdx
              const isOpen = activeIdx === i

              return (
                <button
                  key={tier.name}
                  onClick={() => setActiveIdx(isOpen ? null : i)}
                  className={cn(
                    'relative rounded-xl border p-4 text-left transition-all',
                    isCurrent
                      ? 'bg-surface border-brand/30'
                      : isUnlocked
                        ? 'bg-surface border-border hover:border-border-light'
                        : 'bg-background-secondary border-border/50 opacity-60 hover:opacity-80',
                    isOpen && 'ring-1 ring-brand/40',
                  )}
                >
                  {isCurrent && (
                    <span className="absolute -top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-brand text-background px-1.5 py-0.5 rounded">
                      You
                    </span>
                  )}
                  <div
                    className="w-8 h-8 rounded-lg mb-2 flex items-center justify-center text-xs font-black"
                    style={{
                      background: `${tier.hex}15`,
                      color: tier.hex,
                    }}
                  >
                    {tier.name[0]}
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{tier.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{tier.rakeback}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Expanded Tier Detail ─── */}
        <AnimatePresence>
          {activeIdx !== null && (() => {
            const tier = TIERS[activeIdx]
            const isUnlocked = activeIdx <= currentIdx
            const isCurrent = activeIdx === currentIdx
            const wagerNeeded = Math.max(0, tier.wager - wagered)

            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden mb-8"
              >
                <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                  {/* Header */}
                  <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold"
                        style={{ background: `${tier.hex}18`, color: tier.hex }}
                      >
                        {tier.name[0]}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-text-primary">{tier.name}</h3>
                        <p className="text-xs text-text-muted">
                          {tier.wager > 0 ? `${formatCurrency(tier.wager)} wager required` : 'Starting tier'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isCurrent && (
                        <span className="text-xs font-semibold text-brand bg-brand-muted px-2 py-1 rounded">
                          Active
                        </span>
                      )}
                      {!isUnlocked && (
                        <span className="text-xs font-medium text-text-muted bg-background px-2 py-1 rounded border border-border">
                          {formatCurrency(wagerNeeded)} to go
                        </span>
                      )}
                      {isUnlocked && !isCurrent && (
                        <span className="text-xs font-medium text-accent-green bg-accent-green/10 px-2 py-1 rounded">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Benefits grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
                    {[
                      { label: 'Rakeback', value: tier.rakeback },
                      { label: 'Weekly', value: tier.weekly },
                      { label: 'Monthly', value: tier.monthly },
                      { label: 'Level-Up', value: tier.levelUp > 0 ? formatCurrency(tier.levelUp) : '—' },
                      { label: 'Daily Limit', value: tier.dailyLimit },
                      { label: 'Monthly Limit', value: tier.monthlyLimit },
                      { label: 'Support', value: tier.support ? 'Priority' : 'Standard' },
                      { label: 'Host', value: tier.host ? 'Personal' : '—' },
                    ].map(item => (
                      <div key={item.label} className="px-5 py-4 border-b border-r border-border/50">
                        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{item.label}</p>
                        <p className={cn(
                          'text-sm font-semibold',
                          item.value === '—' || item.value === 'Standard'
                            ? 'text-text-muted'
                            : 'text-text-primary',
                        )}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )
          })()}
        </AnimatePresence>

        {/* ─── Comparison Table ─── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Tier Comparison</h2>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider px-5 py-3.5 w-[140px]">
                    Tier
                  </th>
                  <th className="text-center text-[11px] font-medium text-text-muted uppercase tracking-wider px-3 py-3.5">
                    Wager
                  </th>
                  <th className="text-center text-[11px] font-medium text-text-muted uppercase tracking-wider px-3 py-3.5">
                    Rakeback
                  </th>
                  <th className="text-center text-[11px] font-medium text-text-muted uppercase tracking-wider px-3 py-3.5">
                    Weekly
                  </th>
                  <th className="text-center text-[11px] font-medium text-text-muted uppercase tracking-wider px-3 py-3.5">
                    Monthly
                  </th>
                  <th className="text-center text-[11px] font-medium text-text-muted uppercase tracking-wider px-3 py-3.5">
                    Daily Limit
                  </th>
                  <th className="text-center text-[11px] font-medium text-text-muted uppercase tracking-wider px-3 py-3.5">
                    Support
                  </th>
                  <th className="text-center text-[11px] font-medium text-text-muted uppercase tracking-wider px-3 py-3.5">
                    Host
                  </th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t, i) => {
                  const isCurr = i === currentIdx
                  return (
                    <tr
                      key={t.name}
                      className={cn(
                        'border-b border-border/40 transition-colors',
                        isCurr
                          ? 'bg-brand-muted'
                          : 'hover:bg-background-hover',
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: t.hex }}
                          />
                          <span className={cn(
                            'text-sm font-medium',
                            isCurr ? 'text-text-primary' : 'text-text-secondary',
                          )}>
                            {t.name}
                          </span>
                          {isCurr && (
                            <span className="text-[9px] font-bold text-brand bg-brand/15 px-1.5 py-0.5 rounded uppercase">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={cn('px-3 py-3.5 text-center text-xs', isCurr ? 'text-text-primary font-medium' : 'text-text-muted')}>
                        {t.wager > 0 ? formatCurrency(t.wager) : 'Free'}
                      </td>
                      <td className={cn('px-3 py-3.5 text-center text-xs font-semibold', isCurr ? 'text-text-primary' : 'text-text-secondary')}>
                        {t.rakeback}
                      </td>
                      <td className={cn('px-3 py-3.5 text-center text-xs', isCurr ? 'text-text-primary' : 'text-text-muted')}>
                        {t.weekly}
                      </td>
                      <td className={cn('px-3 py-3.5 text-center text-xs', isCurr ? 'text-text-primary' : 'text-text-muted')}>
                        {t.monthly}
                      </td>
                      <td className={cn('px-3 py-3.5 text-center text-xs', isCurr ? 'text-text-primary' : 'text-text-muted')}>
                        {t.dailyLimit}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {t.support ? (
                          <span className="text-xs text-accent-green font-medium">Priority</span>
                        ) : (
                          <span className="text-xs text-text-muted">Standard</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {t.host ? (
                          <span className="text-xs text-accent-green font-medium">Yes</span>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
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
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: '01',
                title: 'Wager on any game',
                desc: 'Every dollar you wager across all games counts toward your VIP progression.',
              },
              {
                step: '02',
                title: 'Unlock higher tiers',
                desc: 'As your total wager grows, you automatically move up to the next tier with better rewards.',
              },
              {
                step: '03',
                title: 'Collect your rewards',
                desc: 'Rakeback is credited instantly. Weekly and monthly bonuses are paid on schedule.',
              },
            ].map(card => (
              <div key={card.step} className="bg-surface rounded-2xl border border-border p-6 group hover:border-border-light transition-colors">
                <span className="text-2xl font-black text-text-muted/30 mb-3 block font-mono">{card.step}</span>
                <h3 className="text-sm font-semibold text-text-primary mb-1.5">{card.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── CTA ─── */}
        {!isAuthenticated && (
          <div className="bg-gradient-to-r from-brand to-brand-light rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-background mb-1">Start earning rewards today</h2>
              <p className="text-background/70 text-sm">Create an account and begin your VIP journey.</p>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-background text-text-primary font-semibold rounded-xl hover:bg-background-deep transition-colors whitespace-nowrap"
            >
              Sign Up <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}

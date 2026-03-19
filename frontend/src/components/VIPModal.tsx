'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
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

interface VIPModalProps {
  open: boolean
  onClose: () => void
}

export function VIPModal({ open, onClose }: VIPModalProps) {
  const { token, isAuthenticated, isHydrated } = useAuthStore()
  const [wagered, setWagered] = useState(0)
  const [selectedTier, setSelectedTier] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !isHydrated || !isAuthenticated || !token) return
    fetch('/api/v1/bets/stats/summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.total_wagered) setWagered(parseFloat(d.total_wagered)) })
      .catch(() => {})
  }, [open, isHydrated, isAuthenticated, token])

  // Reset selected tier when closing
  useEffect(() => {
    if (!open) setSelectedTier(null)
  }, [open])

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

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-[calc(100%-2rem)] max-w-3xl max-h-[85vh] bg-background-elevated border border-border rounded-2xl shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-bold text-text-primary">VIP Program</h2>
                <p className="text-xs text-text-muted mt-0.5">Wager to progress through tiers and unlock rewards</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">

              {/* ── Current Status ── */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-surface rounded-xl border border-border">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                    style={{ background: `${current.hex}18`, color: current.hex }}
                  >
                    {current.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Current Tier</p>
                    <p className="text-base font-bold text-text-primary">{current.name}</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-text-muted">Rakeback</p>
                    <p className="text-base font-bold" style={{ color: current.hex }}>{current.rakeback}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Wagered</p>
                    <p className="text-base font-bold text-text-primary tabular-nums">{formatCurrency(wagered)}</p>
                  </div>
                </div>
              </div>

              {/* ── Progress Bar ── */}
              {next ? (
                <div>
                  <div className="flex justify-between text-[11px] text-text-muted mb-2">
                    <span>{current.name}</span>
                    <span>{formatCurrency(remaining)} to {next.name}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${current.hex}, ${next.hex})` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted text-right mt-1">{Math.round(progress)}%</p>
                </div>
              ) : (
                <div className="py-2.5 px-4 rounded-lg bg-brand-muted border border-brand/10">
                  <p className="text-sm text-brand font-medium">Maximum tier reached. All rewards active.</p>
                </div>
              )}

              {/* ── Tier Selector ── */}
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">All Tiers</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {TIERS.map((tier, i) => {
                    const isCurr = i === currentIdx
                    const isSelected = selectedTier === i
                    const isLocked = i > currentIdx
                    return (
                      <button
                        key={tier.name}
                        onClick={() => setSelectedTier(isSelected ? null : i)}
                        className={cn(
                          'relative flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                          isSelected
                            ? 'bg-surface border border-border-light text-text-primary'
                            : isCurr
                              ? 'bg-brand/10 text-brand border border-brand/20'
                              : isLocked
                                ? 'bg-transparent text-text-muted/50 border border-transparent hover:bg-surface/50'
                                : 'bg-transparent text-text-secondary border border-transparent hover:bg-surface',
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: tier.hex }}
                          />
                          {tier.name}
                        </span>
                        {isCurr && !isSelected && (
                          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-brand" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Selected Tier Detail ── */}
              <AnimatePresence mode="wait">
                {selectedTier !== null && (() => {
                  const tier = TIERS[selectedTier]
                  const isUnlocked = selectedTier <= currentIdx
                  const isCurr = selectedTier === currentIdx
                  const wagerNeeded = Math.max(0, tier.wager - wagered)

                  return (
                    <motion.div
                      key={tier.name}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="bg-surface rounded-xl border border-border overflow-hidden"
                    >
                      {/* Tier header */}
                      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black"
                            style={{ background: `${tier.hex}18`, color: tier.hex }}
                          >
                            {tier.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-text-primary">{tier.name}</p>
                            <p className="text-[11px] text-text-muted">
                              {tier.wager > 0 ? `${formatCurrency(tier.wager)} required` : 'Starting tier'}
                            </p>
                          </div>
                        </div>
                        <div>
                          {isCurr && (
                            <span className="text-[10px] font-semibold text-brand bg-brand-muted px-2 py-0.5 rounded">Active</span>
                          )}
                          {!isUnlocked && (
                            <span className="text-[10px] font-medium text-text-muted bg-background px-2 py-0.5 rounded border border-border">
                              {formatCurrency(wagerNeeded)} to go
                            </span>
                          )}
                          {isUnlocked && !isCurr && (
                            <span className="text-[10px] font-medium text-accent-green bg-accent-green/10 px-2 py-0.5 rounded">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Benefits */}
                      <div className="grid grid-cols-2 sm:grid-cols-4">
                        {[
                          { label: 'Rakeback', value: tier.rakeback },
                          { label: 'Weekly Bonus', value: tier.weekly },
                          { label: 'Monthly Bonus', value: tier.monthly },
                          { label: 'Level-Up Bonus', value: tier.levelUp > 0 ? formatCurrency(tier.levelUp) : '—' },
                          { label: 'Daily Limit', value: tier.dailyLimit },
                          { label: 'Monthly Limit', value: tier.monthlyLimit },
                          { label: 'Priority Support', value: tier.support ? 'Yes' : '—' },
                          { label: 'Personal Host', value: tier.host ? 'Yes' : '—' },
                        ].map(item => (
                          <div key={item.label} className="px-4 py-3 border-b border-r border-border/30">
                            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">{item.label}</p>
                            <p className={cn(
                              'text-sm font-semibold',
                              item.value === '—' ? 'text-text-muted/40' : 'text-text-primary',
                            )}>
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )
                })()}
              </AnimatePresence>

              {/* ── Comparison Table ── */}
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Comparison</p>
                <div className="bg-surface rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full min-w-[580px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5 w-[100px]">Tier</th>
                          <th className="text-center text-[10px] font-medium text-text-muted uppercase tracking-wider px-2 py-2.5">Wager</th>
                          <th className="text-center text-[10px] font-medium text-text-muted uppercase tracking-wider px-2 py-2.5">Rakeback</th>
                          <th className="text-center text-[10px] font-medium text-text-muted uppercase tracking-wider px-2 py-2.5">Weekly</th>
                          <th className="text-center text-[10px] font-medium text-text-muted uppercase tracking-wider px-2 py-2.5">Monthly</th>
                          <th className="text-center text-[10px] font-medium text-text-muted uppercase tracking-wider px-2 py-2.5">Daily Limit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TIERS.map((t, i) => {
                          const isCurr = i === currentIdx
                          return (
                            <tr
                              key={t.name}
                              className={cn(
                                'border-b border-border/30 transition-colors',
                                isCurr ? 'bg-brand-muted' : 'hover:bg-background-hover',
                              )}
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.hex }} />
                                  <span className={cn('text-xs font-medium', isCurr ? 'text-text-primary' : 'text-text-secondary')}>
                                    {t.name}
                                  </span>
                                  {isCurr && (
                                    <span className="text-[8px] font-bold text-brand bg-brand/15 px-1 py-px rounded uppercase">You</span>
                                  )}
                                </div>
                              </td>
                              <td className={cn('px-2 py-2.5 text-center text-[11px]', isCurr ? 'text-text-primary' : 'text-text-muted')}>
                                {t.wager > 0 ? formatCurrency(t.wager) : 'Free'}
                              </td>
                              <td className={cn('px-2 py-2.5 text-center text-[11px] font-semibold', isCurr ? 'text-text-primary' : 'text-text-secondary')}>
                                {t.rakeback}
                              </td>
                              <td className={cn('px-2 py-2.5 text-center text-[11px]', isCurr ? 'text-text-primary' : 'text-text-muted')}>
                                {t.weekly}
                              </td>
                              <td className={cn('px-2 py-2.5 text-center text-[11px]', isCurr ? 'text-text-primary' : 'text-text-muted')}>
                                {t.monthly}
                              </td>
                              <td className={cn('px-2 py-2.5 text-center text-[11px]', isCurr ? 'text-text-primary' : 'text-text-muted')}>
                                {t.dailyLimit}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ── How it works (compact) ── */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { n: '01', title: 'Wager', desc: 'Every dollar wagered on any game counts toward progression.' },
                  { n: '02', title: 'Rank Up', desc: 'Reach the next wager threshold to unlock a higher tier automatically.' },
                  { n: '03', title: 'Earn More', desc: 'Higher tiers give better rakeback, bigger bonuses, and more perks.' },
                ].map(c => (
                  <div key={c.n} className="bg-surface rounded-lg border border-border/50 p-3">
                    <span className="text-lg font-black text-text-muted/20 font-mono block mb-1">{c.n}</span>
                    <p className="text-xs font-semibold text-text-primary mb-0.5">{c.title}</p>
                    <p className="text-[11px] text-text-muted leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

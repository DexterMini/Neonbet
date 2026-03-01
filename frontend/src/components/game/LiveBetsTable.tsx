'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveBetsStore, type LiveBet } from '@/stores/liveBetsStore'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LiveBetsTableProps {
  game: string
}

type Tab = 'all' | 'my' | 'high'

export function LiveBetsTable({ game }: LiveBetsTableProps) {
  const { bets, myBets, startGenerating, stopGenerating } = useLiveBetsStore()
  const [tab, setTab] = useState<Tab>('all')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    startGenerating(game)
    return () => stopGenerating()
  }, [game, startGenerating, stopGenerating])

  const visibleBets = useMemo(() => {
    if (!mounted) return []
    switch (tab) {
      case 'my': return myBets
      case 'high': return [...bets].filter(b => b.betAmount >= 100).sort((a, b) => b.betAmount - a.betAmount)
      default: return bets
    }
  }, [tab, bets, myBets, mounted])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All Bets' },
    { key: 'my', label: 'My Bets' },
    { key: 'high', label: 'High Rollers' },
  ]

  return (
    <div className="bg-background-secondary rounded-2xl border border-border/60 overflow-hidden">
      {/* Header tabs */}
      <div className="flex items-center border-b border-border/60">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-medium transition-colors',
              tab === t.key
                ? 'text-brand bg-brand/[0.06] border-b-2 border-brand font-bold'
                : 'text-muted hover:text-muted-light'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_0.8fr_0.6fr_0.8fr] gap-2 px-3 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider border-b border-border/40">
        <span>Player</span>
        <span className="text-right">Bet</span>
        <span className="text-right">Multi</span>
        <span className="text-right">Profit</span>
      </div>

      {/* Rows */}
      <div className="max-h-[160px] overflow-y-auto scrollbar-thin">
        <AnimatePresence initial={false}>
          {visibleBets.length === 0 ? (
            <div className="py-4 text-center text-muted text-xs">
              {tab === 'my' ? 'Place a bet to see your history' : 'No high roller bets yet'}
            </div>
          ) : (
            visibleBets.map((bet) => (
              <BetRow key={bet.id} bet={bet} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function BetRow({ bet }: { bet: LiveBet }) {
  const isWin = bet.profit > 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -10, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-[1fr_0.8fr_0.6fr_0.8fr] gap-2 px-3 py-1 text-[11px] border-b border-border/20 hover:bg-white/[0.02] transition-colors"
    >
      {/* Player */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm shrink-0">{bet.avatar}</span>
        <span className="text-muted-light font-medium truncate">{bet.username}</span>
      </div>

      {/* Bet amount */}
      <div className="text-right font-mono text-muted-light tabular-nums">
        ${bet.betAmount.toFixed(2)}
      </div>

      {/* Multiplier */}
      <div className={cn(
        'text-right font-mono font-bold tabular-nums',
        isWin ? 'text-brand' : 'text-muted'
      )}>
        {isWin ? `${bet.multiplier.toFixed(2)}x` : '—'}
      </div>

      {/* Profit */}
      <div className={cn(
        'text-right font-mono font-bold tabular-nums flex items-center justify-end gap-1',
        isWin ? 'text-brand' : 'text-accent-red'
      )}>
        {isWin ? (
          <><TrendingUp className="w-3 h-3" />+${bet.profit.toFixed(2)}</>
        ) : (
          <><TrendingDown className="w-3 h-3" />-${Math.abs(bet.profit).toFixed(2)}</>
        )}
      </div>
    </motion.div>
  )
}

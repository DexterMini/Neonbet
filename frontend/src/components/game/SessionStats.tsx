'use client'

import { create } from 'zustand'
import { RotateCcw, X, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Session stats store ──────────────────────────── */
interface SessionStats {
  totalBets: number
  wins: number
  losses: number
  totalWagered: number
  totalProfit: number
  bestMultiplier: number
  currentStreak: number
  bestStreak: number
  profitHistory: number[] // rolling profit values for sparkline chart
}

interface SessionStatsState extends SessionStats {
  recordBet: (won: boolean, betAmount: number, profit: number, multiplier: number) => void
  reset: () => void
}

export const useSessionStats = create<SessionStatsState>((set) => ({
  totalBets: 0,
  wins: 0,
  losses: 0,
  totalWagered: 0,
  totalProfit: 0,
  bestMultiplier: 0,
  currentStreak: 0,
  bestStreak: 0,
  profitHistory: [],

  recordBet: (won, betAmount, profit, multiplier) =>
    set((s) => {
      const newStreak = won
        ? (s.currentStreak >= 0 ? s.currentStreak + 1 : 1)
        : (s.currentStreak <= 0 ? s.currentStreak - 1 : -1)
      const newProfit = s.totalProfit + profit
      return {
        totalBets: s.totalBets + 1,
        wins: s.wins + (won ? 1 : 0),
        losses: s.losses + (won ? 0 : 1),
        totalWagered: s.totalWagered + betAmount,
        totalProfit: newProfit,
        bestMultiplier: Math.max(s.bestMultiplier, won ? multiplier : 0),
        currentStreak: newStreak,
        bestStreak: Math.max(s.bestStreak, Math.abs(newStreak)),
        profitHistory: [...s.profitHistory, newProfit].slice(-60),
      }
    }),

  reset: () =>
    set({
      totalBets: 0, wins: 0, losses: 0,
      totalWagered: 0, totalProfit: 0, bestMultiplier: 0,
      currentStreak: 0, bestStreak: 0, profitHistory: [],
    }),
}))

/* ── Mini Sparkline SVG Chart ─────────────────────── */
function ProfitChart({ data }: { data: number[] }) {
  if (data.length < 2) return null

  const width = 180
  const height = 70
  const padding = 4

  const minVal = Math.min(...data, 0)
  const maxVal = Math.max(...data, 0)
  const range = maxVal - minVal || 1

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (v - minVal) / range) * (height - padding * 2),
  }))

  // zero line
  const zeroY = padding + (1 - (0 - minVal) / range) * (height - padding * 2)

  const pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ')

  // gradient area
  const lastPt = points[points.length - 1]
  const firstPt = points[0]
  const areaD = `${pathD} L${lastPt.x},${height} L${firstPt.x},${height} Z`

  const lastProfit = data[data.length - 1]
  const isPositive = lastProfit >= 0
  const lineColor = isPositive ? '#00E87B' : '#FF4757'
  const fillColor = isPositive ? 'rgba(0,232,123,0.12)' : 'rgba(255,71,87,0.12)'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Zero line */}
      <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY}
        stroke="#1A1D28" strokeWidth={1} strokeDasharray="3,3" />
      {/* Area fill */}
      <path d={areaD} fill={fillColor} />
      {/* Line */}
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle cx={lastPt.x} cy={lastPt.y} r={3} fill={lineColor} />
      {/* Last value label */}
      <text x={lastPt.x - 4} y={lastPt.y - 8} fill={lineColor} fontSize={10} fontWeight="bold" fontFamily="monospace">
        {lastProfit >= 0 ? '+' : ''}{lastProfit.toFixed(2)}
      </text>
    </svg>
  )
}

/* ── LIVE STATS Panel ─────────────────────────────── */
export function SessionStatsBar() {
  const stats = useSessionStats()
  const [isOpen, setIsOpen] = useState(false)

  if (stats.totalBets === 0) return null

  return (
    <>
      {/* Compact trigger bar */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full bg-background-secondary rounded-xl border border-border/60 px-4 py-2.5 flex items-center justify-between hover:border-brand/30 transition-all group"
      >
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Live Stats</span>
          <div className="w-px h-3.5 bg-border" />
          <span className={cn('font-mono font-bold', stats.totalProfit >= 0 ? 'text-brand' : 'text-accent-red')}>
            {stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}
          </span>
          <div className="w-px h-3.5 bg-border" />
          <span className="text-muted">{stats.totalBets} bets</span>
          <div className="w-px h-3.5 bg-border" />
          <span className="font-mono">
            <span className="text-brand font-bold">{stats.wins}</span>
            <span className="text-muted mx-0.5">W</span>
            <span className="text-accent-red font-bold">{stats.losses}</span>
            <span className="text-muted">L</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stats.profitHistory.length >= 2 && (
            <div className="w-16 h-5 opacity-60 group-hover:opacity-100 transition-opacity">
              <svg viewBox="0 0 180 70" className="w-full h-full">
                {(() => {
                  const d = stats.profitHistory
                  const mn = Math.min(...d, 0)
                  const mx = Math.max(...d, 0)
                  const rng = mx - mn || 1
                  const pts = d.map((v, i) => `${4 + (i / (d.length - 1)) * 172},${4 + (1 - (v - mn) / rng) * 62}`).join(' ')
                  return <polyline points={pts} fill="none" stroke={d[d.length-1] >= 0 ? '#00E87B' : '#FF4757'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                })()}
              </svg>
            </div>
          )}
          {stats.currentStreak !== 0 && (
            <span className={cn(
              'text-[11px] font-mono font-bold px-1.5 py-0.5 rounded',
              stats.currentStreak > 0 ? 'text-brand bg-brand/10' : 'text-accent-red bg-accent-red/10'
            )}>
              {stats.currentStreak > 0 ? '+' : ''}{stats.currentStreak}
            </span>
          )}
        </div>
      </button>

      {/* Expanded LIVE STATS panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="fixed top-20 right-6 z-50 w-[280px] bg-background-secondary rounded-2xl border border-border/80 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <button
                onClick={() => stats.reset()}
                className="p-1.5 rounded-lg hover:bg-surface transition-colors text-muted hover:text-white"
                title="Reset stats"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <span className="text-[13px] font-black uppercase tracking-wider text-white">Live Stats</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface transition-colors text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats Grid */}
            <div className="px-4 py-3 space-y-3">
              {/* Profit + Wins row */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Profit</div>
                  <div className={cn(
                    'text-[18px] font-black font-mono tabular-nums leading-tight',
                    stats.totalProfit >= 0 ? 'text-brand' : 'text-accent-red'
                  )}>
                    {stats.totalProfit >= 0 ? '+' : '-'}${Math.abs(stats.totalProfit).toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Wins</div>
                  <div className="text-[18px] font-black font-mono tabular-nums text-brand leading-tight">
                    {stats.wins}
                  </div>
                </div>
              </div>

              {/* Wagered + Losses row */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Wagered</div>
                  <div className="text-[18px] font-black font-mono tabular-nums text-white leading-tight">
                    ${stats.totalWagered.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Losses</div>
                  <div className="text-[18px] font-black font-mono tabular-nums text-accent-red leading-tight">
                    {stats.losses}
                  </div>
                </div>
              </div>

              {/* Profit Chart */}
              {stats.profitHistory.length >= 2 && (
                <div className="bg-surface/60 rounded-xl p-2 border border-border/40">
                  <ProfitChart data={stats.profitHistory} />
                </div>
              )}

              {/* Extra stats row */}
              <div className="flex items-center justify-between py-2 border-t border-border/40">
                <div className="flex items-center gap-3 text-[11px]">
                  {stats.bestMultiplier > 0 && (
                    <span className="font-mono text-accent-amber font-bold">{stats.bestMultiplier.toFixed(2)}x best</span>
                  )}
                  {stats.currentStreak !== 0 && (
                    <span className={cn('font-mono font-bold', stats.currentStreak > 0 ? 'text-brand' : 'text-accent-red')}>
                      {Math.abs(stats.currentStreak)} streak
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted font-mono">{stats.totalBets} bets</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

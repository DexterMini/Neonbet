'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { ChatPanel } from '@/components/ChatPanel'
import { MobileNav } from '@/components/MobileNav'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import {
  Trophy, Crown, Medal, Flame, TrendingUp, Clock,
  ChevronRight, Star, Zap, Award, ArrowUp, ArrowDown,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const AVATARS = ['🎯', '🔥', '💎', '🚀', '⚡', '🎲', '🪙', '👑', '🦁', '🎰', '🌟', '🃏', '💰', '🏆', '🎪']

const VIP_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'VIP', 'SVIP'] as const
const VIP_COLORS: Record<string, string> = {
  Bronze: 'text-orange-400', Silver: 'text-gray-300', Gold: 'text-amber-400',
  Platinum: 'text-cyan-300', Diamond: 'text-blue-400', VIP: 'text-purple-400', SVIP: 'text-red-400',
}

interface LeaderboardEntry {
  rank: number
  username: string
  avatar: string
  wagered: number
  profit: number
  wins: number
  bets: number
  winRate: number
  vipTier: string
}

/* ── Podium Component ────────────────────────────── */
function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length < 3) return null
  const [first, second, third] = entries

  const podiumData = [
    { entry: second, pos: 2, height: 'h-28', color: 'from-gray-400/20 to-gray-500/10', borderColor: 'border-gray-400/30', medal: '🥈', size: 'w-14 h-14 text-2xl' },
    { entry: first, pos: 1, height: 'h-36', color: 'from-amber-400/20 to-amber-500/10', borderColor: 'border-amber-400/40', medal: '🥇', size: 'w-18 h-18 text-3xl' },
    { entry: third, pos: 3, height: 'h-24', color: 'from-orange-400/20 to-orange-500/10', borderColor: 'border-orange-400/25', medal: '🥉', size: 'w-14 h-14 text-2xl' },
  ]

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4 py-6 px-4">
      {podiumData.map(({ entry, pos, height, color, borderColor, medal, size }) => (
        <motion.div
          key={pos}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: pos * 0.15, type: 'spring', stiffness: 200 }}
          className="flex flex-col items-center"
        >
          {/* Avatar */}
          <div className={`${size} rounded-full bg-surface border-2 ${borderColor} flex items-center justify-center mb-2 shadow-lg relative`}>
            <span>{entry.avatar}</span>
            <div className="absolute -bottom-1 -right-1 text-lg">{medal}</div>
          </div>
          {/* Name */}
          <span className="text-white font-bold text-xs sm:text-sm mb-1 truncate max-w-[80px] sm:max-w-[100px]">{entry.username}</span>
          <span className={`text-[10px] font-semibold ${VIP_COLORS[entry.vipTier] || 'text-muted'}`}>{entry.vipTier}</span>
          {/* Podium block */}
          <div className={`${height} w-20 sm:w-24 mt-2 rounded-t-xl bg-gradient-to-t ${color} border ${borderColor} border-b-0 flex flex-col items-center justify-start pt-3`}>
            <span className="text-2xl font-black text-white/80">#{pos}</span>
            <span className="text-brand font-bold text-xs mt-1 font-mono">${(entry.wagered / 1000).toFixed(1)}K</span>
            <span className={`text-[10px] font-semibold mt-0.5 ${entry.profit >= 0 ? 'text-brand' : 'text-accent-red'}`}>
              {entry.profit >= 0 ? '+' : ''}${(entry.profit / 1000).toFixed(1)}K
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ── Prize Pool Breakdown ─────────────────────────── */
const PRIZES = {
  daily: {
    total: '$10,000',
    breakdown: [
      { place: '1st', prize: '$3,000' },
      { place: '2nd', prize: '$2,000' },
      { place: '3rd', prize: '$1,200' },
      { place: '4-5th', prize: '$600' },
      { place: '6-10th', prize: '$200' },
      { place: '11-25th', prize: '$50' },
    ],
  },
  weekly: {
    total: '$50,000',
    breakdown: [
      { place: '1st', prize: '$15,000' },
      { place: '2nd', prize: '$8,000' },
      { place: '3rd', prize: '$5,000' },
      { place: '4-5th', prize: '$3,000' },
      { place: '6-10th', prize: '$1,000' },
      { place: '11-25th', prize: '$300' },
      { place: '26-50th', prize: '$100' },
    ],
  },
  monthly: {
    total: '$200,000',
    breakdown: [
      { place: '1st', prize: '$50,000' },
      { place: '2nd', prize: '$25,000' },
      { place: '3rd', prize: '$15,000' },
      { place: '4-5th', prize: '$10,000' },
      { place: '6-10th', prize: '$5,000' },
      { place: '11-25th', prize: '$1,500' },
      { place: '26-50th', prize: '$400' },
    ],
  },
}

type Period = 'daily' | 'weekly' | 'monthly'
type SortKey = 'wagered' | 'profit' | 'wins'

export default function LeaderboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [period, setPeriod] = useState<Period>('weekly')
  const [sortKey, setSortKey] = useState<SortKey>('wagered')
  const [showPrizes, setShowPrizes] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const user = useAuthStore(s => s.user)

  // Fetch leaderboard from API
  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/v1/leaderboard/top?period=${period}&sort=${sortKey}&limit=50`)
      .then(res => res.json())
      .then(data => {
        const entries: LeaderboardEntry[] = (data.players || []).map((p: any) => ({
          rank: p.rank,
          username: p.username,
          avatar: AVATARS[p.username.charCodeAt(0) % AVATARS.length],
          wagered: p.wagered,
          profit: p.profit,
          wins: p.wins,
          bets: p.bets,
          winRate: p.bets > 0 ? Math.round((p.wins / p.bets) * 1000) / 10 : 0,
          vipTier: VIP_TIERS[Math.min(6, p.vip_level || 0)],
        }))
        setLeaderboard(entries)
      })
      .catch(() => setLeaderboard([]))
      .finally(() => setLoading(false))
  }, [period, sortKey])

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      let end: Date
      if (period === 'daily') {
        end = new Date(now)
        end.setHours(24, 0, 0, 0)
      } else if (period === 'weekly') {
        end = new Date(now)
        end.setDate(end.getDate() + (7 - end.getDay()))
        end.setHours(0, 0, 0, 0)
      } else {
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      }
      const diff = end.getTime() - now.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(period === 'monthly' ? `${Math.floor(diff / 86400000)}d ${h % 24}h` : `${h}h ${m}m ${s}s`)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [period])

  const prizes = PRIZES[period]

  return (
    <div className="min-h-screen bg-background-deep">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[240px]">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <ChatPanel />
        <MobileNav />

        <div className="p-3 sm:p-5">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center ring-1 ring-brand/20">
                  <Trophy className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Leaderboard</h1>
                  <p className="text-muted text-xs">Compete for {prizes.total} in prizes</p>
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border">
                <Clock className="w-4 h-4 text-brand" />
                <span className="text-xs text-muted">Resets in</span>
                <span className="font-mono font-bold text-white text-sm">{timeLeft}</span>
              </div>
            </div>

            {/* Period tabs */}
            <div className="flex items-center gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-[13px] font-bold transition-all capitalize',
                    period === p
                      ? 'bg-brand/15 text-brand border border-brand/30'
                      : 'bg-surface text-muted border border-border hover:text-white'
                  )}>
                  {p}
                </button>
              ))}
              <div className="flex-1" />
              <button onClick={() => setShowPrizes(!showPrizes)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 transition-all">
                <Trophy className="w-3.5 h-3.5" /> Prizes
              </button>
            </div>

            {/* Prize breakdown (collapsible) */}
            <AnimatePresence>
              {showPrizes && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="bg-surface rounded-2xl border border-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-bold text-white">{prizes.total} Prize Pool</span>
                      <span className="text-[10px] text-muted uppercase tracking-wider">({period})</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {prizes.breakdown.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                          <span className="text-[12px] text-muted font-medium">{p.place}</span>
                          <span className="text-[12px] font-bold text-amber-400 font-mono">{p.prize}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Podium (top 3) */}
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              <Podium entries={leaderboard.slice(0, 3)} />
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider shrink-0">Sort by</span>
              {([
                { key: 'wagered' as SortKey, label: 'Wagered', icon: TrendingUp },
                { key: 'profit' as SortKey, label: 'Profit', icon: Flame },
                { key: 'wins' as SortKey, label: 'Wins', icon: Star },
              ]).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setSortKey(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap',
                    sortKey === key
                      ? 'bg-brand/15 text-brand border border-brand/30'
                      : 'bg-white/[0.03] text-muted border border-white/[0.05] hover:text-white'
                  )}>
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>

            {/* Leaderboard table */}
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 px-4 py-3 border-b border-border text-[10px] font-bold text-muted uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Player</div>
                <div className="col-span-2 text-right">Wagered</div>
                <div className="col-span-2 text-right">Profit</div>
                <div className="col-span-2 text-right hidden sm:block">Wins</div>
                <div className="col-span-2 text-right">Win %</div>
              </div>

              {/* Rows */}
              {leaderboard.map((entry, idx) => {
                const isTop3 = entry.rank <= 3
                const isUser = user && entry.username === user.username

                return (
                  <motion.div
                    key={entry.rank}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      'grid grid-cols-12 px-4 py-2.5 items-center border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]',
                      isTop3 && 'bg-amber-500/[0.03]',
                      isUser && 'bg-brand/[0.05] border-brand/20'
                    )}
                  >
                    {/* Rank */}
                    <div className="col-span-1">
                      {entry.rank <= 3 ? (
                        <span className="text-lg">{['🥇', '🥈', '🥉'][entry.rank - 1]}</span>
                      ) : (
                        <span className="text-sm font-bold text-muted font-mono">{entry.rank}</span>
                      )}
                    </div>

                    {/* Player */}
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      <span className="text-base">{entry.avatar}</span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-white truncate">{entry.username}</div>
                        <div className={`text-[9px] font-bold ${VIP_COLORS[entry.vipTier] || 'text-muted'}`}>{entry.vipTier}</div>
                      </div>
                    </div>

                    {/* Wagered */}
                    <div className="col-span-2 text-right">
                      <span className="text-[13px] font-bold text-white font-mono">
                        ${entry.wagered >= 1000 ? `${(entry.wagered / 1000).toFixed(1)}K` : entry.wagered.toFixed(0)}
                      </span>
                    </div>

                    {/* Profit */}
                    <div className="col-span-2 text-right">
                      <span className={`text-[13px] font-bold font-mono ${entry.profit >= 0 ? 'text-brand' : 'text-accent-red'}`}>
                        {entry.profit >= 0 ? '+' : ''}{entry.profit >= 1000 || entry.profit <= -1000 ? `$${(entry.profit / 1000).toFixed(1)}K` : `$${entry.profit.toFixed(0)}`}
                      </span>
                    </div>

                    {/* Wins */}
                    <div className="col-span-2 text-right hidden sm:block">
                      <span className="text-[12px] text-muted font-mono">{entry.wins}</span>
                    </div>

                    {/* Win % */}
                    <div className="col-span-2 text-right">
                      <span className="text-[12px] text-muted font-mono">{entry.winRate}%</span>
                    </div>
                  </motion.div>
                )
              })}

              {leaderboard.length === 0 && !loading && (
                <div className="px-4 py-8 text-center text-muted text-sm">No data yet. Start playing to appear on the leaderboard!</div>
              )}
              {loading && (
                <div className="px-4 py-8 text-center text-muted text-sm">Loading leaderboard...</div>
              )}
            </div>

            {/* How it works */}
            <div className="bg-surface rounded-2xl border border-border p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-brand" /> How the Race Works
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { step: '1', title: 'Play Games', desc: 'Every bet on any NeonBet Original contributes to your race wager total.' },
                  { step: '2', title: 'Climb the Board', desc: 'Higher wagered amount = higher rank. Updated in real-time.' },
                  { step: '3', title: 'Win Prizes', desc: 'Top players receive cash prizes credited directly to their balance.' },
                ].map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                      <span className="text-brand font-bold text-sm">{s.step}</span>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white">{s.title}</div>
                      <div className="text-[11px] text-muted leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

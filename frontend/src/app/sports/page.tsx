'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { ChatPanel } from '@/components/ChatPanel'
import { useDemoBalance } from '@/stores/demoBalanceStore'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import {
  Trophy, Zap, Star, ChevronRight, ChevronDown, ChevronUp, Search, X,
  Clock, TrendingUp, Shield, Flame, Timer, Target, ArrowRight, Ticket,
  CircleDot, RefreshCw, Trash2, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ───────────────────────────────────────────── */
interface Market {
  id: string
  name: string
  odds: number
  suspended?: boolean
}

interface MatchEvent {
  id: string
  sport: string
  league: string
  homeTeam: string
  awayTeam: string
  startTime: string
  isLive: boolean
  liveMinute?: number
  homeScore?: number
  awayScore?: number
  markets: {
    matchWinner: Market[]
    overUnder?: Market[]
    bothTeamsScore?: Market[]
    handicap?: Market[]
  }
  featured?: boolean
}

interface BetSlipItem {
  matchId: string
  marketId: string
  matchLabel: string
  selection: string
  odds: number
}

/* ── Sport Icons ─────────────────────────────────────── */
const SPORT_ICONS: Record<string, string> = {
  football: '⚽', basketball: '🏀', tennis: '🎾', ufc: '🥊',
  esports: '🎮', baseball: '⚾', hockey: '🏒', cricket: '🏏',
  volleyball: '🏐', rugby: '🏉', f1: '🏎️', boxing: '🥊',
}

/* ── Mock Data Generator ─────────────────────────────── */
function generateOdds(base: number, spread = 0.4): number {
  return Math.max(1.05, +(base + (Math.random() - 0.5) * spread).toFixed(2))
}

function generateMatches(): MatchEvent[] {
  const now = new Date()
  return [
    // LIVE Football
    {
      id: 'fb-1', sport: 'football', league: 'Premier League',
      homeTeam: 'Arsenal', awayTeam: 'Liverpool',
      startTime: new Date(now.getTime() - 45 * 60000).toISOString(),
      isLive: true, liveMinute: 67, homeScore: 2, awayScore: 1,
      markets: {
        matchWinner: [
          { id: 'fb1-h', name: 'Arsenal', odds: 1.55 },
          { id: 'fb1-d', name: 'Draw', odds: 4.20 },
          { id: 'fb1-a', name: 'Liverpool', odds: 5.10 },
        ],
        overUnder: [
          { id: 'fb1-o25', name: 'Over 3.5', odds: 1.72 },
          { id: 'fb1-u25', name: 'Under 3.5', odds: 2.10 },
        ],
      },
      featured: true,
    },
    {
      id: 'fb-2', sport: 'football', league: 'La Liga',
      homeTeam: 'Real Madrid', awayTeam: 'Barcelona',
      startTime: new Date(now.getTime() - 20 * 60000).toISOString(),
      isLive: true, liveMinute: 23, homeScore: 0, awayScore: 0,
      markets: {
        matchWinner: [
          { id: 'fb2-h', name: 'Real Madrid', odds: 2.35 },
          { id: 'fb2-d', name: 'Draw', odds: 3.30 },
          { id: 'fb2-a', name: 'Barcelona', odds: 2.85 },
        ],
        overUnder: [
          { id: 'fb2-o25', name: 'Over 2.5', odds: 1.85 },
          { id: 'fb2-u25', name: 'Under 2.5', odds: 1.95 },
        ],
        bothTeamsScore: [
          { id: 'fb2-btsy', name: 'Yes', odds: 1.72 },
          { id: 'fb2-btsn', name: 'No', odds: 2.05 },
        ],
      },
      featured: true,
    },
    {
      id: 'fb-3', sport: 'football', league: 'Champions League',
      homeTeam: 'Bayern Munich', awayTeam: 'PSG',
      startTime: new Date(now.getTime() + 2 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'fb3-h', name: 'Bayern', odds: 1.90 },
          { id: 'fb3-d', name: 'Draw', odds: 3.60 },
          { id: 'fb3-a', name: 'PSG', odds: 3.80 },
        ],
        overUnder: [
          { id: 'fb3-o25', name: 'Over 2.5', odds: 1.65 },
          { id: 'fb3-u25', name: 'Under 2.5', odds: 2.20 },
        ],
      },
    },
    {
      id: 'fb-4', sport: 'football', league: 'Serie A',
      homeTeam: 'AC Milan', awayTeam: 'Inter Milan',
      startTime: new Date(now.getTime() + 5 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'fb4-h', name: 'AC Milan', odds: 2.80 },
          { id: 'fb4-d', name: 'Draw', odds: 3.25 },
          { id: 'fb4-a', name: 'Inter', odds: 2.45 },
        ],
      },
    },
    {
      id: 'fb-5', sport: 'football', league: 'Bundesliga',
      homeTeam: 'Dortmund', awayTeam: 'RB Leipzig',
      startTime: new Date(now.getTime() + 24 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'fb5-h', name: 'Dortmund', odds: 2.10 },
          { id: 'fb5-d', name: 'Draw', odds: 3.50 },
          { id: 'fb5-a', name: 'Leipzig', odds: 3.20 },
        ],
      },
    },
    // Basketball
    {
      id: 'bb-1', sport: 'basketball', league: 'NBA',
      homeTeam: 'LA Lakers', awayTeam: 'Boston Celtics',
      startTime: new Date(now.getTime() - 30 * 60000).toISOString(),
      isLive: true, liveMinute: 0, homeScore: 78, awayScore: 82,
      markets: {
        matchWinner: [
          { id: 'bb1-h', name: 'Lakers', odds: 2.20 },
          { id: 'bb1-a', name: 'Celtics', odds: 1.65 },
        ],
        overUnder: [
          { id: 'bb1-o', name: 'Over 215.5', odds: 1.90 },
          { id: 'bb1-u', name: 'Under 215.5', odds: 1.90 },
        ],
      },
      featured: true,
    },
    {
      id: 'bb-2', sport: 'basketball', league: 'NBA',
      homeTeam: 'Golden State', awayTeam: 'Milwaukee',
      startTime: new Date(now.getTime() + 3 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'bb2-h', name: 'Warriors', odds: 1.80 },
          { id: 'bb2-a', name: 'Bucks', odds: 2.00 },
        ],
        overUnder: [
          { id: 'bb2-o', name: 'Over 228.5', odds: 1.85 },
          { id: 'bb2-u', name: 'Under 228.5', odds: 1.95 },
        ],
      },
    },
    {
      id: 'bb-3', sport: 'basketball', league: 'EuroLeague',
      homeTeam: 'Real Madrid', awayTeam: 'Fenerbahce',
      startTime: new Date(now.getTime() + 6 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'bb3-h', name: 'Real Madrid', odds: 1.45 },
          { id: 'bb3-a', name: 'Fenerbahce', odds: 2.65 },
        ],
      },
    },
    // Tennis
    {
      id: 'tn-1', sport: 'tennis', league: 'ATP Masters',
      homeTeam: 'C. Alcaraz', awayTeam: 'N. Djokovic',
      startTime: new Date(now.getTime() - 90 * 60000).toISOString(),
      isLive: true, liveMinute: 0, homeScore: 6, awayScore: 4,
      markets: {
        matchWinner: [
          { id: 'tn1-h', name: 'Alcaraz', odds: 1.72 },
          { id: 'tn1-a', name: 'Djokovic', odds: 2.10 },
        ],
        overUnder: [
          { id: 'tn1-o', name: 'Over 22.5 games', odds: 1.85 },
          { id: 'tn1-u', name: 'Under 22.5 games', odds: 1.95 },
        ],
      },
    },
    {
      id: 'tn-2', sport: 'tennis', league: 'WTA 1000',
      homeTeam: 'I. Swiatek', awayTeam: 'A. Sabalenka',
      startTime: new Date(now.getTime() + 4 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'tn2-h', name: 'Swiatek', odds: 1.60 },
          { id: 'tn2-a', name: 'Sabalenka', odds: 2.30 },
        ],
      },
    },
    // UFC
    {
      id: 'ufc-1', sport: 'ufc', league: 'UFC 310',
      homeTeam: 'I. Adesanya', awayTeam: 'A. Pereira',
      startTime: new Date(now.getTime() + 48 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'ufc1-h', name: 'Adesanya', odds: 2.40 },
          { id: 'ufc1-a', name: 'Pereira', odds: 1.58 },
        ],
      },
    },
    // Esports
    {
      id: 'es-1', sport: 'esports', league: 'CS2 Major',
      homeTeam: 'FaZe Clan', awayTeam: 'Natus Vincere',
      startTime: new Date(now.getTime() + 1 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'es1-h', name: 'FaZe', odds: 2.15 },
          { id: 'es1-a', name: 'NAVI', odds: 1.70 },
        ],
        overUnder: [
          { id: 'es1-o', name: 'Over 2.5 maps', odds: 2.05 },
          { id: 'es1-u', name: 'Under 2.5 maps', odds: 1.75 },
        ],
      },
    },
    {
      id: 'es-2', sport: 'esports', league: 'LoL Worlds',
      homeTeam: 'T1', awayTeam: 'Gen.G',
      startTime: new Date(now.getTime() + 8 * 3600000).toISOString(),
      isLive: false,
      markets: {
        matchWinner: [
          { id: 'es2-h', name: 'T1', odds: 1.55 },
          { id: 'es2-a', name: 'Gen.G', odds: 2.40 },
        ],
      },
    },
  ]
}

/* ── Odds shift simulation ───────────────────────────── */
function useOddsFlicker(matches: MatchEvent[]): MatchEvent[] {
  const [data, setData] = useState(matches)
  useEffect(() => {
    const t = setInterval(() => {
      setData(prev => prev.map(m => {
        if (!m.isLive && Math.random() > 0.3) return m
        return {
          ...m,
          liveMinute: m.isLive ? (m.liveMinute ?? 0) + 1 : undefined,
          markets: {
            ...m.markets,
            matchWinner: m.markets.matchWinner.map(mk => ({
              ...mk,
              odds: Math.max(1.05, +(mk.odds + (Math.random() - 0.5) * 0.08).toFixed(2)),
            })),
          },
        }
      }))
    }, 5000)
    return () => clearInterval(t)
  }, [])
  return data
}

/* ── Format time ─────────────────────────────────────── */
function formatMatchTime(iso: string, isLive: boolean, minute?: number) {
  if (isLive) return `${minute ?? 0}'`
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

/* ── Odds Button ─────────────────────────────────────── */
function OddsButton({ market, selected, onClick }: {
  market: Market, selected: boolean, onClick: () => void
}) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  const [prevOdds, setPrevOdds] = useState(market.odds)

  useEffect(() => {
    if (market.odds !== prevOdds) {
      setFlash(market.odds > prevOdds ? 'up' : 'down')
      setPrevOdds(market.odds)
      const t = setTimeout(() => setFlash(null), 1200)
      return () => clearTimeout(t)
    }
  }, [market.odds, prevOdds])

  return (
    <button
      onClick={onClick}
      disabled={market.suspended}
      className={cn(
        'relative flex flex-col items-center justify-center px-2 py-2.5 rounded-lg text-center transition-all duration-200 min-w-0',
        'border',
        selected
          ? 'bg-brand/15 border-brand/40 ring-1 ring-brand/20'
          : 'bg-surface/80 border-border/60 hover:border-brand/30 hover:bg-surface',
        market.suspended && 'opacity-40 cursor-not-allowed',
        flash === 'up' && 'ring-1 ring-green-400/40',
        flash === 'down' && 'ring-1 ring-red-400/40',
      )}
    >
      <span className="text-[10px] text-muted truncate w-full">{market.name}</span>
      <span className={cn(
        'text-[14px] font-bold font-mono tabular-nums mt-0.5',
        selected ? 'text-brand' :
        flash === 'up' ? 'text-green-400' :
        flash === 'down' ? 'text-red-400' :
        'text-white'
      )}>
        {market.odds.toFixed(2)}
      </span>
    </button>
  )
}

/* ================================================================== */
/* SPORTSBOOK PAGE                                                     */
/* ================================================================== */
export default function SportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSport, setActiveSport] = useState('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([])
  const [betAmount, setBetAmount] = useState('10.00')
  const [betSlipOpen, setBetSlipOpen] = useState(true)
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)

  const { isAuthenticated } = useAuthStore()
  const { balance: demoBalance, deduct, credit, refill } = useDemoBalance()

  const rawMatches = useMemo(() => generateMatches(), [])
  const matches = useOddsFlicker(rawMatches)

  const sports = useMemo(() => {
    const s = new Map<string, number>()
    matches.forEach(m => s.set(m.sport, (s.get(m.sport) || 0) + 1))
    return [{ key: 'all', label: 'All Sports', count: matches.length }, ...Array.from(s.entries()).map(([k, v]) => ({
      key: k, label: k.charAt(0).toUpperCase() + k.slice(1), count: v,
    }))]
  }, [matches])

  const filtered = useMemo(() => {
    let f = matches
    if (activeSport !== 'all') f = f.filter(m => m.sport === activeSport)
    if (activeFilter === 'live') f = f.filter(m => m.isLive)
    if (activeFilter === 'upcoming') f = f.filter(m => !m.isLive)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      f = f.filter(m =>
        m.homeTeam.toLowerCase().includes(q) ||
        m.awayTeam.toLowerCase().includes(q) ||
        m.league.toLowerCase().includes(q)
      )
    }
    return f
  }, [matches, activeSport, activeFilter, searchQuery])

  const liveCount = matches.filter(m => m.isLive).length
  const featured = matches.filter(m => m.featured)

  const toggleSelection = useCallback((match: MatchEvent, market: Market) => {
    setBetSlip(prev => {
      const exists = prev.find(b => b.marketId === market.id)
      if (exists) return prev.filter(b => b.marketId !== market.id)
      return [...prev, {
        matchId: match.id,
        marketId: market.id,
        matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
        selection: market.name,
        odds: market.odds,
      }]
    })
  }, [])

  const isSelected = (marketId: string) => betSlip.some(b => b.marketId === marketId)

  const totalOdds = betSlip.reduce((acc, b) => acc * b.odds, 1)
  const potentialWin = totalOdds * parseFloat(betAmount || '0')

  const placeBet = () => {
    const amt = parseFloat(betAmount)
    if (betSlip.length === 0) return toast.error('Add selections to your bet slip')
    if (amt <= 0 || isNaN(amt)) return toast.error('Invalid bet amount')
    if (!isAuthenticated && demoBalance < amt) return toast.error('Insufficient balance! Refill your demo balance.')

    if (!isAuthenticated) deduct(amt)

    // Simulate outcome
    const won = Math.random() < (1 / totalOdds) * 0.97
    if (won) {
      const winnings = amt * totalOdds
      if (!isAuthenticated) credit(winnings)
      toast.success(`Winner! You won $${winnings.toFixed(2)} at ${totalOdds.toFixed(2)}x`)
    } else {
      toast.error(`Bet lost. Better luck next time!`)
    }
    setBetSlip([])
  }

  const removeFromSlip = (marketId: string) => {
    setBetSlip(prev => prev.filter(b => b.marketId !== marketId))
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-5">

            {/* ── Header ────────────────────────────── */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Sportsbook</h1>
                  <p className="text-[11px] text-muted">Live odds &bull; Pre-match &bull; Instant payouts</p>
                </div>
              </div>
              {liveCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <span className="text-[12px] font-bold text-red-400">{liveCount} LIVE</span>
                </div>
              )}
            </div>

            {/* ── Featured Live Matches ──────────────── */}
            {featured.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="text-[13px] font-bold text-white">Featured Matches</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {featured.map(match => (
                    <div key={match.id}
                      className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-surface via-background-secondary to-surface">
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: 'radial-gradient(ellipse at top right, rgba(0,232,123,0.04), transparent 60%)' }} />
                      <div className="relative z-10 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{SPORT_ICONS[match.sport] || '🏆'}</span>
                            <span className="text-[11px] text-muted font-medium">{match.league}</span>
                          </div>
                          {match.isLive && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/15 border border-red-500/25 rounded-md">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                              <span className="text-[10px] font-bold text-red-400">{match.liveMinute}&apos;</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex-1 text-center">
                            <div className="text-[15px] font-bold text-white">{match.homeTeam}</div>
                            {match.isLive && (
                              <div className="text-2xl font-black text-brand mt-1">{match.homeScore}</div>
                            )}
                          </div>
                          <div className="px-3">
                            <span className="text-[11px] font-bold text-muted">VS</span>
                          </div>
                          <div className="flex-1 text-center">
                            <div className="text-[15px] font-bold text-white">{match.awayTeam}</div>
                            {match.isLive && (
                              <div className="text-2xl font-black text-brand mt-1">{match.awayScore}</div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {match.markets.matchWinner.map(mk => (
                            <OddsButton key={mk.id} market={mk}
                              selected={isSelected(mk.id)}
                              onClick={() => toggleSelection(match, mk)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-5">
              {/* ── Left: Sports Nav + Matches ──────── */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Sport pills */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                  {sports.map(s => (
                    <button key={s.key} onClick={() => setActiveSport(s.key)}
                      className={cn(
                        'shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all border',
                        activeSport === s.key
                          ? 'bg-brand/10 text-brand border-brand/20'
                          : 'text-muted-light hover:text-white bg-surface/50 border-border/40 hover:border-border'
                      )}>
                      {SPORT_ICONS[s.key] && <span className="text-sm">{SPORT_ICONS[s.key]}</span>}
                      {s.label}
                      <span className={cn(
                        'ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                        activeSport === s.key ? 'bg-brand/20 text-brand' : 'bg-white/5 text-muted'
                      )}>{s.count}</span>
                    </button>
                  ))}
                </div>

                {/* Filters + Search */}
                <div className="flex items-center gap-2">
                  <div className="flex bg-surface/80 rounded-lg border border-border/60 p-0.5">
                    {(['all', 'live', 'upcoming'] as const).map(f => (
                      <button key={f} onClick={() => setActiveFilter(f)}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-[11px] font-bold capitalize transition-all',
                          activeFilter === f
                            ? 'bg-brand/15 text-brand'
                            : 'text-muted hover:text-white'
                        )}>
                        {f === 'live' && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse" />}
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                    <input type="text" placeholder="Search teams..."
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-[12px] text-white placeholder:text-muted focus:outline-none focus:border-brand/40 transition-all" />
                  </div>
                </div>

                {/* Match List */}
                <div className="space-y-2">
                  {filtered.length === 0 ? (
                    <div className="py-12 text-center text-muted text-sm">No matches found</div>
                  ) : (
                    filtered.map(match => {
                      const isExpanded = expandedMatch === match.id
                      return (
                        <div key={match.id}
                          className="bg-background-secondary rounded-xl border border-border/60 overflow-hidden hover:border-border transition-colors">
                          {/* Match Row */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <span className="text-lg shrink-0">{SPORT_ICONS[match.sport] || '🏆'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] text-muted font-medium">{match.league}</span>
                                {match.isLive ? (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/15 rounded text-[9px] font-bold text-red-400">
                                    <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                                    LIVE {match.liveMinute}&apos;
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] text-muted">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatMatchTime(match.startTime, false)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-white">{match.homeTeam}</span>
                                {match.isLive && (
                                  <span className="text-[13px] font-bold text-brand">{match.homeScore}</span>
                                )}
                                <span className="text-[11px] text-muted">-</span>
                                {match.isLive && (
                                  <span className="text-[13px] font-bold text-brand">{match.awayScore}</span>
                                )}
                                <span className="text-[13px] font-semibold text-white">{match.awayTeam}</span>
                              </div>
                            </div>

                            {/* Quick odds */}
                            <div className="hidden sm:grid gap-1.5" style={{ gridTemplateColumns: `repeat(${match.markets.matchWinner.length}, 72px)` }}>
                              {match.markets.matchWinner.map(mk => (
                                <OddsButton key={mk.id} market={mk}
                                  selected={isSelected(mk.id)}
                                  onClick={() => toggleSelection(match, mk)} />
                              ))}
                            </div>

                            <button onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                              className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface transition-all">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Mobile odds */}
                          <div className="sm:hidden px-4 pb-3">
                            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${match.markets.matchWinner.length}, 1fr)` }}>
                              {match.markets.matchWinner.map(mk => (
                                <OddsButton key={mk.id} market={mk}
                                  selected={isSelected(mk.id)}
                                  onClick={() => toggleSelection(match, mk)} />
                              ))}
                            </div>
                          </div>

                          {/* Expanded markets */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-3">
                                  {match.markets.overUnder && (
                                    <div>
                                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1.5">Over/Under</span>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {match.markets.overUnder.map(mk => (
                                          <OddsButton key={mk.id} market={mk}
                                            selected={isSelected(mk.id)}
                                            onClick={() => toggleSelection(match, mk)} />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {match.markets.bothTeamsScore && (
                                    <div>
                                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1.5">Both Teams to Score</span>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {match.markets.bothTeamsScore.map(mk => (
                                          <OddsButton key={mk.id} market={mk}
                                            selected={isSelected(mk.id)}
                                            onClick={() => toggleSelection(match, mk)} />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* ── Right: Bet Slip ─────────────────── */}
              <div className="hidden lg:block w-[300px] shrink-0">
                <div className="sticky top-[72px]">
                  <div className="bg-background-secondary rounded-xl border border-border/60 overflow-hidden">
                    {/* Slip header */}
                    <button onClick={() => setBetSlipOpen(!betSlipOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-brand" />
                        <span className="text-[13px] font-bold text-white">Bet Slip</span>
                        {betSlip.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-brand/15 text-brand text-[10px] font-bold rounded-md">{betSlip.length}</span>
                        )}
                      </div>
                      {betSlipOpen ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                    </button>

                    <AnimatePresence>
                      {betSlipOpen && (
                        <motion.div
                          initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          {betSlip.length === 0 ? (
                            <div className="p-6 text-center">
                              <Ticket className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                              <p className="text-[12px] text-muted">Click odds to add selections</p>
                            </div>
                          ) : (
                            <div className="p-3 space-y-2">
                              {betSlip.map(item => (
                                <div key={item.marketId}
                                  className="bg-surface/80 rounded-lg p-2.5 border border-border/40">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-[11px] text-muted truncate">{item.matchLabel}</div>
                                      <div className="text-[12px] font-semibold text-white mt-0.5">{item.selection}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-bold font-mono text-brand">{item.odds.toFixed(2)}</span>
                                      <button onClick={() => removeFromSlip(item.marketId)}
                                        className="p-0.5 rounded text-muted hover:text-red-400 transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Bet amount */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Stake</span>
                                  {!isAuthenticated && (
                                    <span className="text-[10px] text-muted font-mono">Balance: ${demoBalance.toFixed(2)}</span>
                                  )}
                                </div>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                                  <input type="text" value={betAmount} onChange={e => setBetAmount(e.target.value)}
                                    className="w-full bg-surface border border-border rounded-lg pl-7 pr-3 py-2.5 font-mono tabular-nums text-[13px] text-white focus:outline-none focus:border-brand/40 transition-all" />
                                </div>
                                <div className="flex gap-1 mt-1.5">
                                  {['5', '10', '25', '50', '100'].map(v => (
                                    <button key={v} onClick={() => setBetAmount(v + '.00')}
                                      className={cn(
                                        'flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all',
                                        betAmount === v + '.00'
                                          ? 'bg-brand/15 text-brand border border-brand/30'
                                          : 'bg-surface border border-border text-muted hover:text-white'
                                      )}>
                                      ${v}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Summary */}
                              <div className="bg-surface/60 rounded-lg p-2.5 space-y-1.5">
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-muted">Selections</span>
                                  <span className="text-white font-medium">{betSlip.length}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-muted">Total Odds</span>
                                  <span className="text-brand font-bold font-mono">{totalOdds.toFixed(2)}x</span>
                                </div>
                                <div className="flex justify-between text-[12px] pt-1 border-t border-border/40">
                                  <span className="text-muted font-medium">Potential Win</span>
                                  <span className="text-brand font-bold font-mono">${potentialWin.toFixed(2)}</span>
                                </div>
                              </div>

                              {/* Place bet */}
                              <button onClick={placeBet}
                                className="w-full py-3 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2"
                                style={{
                                  background: 'linear-gradient(135deg, #00E87B 0%, #00C968 100%)',
                                  color: '#0A0B0F',
                                  boxShadow: '0 4px 20px rgba(0,232,123,0.3)',
                                }}>
                                <Check className="w-4 h-4" />
                                Place Bet ${parseFloat(betAmount || '0').toFixed(2)}
                              </button>

                              <button onClick={() => setBetSlip([])}
                                className="w-full py-2 text-[11px] font-semibold text-muted hover:text-red-400 transition-colors flex items-center justify-center gap-1">
                                <Trash2 className="w-3 h-3" />
                                Clear All
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Demo balance */}
                    {!isAuthenticated && (
                      <div className="px-3 pb-3">
                        <div className="flex items-center justify-between bg-surface/80 rounded-lg p-2.5 border border-border">
                          <div>
                            <div className="text-[10px] text-muted uppercase tracking-wider">Demo Balance</div>
                            <div className="text-sm font-bold text-white font-mono">${demoBalance.toFixed(2)}</div>
                          </div>
                          {demoBalance < 1 && (
                            <button onClick={refill}
                              className="flex items-center gap-1 px-2.5 py-1 bg-brand/10 border border-brand/30 rounded-lg text-brand text-[10px] font-bold hover:bg-brand/20 transition-all">
                              <RefreshCw className="w-3 h-3" />Refill
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Mobile Bet Slip FAB ───────────────── */}
            {betSlip.length > 0 && (
              <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
                <button onClick={placeBet}
                  className="w-full py-3.5 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 shadow-2xl"
                  style={{
                    background: 'linear-gradient(135deg, #00E87B 0%, #00C968 100%)',
                    color: '#0A0B0F',
                  }}>
                  <Ticket className="w-4 h-4" />
                  Place Bet ({betSlip.length}) &bull; ${potentialWin.toFixed(2)}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <ChatPanel />
    </div>
  )
}

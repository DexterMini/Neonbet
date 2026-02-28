'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { ChatPanel } from '@/components/ChatPanel'
import { useChatStore } from '@/stores/chatStore'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronLeft,
  Shield,
  Zap,
  TrendingUp,
  Bomb,
  Dices,
  CircleDot,
  Target,
  RotateCcw,
  Grid3X3,
  Spade,
  Trophy,
  Gift,
  ArrowRight,
  Crown,
  Flame,
  Layers,
  Gem,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Game card config — vibrant thumbnails like Shuffle / Winna          */
/* ------------------------------------------------------------------ */
interface GameCard {
  id: string
  name: string
  href: string
  gradient: string
  icon: React.ElementType
  iconColor: string
  mult: string
  hot?: boolean
  tag?: string
}

const originalGames: GameCard[] = [
  {
    id: 'crash', name: 'Crash', href: '/games/crash', hot: true,
    gradient: 'from-emerald-500 via-emerald-700 to-emerald-900',
    icon: TrendingUp, iconColor: 'text-emerald-200', mult: '∞',
  },
  {
    id: 'mines', name: 'Mines', href: '/games/mines', hot: true,
    gradient: 'from-cyan-500 via-cyan-700 to-cyan-900',
    icon: Bomb, iconColor: 'text-cyan-200', mult: '24x',
  },
  {
    id: 'dice', name: 'Dice', href: '/games/dice',
    gradient: 'from-red-500 via-red-700 to-red-900',
    icon: Dices, iconColor: 'text-red-200', mult: '99x',
  },
  {
    id: 'plinko', name: 'Plinko', href: '/games/plinko',
    gradient: 'from-violet-500 via-violet-700 to-violet-900',
    icon: CircleDot, iconColor: 'text-violet-200', mult: '1000x',
  },
  {
    id: 'limbo', name: 'Limbo', href: '/games/limbo',
    gradient: 'from-sky-500 via-sky-700 to-sky-900',
    icon: Target, iconColor: 'text-sky-200', mult: '1Mx',
  },
  {
    id: 'wheel', name: 'Wheel', href: '/games/wheel',
    gradient: 'from-amber-500 via-amber-700 to-amber-900',
    icon: RotateCcw, iconColor: 'text-amber-200', mult: '50x',
  },
  {
    id: 'keno', name: 'Keno', href: '/games/keno',
    gradient: 'from-green-500 via-green-700 to-green-900',
    icon: Grid3X3, iconColor: 'text-green-200', mult: '40000x',
  },
  {
    id: 'twentyone', name: 'Twenty One', href: '/games/twentyone',
    gradient: 'from-fuchsia-500 via-fuchsia-700 to-fuchsia-900',
    icon: Spade, iconColor: 'text-fuchsia-200', mult: '1500x',
  },
  {
    id: 'coinclimber', name: 'Coin Climber', href: '/games/coinclimber', tag: 'NEW',
    gradient: 'from-yellow-500 via-yellow-700 to-yellow-900',
    icon: Layers, iconColor: 'text-yellow-200', mult: '782x',
  },
  {
    id: 'snake', name: 'Snake', href: '/games/snake', tag: 'NEW',
    gradient: 'from-lime-500 via-lime-700 to-lime-900',
    icon: Gem, iconColor: 'text-lime-200', mult: '100x',
  },
]

const promos = [
  {
    id: 1,
    title: 'ORIGINALS 2.0',
    subtitle: 'Advanced Gamemodes, Full Redesign & Supercharged Speed',
    cta: 'Play Now',
    href: '/games/crash',
    gradient: 'from-brand/30 via-brand/10 to-transparent',
    accent: 'text-brand',
    borderColor: 'border-brand/20',
    icon: Zap,
  },
  {
    id: 2,
    title: '$10,000 DAILY RACE',
    subtitle: 'Wager to climb the leaderboard and win big prizes every day',
    cta: 'Enter Race',
    href: '/promotions',
    gradient: 'from-amber-500/20 via-amber-600/10 to-transparent',
    accent: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    icon: Trophy,
  },
  {
    id: 3,
    title: 'VIP PROGRAM',
    subtitle: 'Unlock exclusive perks, higher limits, and personal VIP host',
    cta: 'Learn More',
    href: '/vip',
    gradient: 'from-purple-500/20 via-purple-600/10 to-transparent',
    accent: 'text-purple-400',
    borderColor: 'border-purple-500/20',
    icon: Crown,
  },
]

/* ---------- Scrollable Row Component ---------- */
function ScrollRow({ children, className }: { children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(true)

  const check = () => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => { check() }, [])

  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 300, behavior: 'smooth' })
    setTimeout(check, 350)
  }

  return (
    <div className={cn('relative group/row', className)}>
      {canLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-lg bg-surface/90 border border-border flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity shadow-soft"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <div
        ref={ref}
        onScroll={check}
        className="flex gap-3 overflow-x-auto scrollbar-none pb-1"
      >
        {children}
      </div>
      {canRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-lg bg-surface/90 border border-border flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity shadow-soft"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/* ---------- Live Bets Data ---------- */
const gameNames = ['Crash', 'Dice', 'Mines', 'Plinko', 'Limbo', 'Wheel', 'Keno', 'Twenty One']
const currencies = ['ETH', 'BTC', 'SOL', 'USDT']

function randomBet() {
  return {
    user: `${Math.random().toString(36).slice(2, 6)}***`,
    game: gameNames[Math.floor(Math.random() * gameNames.length)],
    amount: `${(Math.random() * 2).toFixed(4)}`,
    currency: currencies[Math.floor(Math.random() * currencies.length)],
    mult: `${(Math.random() * 50 + 1.01).toFixed(2)}x`,
    profit: `${(Math.random() * 5).toFixed(4)}`,
    won: Math.random() > 0.45,
    time: 'just now',
  }
}

/* ================================================================== */
/* Home Page                                                           */
/* ================================================================== */
export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activePromo, setActivePromo] = useState(0)
  const [bets, setBets] = useState(() => Array.from({ length: 8 }, randomBet))

  // Rotate promo banners
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePromo((p) => (p + 1) % promos.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Live bets ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setBets((prev) => [randomBet(), ...prev.slice(0, 7)])
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">

          {/* ═══════ Promo Banners ═══════ */}
          <section className="px-4 sm:px-6 pt-5">
            <div className="relative overflow-hidden rounded-xl border border-border/60">
              {promos.map((promo, i) => {
                const Icon = promo.icon
                return (
                  <div
                    key={promo.id}
                    className={cn(
                      'transition-all duration-500',
                      i === activePromo
                        ? 'opacity-100 relative'
                        : 'opacity-0 absolute inset-0 pointer-events-none'
                    )}
                  >
                    <div className={cn(
                      'flex items-center gap-6 p-6 sm:p-8 bg-gradient-to-r',
                      promo.gradient,
                      'border', promo.borderColor, 'rounded-xl'
                    )}>
                      <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-white/5 items-center justify-center shrink-0">
                        <Icon className={cn('w-8 h-8', promo.accent)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-xs font-bold uppercase tracking-widest mb-1', promo.accent)}>
                          Featured
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                          {promo.title}
                        </h2>
                        <p className="text-sm text-muted-light max-w-md">{promo.subtitle}</p>
                      </div>
                      <Link
                        href={promo.href}
                        className={cn(
                          'hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all',
                          'bg-white/10 text-white hover:bg-white/15 border border-white/10'
                        )}
                      >
                        {promo.cta} <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                )
              })}

              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {promos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePromo(i)}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-all',
                      i === activePromo ? 'bg-white w-4' : 'bg-white/30'
                    )}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ═══════ Category Tabs (Horizontal — like Shuffle/Thrill) ═══════ */}
          <section className="px-4 sm:px-6 pt-5 pb-2">
            <ScrollRow>
              {[
                { label: 'Originals', icon: Zap, color: 'text-brand', active: true },
                { label: 'Slots', icon: Flame, color: 'text-accent-purple' },
                { label: 'Live Casino', icon: Shield, color: 'text-accent-red' },
                { label: 'Game Shows', icon: Gift, color: 'text-accent-amber' },
                { label: 'Table Games', icon: Spade, color: 'text-accent-blue' },
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.label}
                    className={cn(
                      'shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all',
                      tab.active
                        ? 'bg-brand/10 text-brand border border-brand/20'
                        : 'text-muted-light hover:text-white hover:bg-surface border border-transparent'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', tab.active ? 'text-brand' : tab.color)} />
                    {tab.label}
                  </button>
                )
              })}
            </ScrollRow>
          </section>

          {/* ═══════ Originals Row ═══════ */}
          <section className="px-4 sm:px-6 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand" />
                <h2 className="text-[15px] font-bold text-white">NeonBet Originals</h2>
              </div>
              <Link href="/" className="text-xs text-muted-light hover:text-brand flex items-center gap-1 transition-colors">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <ScrollRow>
              {originalGames.map((game) => {
                const Icon = game.icon
                return (
                  <Link
                    key={game.id}
                    href={game.href}
                    className="shrink-0 group"
                  >
                    <div className={cn(
                      'relative w-[140px] sm:w-[160px] aspect-[3/4] rounded-xl overflow-hidden',
                      'hover:scale-[1.04] hover:shadow-lg hover:shadow-black/40',
                      'transition-all duration-200'
                    )}>
                      {/* Gradient background */}
                      <div className={cn(
                        'absolute inset-0 bg-gradient-to-br',
                        game.gradient,
                        'opacity-90'
                      )} />

                      {/* Pattern overlay */}
                      <div className="absolute inset-0 opacity-[0.08]"
                        style={{
                          backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)',
                          backgroundSize: '16px 16px',
                        }}
                      />

                      {/* Icon center */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Icon className={cn('w-7 h-7 sm:w-8 sm:h-8', game.iconColor)} />
                        </div>
                      </div>

                      {/* Multiplier top-right */}
                      <div className="absolute top-2 right-2">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-black/40 backdrop-blur-sm text-white rounded">
                          {game.mult}
                        </span>
                      </div>

                      {/* Tags — HOT / NEW */}
                      {(game.hot || game.tag) && (
                        <span className={cn(
                          'absolute top-2 left-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded',
                          game.hot
                            ? 'bg-red-500/90 text-white'
                            : 'bg-brand/90 text-background-deep'
                        )}>
                          {game.hot ? 'HOT' : game.tag}
                        </span>
                      )}

                      {/* Game name at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-sm font-bold text-white">{game.name}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </ScrollRow>
          </section>

          {/* ═══════ Popular Slots Row (placeholder) ═══════ */}
          <section className="px-4 sm:px-6 pt-5 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-accent-amber" />
                <h2 className="text-[15px] font-bold text-white">Popular Games</h2>
              </div>
              <Link href="/" className="text-xs text-muted-light hover:text-brand flex items-center gap-1 transition-colors">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <ScrollRow>
              {[
                { name: 'Gates of Olympus', gradient: 'from-yellow-600 via-amber-800 to-yellow-900', icon: Zap },
                { name: 'Sweet Bonanza', gradient: 'from-pink-500 via-pink-700 to-rose-900', icon: Gift },
                { name: 'Big Bass', gradient: 'from-blue-500 via-blue-700 to-indigo-900', icon: Target },
                { name: 'Wanted Dead', gradient: 'from-orange-500 via-orange-700 to-red-900', icon: Flame },
                { name: 'Sugar Rush', gradient: 'from-fuchsia-400 via-pink-600 to-purple-900', icon: Zap },
                { name: 'Dog House', gradient: 'from-teal-500 via-teal-700 to-emerald-900', icon: Shield },
                { name: 'Lightning Roulette', gradient: 'from-yellow-400 via-yellow-700 to-amber-900', icon: Zap },
                { name: 'Fire Stampede', gradient: 'from-red-500 via-red-700 to-orange-900', icon: Flame },
              ].map((slot, i) => {
                const Icon = slot.icon
                return (
                  <div
                    key={i}
                    className="shrink-0 group cursor-pointer"
                  >
                    <div className={cn(
                      'relative w-[140px] sm:w-[160px] aspect-[3/4] rounded-xl overflow-hidden',
                      'hover:scale-[1.04] hover:shadow-lg hover:shadow-black/40',
                      'transition-all duration-200'
                    )}>
                      <div className={cn('absolute inset-0 bg-gradient-to-br', slot.gradient)} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Icon className="w-6 h-6 text-white/80" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-xs font-bold text-white">{slot.name}</p>
                        <p className="text-[10px] text-white/50">Pragmatic Play</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </ScrollRow>
          </section>

          {/* ═══════ Live Bets Feed ═══════ */}
          <section className="px-4 sm:px-6 pt-6 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-brand rounded-full animate-pulse-subtle" />
              <h2 className="text-[15px] font-bold text-white">Live Bets</h2>
            </div>

            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-border/60">
                <span>Game</span>
                <span>Player</span>
                <span className="text-right">Bet</span>
                <span className="text-right">Mult</span>
                <span className="text-right">Payout</span>
              </div>

              {/* Bet rows */}
              <div className="divide-y divide-border/40">
                {bets.map((bet, i) => (
                  <div
                    key={i}
                    className={cn(
                      'grid grid-cols-5 gap-2 px-4 py-2.5 text-[13px] transition-all',
                      i === 0 && 'animate-fade-in',
                      'hover:bg-white/[0.02]'
                    )}
                  >
                    <span className="text-white font-medium truncate">{bet.game}</span>
                    <span className="text-muted-light font-mono text-xs truncate">{bet.user}</span>
                    <span className="text-right text-muted-light">
                      {bet.amount} <span className="text-muted text-[11px]">{bet.currency}</span>
                    </span>
                    <span className={cn(
                      'text-right font-mono font-semibold',
                      bet.won ? 'text-brand' : 'text-muted'
                    )}>
                      {bet.mult}
                    </span>
                    <span className={cn(
                      'text-right font-mono',
                      bet.won ? 'text-brand' : 'text-accent-red'
                    )}>
                      {bet.won ? `+${bet.profit}` : `-${bet.amount}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════ Trust / Provably Fair Section ═══════ */}
          <section className="px-4 sm:px-6 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: Shield, color: 'text-brand', bg: 'bg-brand/[0.08]',
                  title: 'Provably Fair',
                  desc: 'HMAC-SHA256 cryptographic proofs. Verify every outcome.',
                },
                {
                  icon: Zap, color: 'text-accent-amber', bg: 'bg-accent-amber/[0.08]',
                  title: 'Instant Payouts',
                  desc: 'Wins credited immediately. No delays, no holds.',
                },
                {
                  icon: TrendingUp, color: 'text-accent-blue', bg: 'bg-accent-blue/[0.08]',
                  title: 'Transparent Edge',
                  desc: 'House edge published for every game. Typically 1% or lower.',
                },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-start gap-3 p-4 bg-surface border border-border rounded-xl">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', item.bg)}>
                      <Icon className={cn('w-4.5 h-4.5', item.color)} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-0.5">{item.title}</h3>
                      <p className="text-[12px] text-muted-light leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ═══════ Footer ═══════ */}
          <footer className="px-4 sm:px-6 py-5 border-t border-border/60">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted">
              <div className="flex items-center gap-4">
                <span>&copy; {new Date().getFullYear()} NeonBet</span>
                <a href="#" className="hover:text-muted-light transition-colors">Terms</a>
                <a href="#" className="hover:text-muted-light transition-colors">Privacy</a>
                <a href="#" className="hover:text-muted-light transition-colors">Fairness</a>
              </div>
              <div className="flex items-center gap-3">
                <span>18+</span>
                <span className="w-px h-3 bg-border" />
                <span>Play Responsibly</span>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Chat Panel */}
      <ChatPanel />
    </div>
  )
}

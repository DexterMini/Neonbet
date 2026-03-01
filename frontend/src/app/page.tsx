'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { ChatPanel } from '@/components/ChatPanel'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronLeft,
  Shield,
  Zap,
  TrendingUp,
  Trophy,
  Gift,
  ArrowRight,
  Crown,
  Flame,
  Star,
  Search,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Premium Game Card Visuals (CSS-only game art)                       */
/* ------------------------------------------------------------------ */

function CrashVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute bottom-[20%] left-[15%] w-[70%] h-[2px] bg-gradient-to-r from-transparent via-white/40 to-white/80 rounded-full rotate-[-35deg] origin-left" />
      <div className="absolute bottom-[22%] left-[16%] w-[60%] h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 to-emerald-400/60 rounded-full rotate-[-35deg] origin-left" />
      <div className="absolute top-[22%] right-[18%]">
        <div className="w-10 h-10 relative">
          <div className="absolute inset-0 bg-white/90 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.4)]" style={{clipPath: 'polygon(50% 0%, 85% 70%, 50% 55%, 15% 70%)'}} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-6 bg-gradient-to-b from-orange-400 to-transparent rounded-b-full opacity-80" />
        </div>
      </div>
      <div className="absolute bottom-[28%] left-1/2 -translate-x-1/2">
        <span className="text-3xl font-black text-white/20 font-mono tracking-tighter">1.00x</span>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="absolute w-1 h-1 bg-white/30 rounded-full" style={{
          top: `${15 + i * 15}%`, left: `${10 + i * 18}%`,
        }} />
      ))}
    </div>
  )
}

function MinesVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid grid-cols-3 gap-1.5 rotate-[8deg] scale-110">
        {[0,1,2,3,4,5,6,7,8].map(i => (
          <div key={i} className={cn(
            "w-8 h-8 rounded-md",
            i === 4 ? "bg-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.4)]" :
            i === 1 || i === 6 || i === 8 ? "bg-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
            "bg-white/10"
          )}>
            {i === 4 && <div className="w-full h-full flex items-center justify-center text-red-300 text-lg font-bold">*</div>}
            {(i === 1 || i === 6 || i === 8) && <div className="w-full h-full flex items-center justify-center text-emerald-300 text-xs">&#9670;</div>}
          </div>
        ))}
      </div>
      <div className="absolute top-[15%] right-[15%] w-6 h-6">
        <div className="w-full h-full bg-gradient-to-br from-cyan-300/40 to-cyan-500/20 rotate-45 rounded-sm" />
      </div>
    </div>
  )
}

function DiceVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%]">
        <div className="w-16 h-16 bg-white/15 rounded-xl rotate-[15deg] shadow-[0_0_40px_rgba(255,255,255,0.1)] backdrop-blur-sm border border-white/20">
          <div className="grid grid-cols-3 grid-rows-3 gap-1 p-2.5 h-full">
            {[0,1,0,1,0,1,0,1,0].map((dot, i) => (
              <div key={i} className={cn("rounded-full", dot ? "bg-white/80" : "")} />
            ))}
          </div>
        </div>
      </div>
      <div className="absolute top-[25%] right-[20%] w-10 h-10 bg-white/8 rounded-lg rotate-[-20deg] border border-white/10">
        <div className="grid grid-cols-2 gap-1 p-1.5 h-full">
          {[1,0,0,1].map((dot, i) => (
            <div key={i} className={cn("rounded-full", dot ? "bg-white/50" : "")} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PlinkoVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {[0,1,2,3,4].map(row => (
        <div key={row} className="absolute flex justify-center gap-3" style={{ top: `${20 + row * 15}%`, left: '50%', transform: 'translateX(-50%)' }}>
          {Array.from({ length: row + 3 }, (_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/25" />
          ))}
        </div>
      ))}
      <div className="absolute top-[30%] left-[48%] w-3 h-3 rounded-full bg-brand/80 shadow-[0_0_15px_rgba(0,232,123,0.5)]" />
      <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 flex gap-1">
        {['#ef4444','#f97316','#eab308','#22c55e','#eab308','#f97316','#ef4444'].map((c, i) => (
          <div key={i} className="w-4 h-3 rounded-t-sm opacity-40" style={{ background: c }} />
        ))}
      </div>
    </div>
  )
}

function LimboVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl font-black text-white/15 font-mono tracking-tighter">1.5x</span>
        <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent blur-xl" />
      </div>
      <div className="absolute top-[40%] left-[10%] right-[10%] h-[1px] bg-amber-400/30 border-dashed" />
      <div className="absolute top-[40%] right-[12%] w-2 h-2 rounded-full bg-amber-400/50" />
    </div>
  )
}

function WheelVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full rotate-[20deg]">
          {[0,1,2,3,4,5,6,7].map(i => {
            const colors = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
            const angle = i * 45
            const rad = (angle * Math.PI) / 180
            const rad2 = ((angle + 45) * Math.PI) / 180
            return (
              <path key={i}
                d={`M50,50 L${50 + 45 * Math.cos(rad)},${50 + 45 * Math.sin(rad)} A45,45 0 0,1 ${50 + 45 * Math.cos(rad2)},${50 + 45 * Math.sin(rad2)} Z`}
                fill={colors[i]} opacity={0.4} />
            )
          })}
          <circle cx="50" cy="50" r="8" fill="white" opacity={0.2} />
        </svg>
      </div>
      <div className="absolute top-[14%] left-1/2 -translate-x-1/2 w-3 h-4 bg-white/50" style={{clipPath: 'polygon(50% 100%, 0 0, 100% 0)'}} />
    </div>
  )
}

function KenoVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid grid-cols-5 gap-1 rotate-[5deg] scale-90">
        {Array.from({ length: 25 }, (_, i) => {
          const hit = [2, 7, 11, 13, 18, 22].includes(i)
          return (
            <div key={i} className={cn(
              "w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center",
              hit ? "bg-brand/40 text-brand shadow-[0_0_8px_rgba(0,232,123,0.3)]" : "bg-white/8 text-white/20"
            )}>
              {i + 1}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TwentyOneVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%]">
        <div className="absolute -left-5 -rotate-[12deg] w-12 h-16 bg-white/15 rounded-lg border border-white/20 flex items-center justify-center">
          <span className="text-xl font-black text-red-400/80">A</span>
        </div>
        <div className="absolute left-3 rotate-[8deg] w-12 h-16 bg-white/15 rounded-lg border border-white/20 flex items-center justify-center">
          <span className="text-xl font-black text-white/60">K</span>
        </div>
      </div>
      <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500/20 rounded-full border border-amber-500/30">
        <span className="text-sm font-black text-amber-400/70">21</span>
      </div>
    </div>
  )
}

function CoinClimberVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="absolute flex items-center gap-1" style={{
          bottom: `${18 + i * 15}%`, left: `${20 + i * 8}%`
        }}>
          <div className={cn(
            "w-10 h-4 rounded",
            i < 3 ? "bg-brand/20 border border-brand/30" : "bg-amber-500/15 border border-amber-500/20"
          )} />
          {i === 2 && <div className="w-3 h-3 rounded-full bg-amber-400/50 shadow-[0_0_8px_rgba(251,191,36,0.3)]" />}
        </div>
      ))}
      <div className="absolute top-[15%] right-[12%] text-xs font-bold text-white/15 font-mono">782x</div>
      <div className="absolute top-[35%] right-[15%] text-[10px] font-bold text-white/10 font-mono">250x</div>
    </div>
  )
}

function SnakeVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        <path d="M 20 70 Q 35 55 50 65 Q 65 75 75 55 Q 82 40 70 30"
          stroke="rgba(0,232,123,0.4)" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="70" cy="30" r="4" fill="rgba(0,232,123,0.5)" />
        <circle cx="69" cy="28.5" r="1" fill="white" opacity="0.6" />
        <circle cx="72" cy="28.5" r="1" fill="white" opacity="0.6" />
      </svg>
      <div className="absolute top-[25%] left-[25%] w-3 h-3 bg-emerald-400/40 rotate-45 rounded-sm shadow-[0_0_10px_rgba(52,211,153,0.3)]" />
      <div className="absolute top-[55%] right-[30%] w-2 h-2 bg-emerald-400/30 rotate-45 rounded-sm" />
    </div>
  )
}

function ChickenVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {[0,1,2,3].map(i => (
        <div key={i} className="absolute left-[10%] right-[10%] h-[1px] bg-white/10" style={{ top: `${30 + i * 15}%` }} />
      ))}
      <div className="absolute top-[42%] left-[25%] w-8 h-4 bg-red-500/30 rounded-sm border border-red-500/20" />
      <div className="absolute top-[35%] right-[30%]">
        <div className="w-7 h-7 bg-amber-400/30 rounded-full border border-amber-400/20 flex items-center justify-center">
          <span className="text-amber-300/60 text-[10px] font-bold">B</span>
        </div>
      </div>
      <div className="absolute bottom-[25%] left-[40%] text-brand/30 text-lg">&#10003;</div>
      <div className="absolute bottom-[25%] right-[25%] text-brand/30 text-lg">&#10003;</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Game Card Config                                                    */
/* ------------------------------------------------------------------ */
interface GameCardData {
  id: string
  name: string
  href: string
  gradient: string
  glow: string
  visual: React.FC
  tag?: 'HOT' | 'NEW' | 'POPULAR'
  playing: [number, number]
}

const GAMES: GameCardData[] = [
  {
    id: 'crash', name: 'Crash', href: '/games/crash',
    gradient: 'from-violet-600 via-purple-700 to-indigo-900',
    glow: 'rgba(139,92,246,0.3)',
    visual: CrashVisual,
    tag: 'HOT',
    playing: [700, 1200],
  },
  {
    id: 'mines', name: 'Mines', href: '/games/mines',
    gradient: 'from-rose-500 via-pink-600 to-rose-900',
    glow: 'rgba(244,63,94,0.3)',
    visual: MinesVisual,
    tag: 'HOT',
    playing: [1800, 2500],
  },
  {
    id: 'dice', name: 'Dice', href: '/games/dice',
    gradient: 'from-emerald-400 via-green-600 to-teal-800',
    glow: 'rgba(52,211,153,0.3)',
    visual: DiceVisual,
    tag: 'POPULAR',
    playing: [1400, 2000],
  },
  {
    id: 'plinko', name: 'Plinko', href: '/games/plinko',
    gradient: 'from-fuchsia-500 via-purple-600 to-violet-900',
    glow: 'rgba(217,70,239,0.3)',
    visual: PlinkoVisual,
    tag: 'POPULAR',
    playing: [1500, 2200],
  },
  {
    id: 'limbo', name: 'Limbo', href: '/games/limbo',
    gradient: 'from-amber-400 via-orange-500 to-amber-800',
    glow: 'rgba(251,191,36,0.3)',
    visual: LimboVisual,
    playing: [900, 1500],
  },
  {
    id: 'wheel', name: 'Wheel', href: '/games/wheel',
    gradient: 'from-sky-400 via-blue-600 to-indigo-800',
    glow: 'rgba(56,189,248,0.3)',
    visual: WheelVisual,
    playing: [600, 1000],
  },
  {
    id: 'keno', name: 'Keno', href: '/games/keno',
    gradient: 'from-teal-400 via-cyan-600 to-teal-900',
    glow: 'rgba(45,212,191,0.3)',
    visual: KenoVisual,
    playing: [400, 800],
  },
  {
    id: 'twentyone', name: 'Twenty\nOne', href: '/games/twentyone',
    gradient: 'from-red-500 via-red-700 to-rose-900',
    glow: 'rgba(239,68,68,0.3)',
    visual: TwentyOneVisual,
    playing: [300, 600],
  },
  {
    id: 'coinclimber', name: 'Coin\nClimber', href: '/games/coinclimber',
    gradient: 'from-yellow-400 via-amber-500 to-yellow-800',
    glow: 'rgba(234,179,8,0.3)',
    visual: CoinClimberVisual,
    tag: 'NEW',
    playing: [500, 900],
  },
  {
    id: 'snake', name: 'Snake', href: '/games/snake',
    gradient: 'from-lime-400 via-emerald-600 to-green-900',
    glow: 'rgba(132,204,22,0.3)',
    visual: SnakeVisual,
    tag: 'NEW',
    playing: [350, 700],
  },
  {
    id: 'chicken', name: 'Chicken', href: '/games/chicken',
    gradient: 'from-orange-400 via-amber-500 to-orange-800',
    glow: 'rgba(251,146,60,0.3)',
    visual: ChickenVisual,
    tag: 'NEW',
    playing: [450, 850],
  },
]

/* ------------------------------------------------------------------ */
/* Hero Promo Banners                                                  */
/* ------------------------------------------------------------------ */
const promos = [
  {
    id: 1,
    title: 'NEONBET ORIGINALS',
    subtitle: '11 provably fair games. Lightning fast. Beautiful design.',
    cta: 'Play Now',
    href: '/games/crash',
    bg: 'from-brand/20 via-emerald-900/30 to-background',
    accent: 'text-brand',
    border: 'border-brand/15',
    icon: Zap,
    glow: 'radial-gradient(ellipse at 30% 50%, rgba(0,232,123,0.12) 0%, transparent 60%)',
  },
  {
    id: 2,
    title: '$10,000 DAILY RACE',
    subtitle: 'Wager to climb the leaderboard. Win prizes every single day.',
    cta: 'Join Race',
    href: '/promotions',
    bg: 'from-amber-500/15 via-amber-900/20 to-background',
    accent: 'text-amber-400',
    border: 'border-amber-500/15',
    icon: Trophy,
    glow: 'radial-gradient(ellipse at 30% 50%, rgba(245,158,11,0.1) 0%, transparent 60%)',
  },
  {
    id: 3,
    title: 'VIP PROGRAM',
    subtitle: 'Exclusive perks, personal host, and up to 25% rakeback.',
    cta: 'Learn More',
    href: '/vip',
    bg: 'from-purple-500/15 via-purple-900/20 to-background',
    accent: 'text-purple-400',
    border: 'border-purple-500/15',
    icon: Crown,
    glow: 'radial-gradient(ellipse at 30% 50%, rgba(168,85,247,0.1) 0%, transparent 60%)',
  },
]

/* ------------------------------------------------------------------ */
/* Scrollable Row                                                      */
/* ------------------------------------------------------------------ */
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
    ref.current?.scrollBy({ left: dir * 340, behavior: 'smooth' })
    setTimeout(check, 400)
  }

  return (
    <div className={cn('relative group/row', className)}>
      {canLeft && (
        <button onClick={() => scroll(-1)}
          className="absolute -left-1 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-xl bg-background/90 border border-border flex items-center justify-center text-white/70 hover:text-white opacity-0 group-hover/row:opacity-100 transition-all shadow-xl backdrop-blur-md">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <div ref={ref} onScroll={check} className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {children}
      </div>
      {canRight && (
        <button onClick={() => scroll(1)}
          className="absolute -right-1 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-xl bg-background/90 border border-border flex items-center justify-center text-white/70 hover:text-white opacity-0 group-hover/row:opacity-100 transition-all shadow-xl backdrop-blur-md">
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Grid Game Card                                                      */
/* ------------------------------------------------------------------ */
function GameCardGrid({ game }: { game: GameCardData }) {
  const Visual = game.visual
  const [playerCount, setPlayerCount] = useState(0)

  useEffect(() => {
    const [min, max] = game.playing
    setPlayerCount(Math.floor(min + Math.random() * (max - min)))
    const t = setInterval(() => {
      setPlayerCount(c => {
        const next = c + Math.floor(Math.random() * 11) - 5
        return Math.max(game.playing[0] - 50, next)
      })
    }, 4000 + Math.random() * 6000)
    return () => clearInterval(t)
  }, [game.playing])

  return (
    <Link href={game.href} className="group block">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 group-hover:scale-[1.04] group-hover:-translate-y-1"
        style={{ boxShadow: `0 4px 20px -4px ${game.glow}, 0 0 0 1px rgba(255,255,255,0.04)` }}>

        <div className={cn('absolute inset-0 bg-gradient-to-br', game.gradient)} />

        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />

        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.12] via-transparent to-black/40" />

        <Visual />

        <div className="absolute top-2 left-2 z-10">
          <div className="px-1.5 py-[2px] bg-black/40 backdrop-blur-md rounded border border-white/10">
            <span className="text-[6px] sm:text-[7px] font-bold text-white/70 uppercase tracking-[0.1em]">NeonBet Originals</span>
          </div>
        </div>

        {game.tag && (
          <div className="absolute top-2 right-2 z-10">
            <div className={cn(
              "px-1.5 py-[2px] rounded text-[7px] sm:text-[8px] font-extrabold uppercase tracking-wide",
              game.tag === 'HOT' ? 'bg-red-500 text-white shadow-[0_2px_10px_rgba(239,68,68,0.5)]' :
              game.tag === 'NEW' ? 'bg-brand text-background-deep shadow-[0_2px_10px_rgba(0,232,123,0.5)]' :
              'bg-amber-500 text-background-deep shadow-[0_2px_10px_rgba(245,158,11,0.4)]'
            )}>
              {game.tag}
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10">
          <h3 className="text-base sm:text-lg font-extrabold text-white uppercase tracking-wide leading-tight whitespace-pre-line drop-shadow-lg">
            {game.name}
          </h3>
        </div>

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent pointer-events-none" />
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 pl-0.5">
        <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
        <span className="text-[10px] sm:text-[11px] text-muted-light font-medium">{playerCount.toLocaleString()} playing</span>
      </div>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Live Bets                                                           */
/* ------------------------------------------------------------------ */
const GAME_NAMES = ['Crash', 'Dice', 'Mines', 'Plinko', 'Limbo', 'Wheel', 'Keno', 'Twenty One', 'Chicken', 'Snake', 'Coin Climber']
const CURRENCIES = ['ETH', 'BTC', 'SOL', 'USDT', 'USDC', 'DOGE']

function randomBet() {
  const won = Math.random() > 0.45
  const amount = (Math.random() * 2 + 0.001).toFixed(4)
  const mult = won ? (Math.random() * 50 + 1.01).toFixed(2) : '0.00'
  return {
    user: `${Math.random().toString(36).slice(2, 5)}***${Math.random().toString(36).slice(2, 4)}`,
    game: GAME_NAMES[Math.floor(Math.random() * GAME_NAMES.length)],
    amount,
    currency: CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
    mult: `${mult}x`,
    profit: won ? `+${(parseFloat(amount) * parseFloat(mult)).toFixed(4)}` : `-${amount}`,
    won,
    time: 'just now',
  }
}

/* ================================================================== */
/* HOME PAGE                                                           */
/* ================================================================== */
export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activePromo, setActivePromo] = useState(0)
  const [bets, setBets] = useState<ReturnType<typeof randomBet>[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('originals')

  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return GAMES
    return GAMES.filter(g => g.name.replace('\n', ' ').toLowerCase().includes(searchQuery.toLowerCase()))
  }, [searchQuery])

  useEffect(() => { setBets(Array.from({ length: 10 }, randomBet)) }, [])

  useEffect(() => {
    const t = setInterval(() => setActivePromo(p => (p + 1) % promos.length), 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setBets(prev => [randomBet(), ...prev.slice(0, 9)]), 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">

          {/* ═══════ Hero Promo Banner ═══════ */}
          <section className="px-3 sm:px-6 pt-4 sm:pt-5">
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]" style={{ minHeight: '140px' }}>
              {promos.map((promo, i) => {
                const Icon = promo.icon
                return (
                  <div key={promo.id} className={cn(
                    'transition-all duration-700 ease-in-out',
                    i === activePromo ? 'opacity-100 relative' : 'opacity-0 absolute inset-0 pointer-events-none'
                  )}>
                    <div className={cn('relative flex items-center gap-5 sm:gap-8 p-5 sm:p-8 bg-gradient-to-r overflow-hidden', promo.bg, 'border', promo.border, 'rounded-2xl')}>
                      <div className="absolute inset-0 pointer-events-none" style={{ background: promo.glow }} />
                      <div className="hidden sm:flex relative z-10 w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] items-center justify-center shrink-0 backdrop-blur-sm">
                        <Icon className={cn('w-7 h-7', promo.accent)} />
                      </div>
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className={cn('text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-1 opacity-80', promo.accent)}>Featured</div>
                        <h2 className="text-lg sm:text-2xl font-extrabold text-white mb-1 tracking-tight">{promo.title}</h2>
                        <p className="text-xs sm:text-sm text-white/50 max-w-md">{promo.subtitle}</p>
                      </div>
                      <Link href={promo.href}
                        className="hidden sm:inline-flex relative z-10 items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/[0.08] transition-all backdrop-blur-sm">
                        {promo.cta} <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                )
              })}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {promos.map((_, i) => (
                  <button key={i} onClick={() => setActivePromo(i)}
                    className={cn('h-1.5 rounded-full transition-all duration-300',
                      i === activePromo ? 'bg-white w-6' : 'bg-white/25 w-1.5 hover:bg-white/40')} />
                ))}
              </div>
            </div>
          </section>

          {/* ═══════ Search + Category Tabs ═══════ */}
          <section className="px-3 sm:px-6 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-xl text-sm text-white placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/30 transition-all"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {[
                  { key: 'originals', label: 'Originals', icon: Zap, color: 'text-brand' },
                  { key: 'slots', label: 'Slots', icon: Flame, color: 'text-purple-400' },
                  { key: 'live', label: 'Live Casino', icon: Star, color: 'text-red-400' },
                  { key: 'table', label: 'Table Games', icon: Gift, color: 'text-amber-400' },
                ].map(tab => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.key
                  return (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all',
                        isActive
                          ? 'bg-brand/10 text-brand border border-brand/20'
                          : 'text-muted-light hover:text-white hover:bg-surface border border-transparent'
                      )}>
                      <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-brand' : tab.color)} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ═══════ Game Grid ═══════ */}
          <section className="px-3 sm:px-6 pt-4 pb-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-brand" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-white tracking-tight">NeonBet Originals</h2>
                  <p className="text-[11px] text-muted">Provably fair games</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-light">
                <span className="hidden sm:inline">Found games: {filteredGames.length}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredGames.map(game => (
                <GameCardGrid key={game.id} game={game} />
              ))}
            </div>
          </section>

          {/* ═══════ Popular Slots placeholder ═══════ */}
          <section className="px-3 sm:px-6 pt-6 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-white tracking-tight">Popular Games</h2>
                  <p className="text-[11px] text-muted">Coming soon</p>
                </div>
              </div>
              <Link href="/" className="text-xs text-muted-light hover:text-brand flex items-center gap-1 transition-colors">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <ScrollRow>
              {[
                { name: 'Gates of\nOlympus', gradient: 'from-yellow-500 via-amber-600 to-yellow-900' },
                { name: 'Sweet\nBonanza', gradient: 'from-pink-400 via-rose-500 to-pink-800' },
                { name: 'Big Bass\nSplash', gradient: 'from-blue-400 via-blue-600 to-indigo-900' },
                { name: 'Wanted\nDead', gradient: 'from-orange-400 via-red-500 to-red-900' },
                { name: 'Sugar\nRush', gradient: 'from-fuchsia-400 via-pink-500 to-purple-800' },
                { name: 'Dog\nHouse', gradient: 'from-teal-400 via-teal-600 to-emerald-900' },
                { name: 'Lightning\nRoulette', gradient: 'from-yellow-300 via-amber-500 to-amber-900' },
                { name: 'Fire\nStampede', gradient: 'from-red-400 via-orange-500 to-red-900' },
              ].map((slot, i) => (
                <div key={i} className="shrink-0 group cursor-pointer">
                  <div className={cn(
                    'relative w-[140px] sm:w-[160px] aspect-[3/4] rounded-2xl overflow-hidden',
                    'group-hover:scale-[1.04] group-hover:shadow-xl transition-all duration-300'
                  )}>
                    <div className={cn('absolute inset-0 bg-gradient-to-br', slot.gradient)} />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] via-transparent to-black/30" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                      <div className="px-3 py-1.5 bg-black/50 rounded-lg border border-white/10">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Coming Soon</span>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                      <p className="text-sm font-extrabold text-white uppercase leading-tight whitespace-pre-line">{slot.name}</p>
                      <p className="text-[9px] text-white/40 mt-0.5">Pragmatic Play</p>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollRow>
          </section>

          {/* ═══════ Live Bets Feed ═══════ */}
          <section className="px-3 sm:px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <span className="absolute inset-0 w-2 h-2 bg-brand rounded-full animate-ping opacity-40" />
                  <span className="relative w-2 h-2 bg-brand rounded-full block" />
                </div>
                <h2 className="text-[15px] font-bold text-white">Live Bets</h2>
              </div>
              <div className="flex gap-1">
                {['All Bets', 'My Bets', 'High Rollers'].map((tab, i) => (
                  <button key={tab} className={cn(
                    'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    i === 0 ? 'bg-surface border border-border text-white' : 'text-muted hover:text-white'
                  )}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface/80 rounded-2xl border border-border overflow-hidden backdrop-blur-sm">
              <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-[10px] font-semibold text-muted uppercase tracking-wider border-b border-border/60">
                <span>Game</span>
                <span>Player</span>
                <span className="text-right">Bet</span>
                <span className="text-right">Mult</span>
                <span className="text-right">Payout</span>
              </div>
              <div className="divide-y divide-border/30">
                {bets.map((bet, i) => (
                  <div key={i} className={cn(
                    'grid grid-cols-5 gap-2 px-4 py-2.5 text-[12px] sm:text-[13px] transition-all hover:bg-white/[0.015]',
                    i === 0 && 'animate-fade-in'
                  )}>
                    <span className="text-white font-medium truncate">{bet.game}</span>
                    <span className="text-muted-light font-mono text-[11px] truncate">{bet.user}</span>
                    <span className="text-right text-muted-light">
                      {bet.amount} <span className="text-muted text-[10px]">{bet.currency}</span>
                    </span>
                    <span className={cn('text-right font-mono font-semibold', bet.won ? 'text-brand' : 'text-muted')}>
                      {bet.mult}
                    </span>
                    <span className={cn('text-right font-mono text-[12px]', bet.won ? 'text-brand' : 'text-red-400/70')}>
                      {bet.profit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════ Trust Section ═══════ */}
          <section className="px-3 sm:px-6 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: Shield, color: 'text-brand', bg: 'bg-brand/[0.06] border-brand/10',
                  title: 'Provably Fair',
                  desc: 'HMAC-SHA256 cryptographic verification. Every bet verifiable.',
                },
                {
                  icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/[0.06] border-amber-400/10',
                  title: 'Instant Payouts',
                  desc: 'Wins credited immediately. Zero delays, zero holds.',
                },
                {
                  icon: TrendingUp, color: 'text-sky-400', bg: 'bg-sky-400/[0.06] border-sky-400/10',
                  title: 'Transparent Edge',
                  desc: 'Published house edge for every game. Full transparency.',
                },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className={cn('flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-sm', item.bg)}>
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                      <Icon className={cn('w-5 h-5', item.color)} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-0.5">{item.title}</h3>
                      <p className="text-[11px] text-muted-light leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ═══════ Footer ═══════ */}
          <footer className="px-4 sm:px-6 py-5 border-t border-border/40">
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

      <ChatPanel />
    </div>
  )
}

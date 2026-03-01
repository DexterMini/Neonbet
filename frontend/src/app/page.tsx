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
/* Premium Game Card Visuals — BOLD, eye-catching game art             */
/* ------------------------------------------------------------------ */

function CrashVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Large graph line shooting up */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 260" preserveAspectRatio="none">
        <defs>
          <linearGradient id="crashLine" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="30%" stopColor="#10b981" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 0 220 Q 40 210 80 180 Q 120 140 140 80 Q 155 30 170 15" fill="none" stroke="url(#crashLine)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 0 220 Q 40 210 80 180 Q 120 140 140 80 Q 155 30 170 15 L 170 260 L 0 260 Z" fill="url(#crashFill)" />
      </svg>
      {/* Rocket at tip */}
      <div className="absolute top-[8%] right-[12%] text-4xl drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]">🚀</div>
      {/* Big multiplier */}
      <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2">
        <span className="text-4xl sm:text-5xl font-black text-white/25 font-mono tracking-tighter select-none">2.4x</span>
      </div>
      {/* Stars */}
      {[{t:15,l:12},{t:30,l:75},{t:50,l:20},{t:10,l:55}].map((s,i) => (
        <div key={i} className="absolute w-1.5 h-1.5 bg-white/50 rounded-full" style={{top:`${s.t}%`,left:`${s.l}%`}} />
      ))}
    </div>
  )
}

function MinesVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      {/* Large 3x3 mine field */}
      <div className="grid grid-cols-3 gap-2 rotate-[6deg] scale-[1.3]">
        {[0,1,2,3,4,5,6,7,8].map(i => {
          const isBomb = i === 4
          const isGem = [1, 5, 7].includes(i)
          const isRevealed = isBomb || isGem
          return (
            <div key={i} className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
              isBomb ? "bg-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.5)] border border-red-400/40" :
              isGem ? "bg-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/30" :
              "bg-white/10 border border-white/10"
            )}>
              {isBomb && <span className="drop-shadow-lg">💣</span>}
              {isGem && <span className="drop-shadow-lg">💎</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DiceVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      {/* Large 3D dice */}
      <div className="relative">
        <div className="w-20 h-20 bg-white/20 rounded-2xl rotate-[18deg] shadow-[0_8px_40px_rgba(255,255,255,0.15)] border-2 border-white/30 backdrop-blur-sm">
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5 p-3 h-full">
            {[1,0,0,0,1,0,0,0,1].map((dot, i) => (
              <div key={i} className={cn("rounded-full transition-all", dot ? "bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "")} />
            ))}
          </div>
        </div>
        {/* Second dice behind */}
        <div className="absolute -top-4 -right-6 w-14 h-14 bg-white/10 rounded-xl rotate-[-15deg] border border-white/15">
          <div className="grid grid-cols-2 gap-1.5 p-2.5 h-full">
            {[1,0,0,1].map((dot, i) => (
              <div key={i} className={cn("rounded-full", dot ? "bg-white/60" : "")} />
            ))}
          </div>
        </div>
      </div>
      {/* Slider bar */}
      <div className="absolute bottom-[18%] left-[10%] right-[10%] h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full w-[65%] bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full" />
      </div>
    </div>
  )
}

function PlinkoVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Peg rows */}
      {[0,1,2,3,4,5].map(row => (
        <div key={row} className="absolute flex justify-center" style={{ top: `${15 + row * 13}%`, left: '50%', transform: 'translateX(-50%)', gap: row < 3 ? '14px' : '10px' }}>
          {Array.from({ length: row + 3 }, (_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-white/40 shadow-[0_0_6px_rgba(255,255,255,0.2)]" />
          ))}
        </div>
      ))}
      {/* Bouncing ball */}
      <div className="absolute top-[28%] left-[52%] w-4 h-4 rounded-full bg-brand shadow-[0_0_20px_rgba(0,232,123,0.7)] border border-white/40" />
      {/* Color buckets at bottom */}
      <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 flex gap-[3px]">
        {['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#22c55e','#eab308','#f97316','#ef4444'].map((c, i) => (
          <div key={i} className="w-5 h-6 rounded-t-md" style={{ background: c, opacity: 0.7 }} />
        ))}
      </div>
    </div>
  )
}

function LimboVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      {/* Giant multiplier number */}
      <div className="relative">
        <span className="text-6xl sm:text-7xl font-black text-white/30 font-mono tracking-tighter select-none">1M</span>
        <div className="absolute -inset-4 bg-gradient-to-t from-amber-500/30 to-transparent blur-2xl -z-10" />
      </div>
      {/* Target line */}
      <div className="absolute top-[38%] left-[8%] right-[8%] h-[2px] border-t-2 border-dashed border-amber-400/50" />
      <div className="absolute top-[36%] right-[10%] px-2 py-0.5 bg-amber-500/30 rounded text-[10px] font-bold text-amber-300 border border-amber-500/30">TARGET</div>
      {/* Glow orb */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-400/20 shadow-[0_0_40px_rgba(251,191,36,0.4)] blur-sm" />
    </div>
  )
}

function WheelVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Large wheel filling most of the card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-[85%] aspect-square">
        <svg viewBox="0 0 100 100" className="w-full h-full rotate-[25deg] drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
          {[0,1,2,3,4,5,6,7].map(i => {
            const colors = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
            const angle = i * 45
            const rad = (angle * Math.PI) / 180
            const rad2 = ((angle + 45) * Math.PI) / 180
            return (
              <path key={i}
                d={`M50,50 L${50 + 48 * Math.cos(rad)},${50 + 48 * Math.sin(rad)} A48,48 0 0,1 ${50 + 48 * Math.cos(rad2)},${50 + 48 * Math.sin(rad2)} Z`}
                fill={colors[i]} opacity={0.7} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            )
          })}
          <circle cx="50" cy="50" r="10" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <circle cx="50" cy="50" r="4" fill="white" opacity={0.6} />
        </svg>
      </div>
      {/* Pointer triangle */}
      <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-4 h-5 bg-white/80 shadow-[0_4px_15px_rgba(255,255,255,0.4)]" style={{clipPath: 'polygon(50% 100%, 0 0, 100% 0)'}} />
    </div>
  )
}

function KenoVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      {/* Large keno grid */}
      <div className="grid grid-cols-5 gap-[3px] rotate-[3deg] scale-[1.15]">
        {Array.from({ length: 25 }, (_, i) => {
          const hit = [2, 7, 11, 13, 18, 22].includes(i)
          return (
            <div key={i} className={cn(
              "w-6 h-6 rounded-md text-[8px] font-extrabold flex items-center justify-center",
              hit
                ? "bg-brand/60 text-white shadow-[0_0_12px_rgba(0,232,123,0.5)] border border-brand/50"
                : "bg-white/8 text-white/25 border border-white/5"
            )}>
              {i + 1}
            </div>
          )
        })}
      </div>
      {/* Hit count badge */}
      <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 px-3 py-1 bg-brand/20 rounded-full border border-brand/30">
        <span className="text-[11px] font-extrabold text-brand">6 HITS</span>
      </div>
    </div>
  )
}

function TwentyOneVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
      {/* Large playing cards */}
      <div className="relative scale-[1.2]">
        <div className="-rotate-[15deg] w-14 h-20 bg-white/20 rounded-xl border-2 border-white/25 flex flex-col items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <span className="text-2xl font-black text-red-400">A</span>
          <span className="text-red-400 text-lg -mt-1">♥</span>
        </div>
        <div className="absolute top-2 left-10 rotate-[12deg] w-14 h-20 bg-white/20 rounded-xl border-2 border-white/25 flex flex-col items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <span className="text-2xl font-black text-white/80">K</span>
          <span className="text-white/60 text-lg -mt-1">♠</span>
        </div>
      </div>
      {/* 21 badge */}
      <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 px-4 py-1.5 bg-amber-500/40 rounded-full border-2 border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
        <span className="text-xl font-black text-amber-300 drop-shadow-lg">21</span>
      </div>
    </div>
  )
}

function CoinClimberVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Climbing staircase */}
      {[0,1,2,3,4,5].map(i => (
        <div key={i} className="absolute" style={{
          bottom: `${12 + i * 14}%`, left: `${15 + i * 10}%`
        }}>
          <div className={cn(
            "h-5 rounded-md border",
            i >= 4 ? "w-14 bg-amber-500/40 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]" :
            i >= 2 ? "w-12 bg-brand/30 border-brand/40" :
            "w-10 bg-brand/20 border-brand/30"
          )} />
        </div>
      ))}
      {/* Coins */}
      <div className="absolute top-[18%] right-[15%] text-2xl">🪙</div>
      <div className="absolute top-[35%] right-[25%] text-lg opacity-70">🪙</div>
      {/* Multiplier */}
      <div className="absolute top-[10%] right-[8%]">
        <span className="text-lg font-black text-amber-400/60 font-mono">782x</span>
      </div>
    </div>
  )
}

function SnakeVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Large snake body */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 130">
        <defs>
          <linearGradient id="snakeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <path d="M 15 100 Q 30 80 50 90 Q 70 100 80 75 Q 88 55 72 40 Q 60 30 65 18"
          stroke="url(#snakeGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        {/* Snake head */}
        <circle cx="65" cy="18" r="7" fill="#22c55e" opacity="0.7" />
        <circle cx="63" cy="16" r="2" fill="white" opacity="0.9" />
        <circle cx="68" cy="16" r="2" fill="white" opacity="0.9" />
        <circle cx="63" cy="16.5" r="1" fill="#111" />
        <circle cx="68" cy="16.5" r="1" fill="#111" />
        {/* Tongue */}
        <path d="M 65 12 L 65 8 M 64 7 L 65 8 L 66 7" stroke="#ef4444" strokeWidth="1" fill="none" opacity="0.7" />
      </svg>
      {/* Gems to collect */}
      <div className="absolute top-[40%] left-[20%] text-xl">💎</div>
      <div className="absolute top-[25%] right-[25%] text-sm opacity-60">💎</div>
      <div className="absolute top-[60%] right-[20%] w-3 h-3 bg-red-500/60 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
    </div>
  )
}

function ChickenVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Road lanes */}
      {[0,1,2,3].map(i => (
        <div key={i} className="absolute left-[8%] right-[8%]" style={{ top: `${28 + i * 16}%` }}>
          <div className="h-[1px] bg-white/20" />
          {i < 3 && (
            <div className="flex justify-between px-4 mt-1">
              {[0,1,2].map(j => (
                <div key={j} className="w-4 h-[2px] bg-yellow-500/40" />
              ))}
            </div>
          )}
        </div>
      ))}
      {/* Car */}
      <div className="absolute top-[50%] left-[18%] text-2xl">🚗</div>
      {/* Chicken */}
      <div className="absolute top-[32%] right-[22%] text-3xl drop-shadow-[0_0_15px_rgba(255,200,0,0.4)]">🐔</div>
      {/* Checkmarks for crossed lanes */}
      <div className="absolute bottom-[18%] left-[30%] text-brand text-xl font-bold">✓</div>
      <div className="absolute bottom-[18%] left-[50%] text-brand text-xl font-bold">✓</div>
      <div className="absolute bottom-[18%] left-[70%] text-brand/40 text-xl font-bold">?</div>
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
  maxMult?: string
  playing: [number, number]
}

const GAMES: GameCardData[] = [
  {
    id: 'crash', name: 'Crash', href: '/games/crash',
    gradient: 'from-violet-600 via-purple-700 to-indigo-900',
    glow: 'rgba(139,92,246,0.3)',
    visual: CrashVisual,
    tag: 'HOT',
    maxMult: '∞',
    playing: [700, 1200],
  },
  {
    id: 'mines', name: 'Mines', href: '/games/mines',
    gradient: 'from-rose-500 via-pink-600 to-rose-900',
    glow: 'rgba(244,63,94,0.3)',
    visual: MinesVisual,
    tag: 'HOT',
    maxMult: '24x',
    playing: [1800, 2500],
  },
  {
    id: 'dice', name: 'Dice', href: '/games/dice',
    gradient: 'from-red-500 via-red-600 to-red-900',
    glow: 'rgba(239,68,68,0.3)',
    visual: DiceVisual,
    maxMult: '99x',
    playing: [1400, 2000],
  },
  {
    id: 'plinko', name: 'Plinko', href: '/games/plinko',
    gradient: 'from-fuchsia-500 via-purple-600 to-violet-900',
    glow: 'rgba(217,70,239,0.3)',
    visual: PlinkoVisual,
    maxMult: '1000x',
    playing: [1500, 2200],
  },
  {
    id: 'limbo', name: 'Limbo', href: '/games/limbo',
    gradient: 'from-blue-500 via-indigo-600 to-blue-900',
    glow: 'rgba(99,102,241,0.3)',
    visual: LimboVisual,
    maxMult: '1Mx',
    playing: [900, 1500],
  },
  {
    id: 'wheel', name: 'Wheel', href: '/games/wheel',
    gradient: 'from-emerald-500 via-teal-600 to-emerald-900',
    glow: 'rgba(20,184,166,0.3)',
    visual: WheelVisual,
    maxMult: '50x',
    playing: [600, 1000],
  },
  {
    id: 'keno', name: 'Keno', href: '/games/keno',
    gradient: 'from-teal-400 via-cyan-600 to-teal-900',
    glow: 'rgba(45,212,191,0.3)',
    visual: KenoVisual,
    maxMult: '40000x',
    playing: [400, 800],
  },
  {
    id: 'twentyone', name: 'Twenty One', href: '/games/twentyone',
    gradient: 'from-amber-500 via-orange-600 to-amber-900',
    glow: 'rgba(245,158,11,0.3)',
    visual: TwentyOneVisual,
    maxMult: '1500x',
    playing: [300, 600],
  },
  {
    id: 'coinclimber', name: 'Coin Climber', href: '/games/coinclimber',
    gradient: 'from-purple-500 via-violet-600 to-purple-900',
    glow: 'rgba(168,85,247,0.3)',
    visual: CoinClimberVisual,
    tag: 'NEW',
    maxMult: '782x',
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

        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {game.tag && (
            <div className={cn(
              "px-1.5 py-[2px] rounded text-[7px] sm:text-[8px] font-extrabold uppercase tracking-wide",
              game.tag === 'HOT' ? 'bg-red-500 text-white shadow-[0_2px_10px_rgba(239,68,68,0.5)]' :
              game.tag === 'NEW' ? 'bg-brand text-background-deep shadow-[0_2px_10px_rgba(0,232,123,0.5)]' :
              'bg-amber-500 text-background-deep shadow-[0_2px_10px_rgba(245,158,11,0.4)]'
            )}>
              {game.tag}
            </div>
          )}
          {game.maxMult && (
            <div className="px-1.5 py-[2px] rounded bg-black/50 backdrop-blur-md border border-white/15 text-[7px] sm:text-[8px] font-extrabold text-white/90 tracking-wide">
              {game.maxMult}
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10">
          <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide leading-tight drop-shadow-lg">
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
                  { key: 'shows', label: 'Game Shows', icon: Gift, color: 'text-pink-400' },
                  { key: 'table', label: 'Table Games', icon: Crown, color: 'text-amber-400' },
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

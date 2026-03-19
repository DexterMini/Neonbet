'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { useRouter } from 'next/navigation'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'
import { toast } from 'sonner'
import { RotateCcw, Zap, Volume2, VolumeX, Trophy, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════
   SHARED SVG GRADIENT & FILTER DEFINITIONS
   ═══════════════════════════════════════════════════════ */
function GradientDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="sg-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="40%" stopColor="#ffc107" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
        <linearGradient id="sg-gold-v" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#cc9a06" />
        </linearGradient>
        <linearGradient id="sg-silver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8e8f0" />
          <stop offset="50%" stopColor="#a0a0b8" />
          <stop offset="100%" stopColor="#6e6e8a" />
        </linearGradient>
        <linearGradient id="sg-sapphire" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="sg-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#065f46" />
        </linearGradient>
        <linearGradient id="sg-ruby" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="50%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <linearGradient id="sg-amethyst" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d8b4fe" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6b21a8" />
        </linearGradient>
        <linearGradient id="sg-wild" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="30%" stopColor="#f59e0b" />
          <stop offset="70%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="sg-scatter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="40%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id="sg-orb" cx="35%" cy="35%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="sf-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sf-shadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   SYMBOL DEFINITIONS
   ═══════════════════════════════════════════════════════ */
interface SlotSymbol {
  id: string
  name: string
  mult3: number
  mult4: number
  mult5: number
  tier: 'wild' | 'scatter' | 'high' | 'mid' | 'low'
}

const SYMBOLS: SlotSymbol[] = [
  { id: 'wild',      name: 'Wild',      mult3: 50,  mult4: 250,  mult5: 1000, tier: 'wild' },
  { id: 'scatter',   name: 'Scatter',   mult3: 5,   mult4: 20,   mult5: 100,  tier: 'scatter' },
  { id: 'zeus',      name: 'Zeus',      mult3: 50,  mult4: 150,  mult5: 500,  tier: 'high' },
  { id: 'crown',     name: 'Crown',     mult3: 10,  mult4: 100,  mult5: 200,  tier: 'high' },
  { id: 'ring',      name: 'Ring',      mult3: 8,   mult4: 40,   mult5: 150,  tier: 'mid' },
  { id: 'chalice',   name: 'Chalice',   mult3: 5,   mult4: 30,   mult5: 100,  tier: 'mid' },
  { id: 'hourglass', name: 'Hourglass', mult3: 3,   mult4: 15,   mult5: 60,   tier: 'mid' },
  { id: 'sapphire',  name: 'Sapphire',  mult3: 2,   mult4: 8,    mult5: 30,   tier: 'low' },
  { id: 'emerald',   name: 'Emerald',   mult3: 2,   mult4: 8,    mult5: 30,   tier: 'low' },
  { id: 'ruby',      name: 'Ruby',      mult3: 1,   mult4: 5,    mult5: 20,   tier: 'low' },
]

/* ═══════════════════════════════════════════════════════
   SYMBOL SVG RENDERER — gradient-filled vector icons
   ═══════════════════════════════════════════════════════ */
function SymbolIcon({ sym, size = 56, winning = false }: { sym: SlotSymbol; size?: number; winning?: boolean }) {
  const f = winning ? 'url(#sf-glow)' : 'url(#sf-shadow)'

  const content = (() => {
    switch (sym.id) {
      case 'wild':
        return (
          <g filter={f}>
            <rect x="6" y="10" width="52" height="44" rx="8" fill="url(#sg-wild)" stroke="#fde68a" strokeWidth="2" />
            <rect x="10" y="14" width="44" height="36" rx="5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <text x="32" y="37" textAnchor="middle" dominantBaseline="middle" fill="#fff"
              fontSize="22" fontWeight="900" fontFamily="'Arial Black',sans-serif"
              stroke="#92400e" strokeWidth="1" paintOrder="stroke">W</text>
            <rect x="6" y="10" width="52" height="22" rx="8" fill="url(#sg-orb)" />
          </g>
        )
      case 'scatter':
        return (
          <g filter={f}>
            <circle cx="32" cy="32" r="22" fill="url(#sg-scatter)" />
            <polygon points="32,12 35,26 48,26 37,33 41,46 32,38 23,46 27,33 16,26 29,26"
              fill="#fde68a" opacity="0.9" />
            <circle cx="32" cy="32" r="22" fill="url(#sg-orb)" />
            <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
          </g>
        )
      case 'zeus':
        return (
          <g filter={f}>
            <path d="M36,6 L20,30 L30,30 L24,58 L48,26 L36,26 L44,6 Z"
              fill="url(#sg-gold)" stroke="#b8860b" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M36,8 L22,28 L30,28 L26,50"
              fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="16" cy="20" r="1.5" fill="#ffe066" opacity="0.7" />
            <circle cx="50" cy="34" r="1.2" fill="#ffe066" opacity="0.6" />
            <circle cx="14" cy="38" r="1" fill="#ffe066" opacity="0.5" />
          </g>
        )
      case 'crown':
        return (
          <g filter={f}>
            <path d="M10,46 L10,22 L20,32 L32,14 L44,32 L54,22 L54,46 Z"
              fill="url(#sg-gold)" stroke="#b8860b" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="10" y="44" width="44" height="6" rx="2" fill="url(#sg-gold-v)" stroke="#b8860b" strokeWidth="1" />
            <circle cx="20" cy="22" r="3.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.8" />
            <circle cx="32" cy="14" r="3.5" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.8" />
            <circle cx="44" cy="22" r="3.5" fill="#22c55e" stroke="#15803d" strokeWidth="0.8" />
            <circle cx="19" cy="21" r="1.2" fill="rgba(255,255,255,0.5)" />
            <circle cx="31" cy="13" r="1.2" fill="rgba(255,255,255,0.5)" />
            <circle cx="43" cy="21" r="1.2" fill="rgba(255,255,255,0.5)" />
            <path d="M12,44 L12,24 L18,30" fill="rgba(255,255,255,0.15)" />
          </g>
        )
      case 'ring':
        return (
          <g filter={f}>
            <ellipse cx="32" cy="40" rx="16" ry="10" fill="none" stroke="url(#sg-silver)" strokeWidth="5" />
            <ellipse cx="32" cy="40" rx="16" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
            <polygon points="32,12 22,26 32,24 42,26" fill="url(#sg-silver)" stroke="#6e6e8a" strokeWidth="1" />
            <polygon points="32,10 24,22 32,30 40,22" fill="url(#sg-sapphire)" stroke="#1e40af" strokeWidth="0.8" />
            <line x1="32" y1="10" x2="32" y2="30" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            <line x1="24" y1="22" x2="40" y2="22" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            <polygon points="32,14 33,17 36,18 33,19 32,22 31,19 28,18 31,17"
              fill="rgba(255,255,255,0.7)" />
          </g>
        )
      case 'chalice':
        return (
          <g filter={f}>
            <path d="M18,14 Q18,36 32,40 Q46,36 46,14 Z" fill="url(#sg-gold)" stroke="#b8860b" strokeWidth="1.2" />
            <path d="M20,20 Q20,34 32,38 Q44,34 44,20 Z" fill="#7f1d1d" opacity="0.6" />
            <path d="M20,20 Q20,24 32,26 Q44,24 44,20 Z" fill="#dc2626" opacity="0.4" />
            <rect x="29" y="40" width="6" height="10" rx="1" fill="url(#sg-gold-v)" />
            <ellipse cx="32" cy="52" rx="12" ry="4" fill="url(#sg-gold)" stroke="#b8860b" strokeWidth="1" />
            <ellipse cx="32" cy="14" rx="14" ry="3" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <path d="M20,16 Q20,30 26,34" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          </g>
        )
      case 'hourglass':
        return (
          <g filter={f}>
            <rect x="14" y="8" width="36" height="5" rx="2" fill="url(#sg-gold)" stroke="#b8860b" strokeWidth="0.8" />
            <rect x="14" y="51" width="36" height="5" rx="2" fill="url(#sg-gold)" stroke="#b8860b" strokeWidth="0.8" />
            <path d="M18,13 L18,26 Q32,32 32,32 Q32,32 46,26 L46,13 Z" fill="rgba(147,197,253,0.3)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
            <path d="M18,51 L18,38 Q32,32 32,32 Q32,32 46,38 L46,51 Z" fill="rgba(147,197,253,0.3)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
            <path d="M20,16 L20,24 Q32,30 44,24 L44,16 Z" fill="#fbbf24" opacity="0.5" />
            <path d="M22,48 Q32,42 42,48 Z" fill="#fbbf24" opacity="0.7" />
            <line x1="32" y1="30" x2="32" y2="42" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" />
            <path d="M20,14 L20,24" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          </g>
        )
      case 'sapphire':
        return (
          <g filter={f}>
            <polygon points="32,8 50,22 46,46 18,46 14,22" fill="url(#sg-sapphire)" stroke="#1e40af" strokeWidth="1.2" />
            <polygon points="32,8 50,22 32,28 14,22" fill="rgba(255,255,255,0.15)" />
            <line x1="14" y1="22" x2="50" y2="22" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
            <line x1="32" y1="8" x2="32" y2="46" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
            <line x1="32" y1="28" x2="18" y2="46" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
            <line x1="32" y1="28" x2="46" y2="46" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
            <polygon points="24,18 25,21 28,22 25,23 24,26 23,23 20,22 23,21" fill="rgba(255,255,255,0.6)" />
          </g>
        )
      case 'emerald':
        return (
          <g filter={f}>
            <polygon points="32,8 50,22 46,46 18,46 14,22" fill="url(#sg-emerald)" stroke="#065f46" strokeWidth="1.2" />
            <polygon points="32,8 50,22 32,28 14,22" fill="rgba(255,255,255,0.15)" />
            <line x1="14" y1="22" x2="50" y2="22" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
            <line x1="32" y1="8" x2="32" y2="46" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
            <line x1="32" y1="28" x2="18" y2="46" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
            <line x1="32" y1="28" x2="46" y2="46" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
            <polygon points="22,20 23,23 26,24 23,25 22,28 21,25 18,24 21,23" fill="rgba(255,255,255,0.55)" />
          </g>
        )
      case 'ruby':
        return (
          <g filter={f}>
            <polygon points="32,8 50,22 46,46 18,46 14,22" fill="url(#sg-ruby)" stroke="#991b1b" strokeWidth="1.2" />
            <polygon points="32,8 50,22 32,28 14,22" fill="rgba(255,255,255,0.15)" />
            <line x1="14" y1="22" x2="50" y2="22" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
            <line x1="32" y1="8" x2="32" y2="46" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
            <line x1="32" y1="28" x2="18" y2="46" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
            <line x1="32" y1="28" x2="46" y2="46" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
            <polygon points="26,18 27,21 30,22 27,23 26,26 25,23 22,22 25,21" fill="rgba(255,255,255,0.6)" />
          </g>
        )
      default:
        return <circle cx="32" cy="32" r="18" fill="#555" />
    }
  })()

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="select-none pointer-events-none">
      {content}
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   REEL CELL
   ═══════════════════════════════════════════════════════ */
function ReelCell({ sym, winning }: { sym: SlotSymbol; winning: boolean }) {
  return (
    <motion.div
      animate={winning ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={winning ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : {}}
      className={cn(
        'relative flex items-center justify-center rounded-lg transition-all duration-300',
        'w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] md:w-[80px] md:h-[80px]',
        winning
          ? 'bg-gradient-to-br from-yellow-500/25 via-amber-400/15 to-orange-500/20 ring-2 ring-yellow-400/70 shadow-[0_0_24px_rgba(251,191,36,0.35)]'
          : 'bg-[#1a1a35]/80'
      )}
    >
      <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
      <SymbolIcon sym={sym} size={48} winning={winning} />
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════
   REEL COLUMN — spin animation per reel
   ═══════════════════════════════════════════════════════ */
function ReelColumn({
  finalSymbols,
  reelIndex,
  spinning,
  winSet,
}: {
  finalSymbols: SlotSymbol[]
  reelIndex: number
  spinning: boolean
  winSet: Set<string>
}) {
  const [display, setDisplay] = useState<SlotSymbol[]>(finalSymbols)
  const [isRevealed, setIsRevealed] = useState(true)

  useEffect(() => {
    if (spinning) {
      setIsRevealed(false)
      const reg = SYMBOLS.filter(s => s.tier !== 'wild' && s.tier !== 'scatter')
      const iv = setInterval(() => {
        setDisplay(p => p.map(() => reg[Math.floor(Math.random() * reg.length)]))
      }, 60)
      const stop = setTimeout(() => {
        clearInterval(iv)
        setDisplay(finalSymbols)
        setIsRevealed(true)
      }, 600 + reelIndex * 150)
      return () => { clearInterval(iv); clearTimeout(stop) }
    } else {
      setDisplay(finalSymbols)
      setIsRevealed(true)
    }
  }, [spinning, finalSymbols, reelIndex])

  return (
    <div className="flex flex-col gap-[3px] sm:gap-1">
      {display.map((sym, row) => (
        <motion.div
          key={`${reelIndex}-${row}`}
          animate={!isRevealed ? { y: [0, -4, 0], opacity: 0.5 } : { y: 0, opacity: 1 }}
          transition={!isRevealed ? { duration: 0.06, repeat: Infinity } : { duration: 0.25, type: 'spring', stiffness: 300, damping: 20 }}
        >
          <ReelCell
            sym={sym}
            winning={isRevealed && !spinning && winSet.has(`${reelIndex}-${row}`)}
          />
        </motion.div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
const NUM_REELS = 5
const NUM_ROWS = 4

const PAYLINES: number[][] = [
  [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],
  [0,1,2,1,0],[3,2,1,2,3],
  [0,1,2,3,3],[3,2,1,0,0],
  [0,2,0,2,0],[3,1,3,1,3],
  [1,0,1,0,1],[2,3,2,3,2],
  [0,0,1,2,2],[3,3,2,1,1],
  [1,0,0,0,1],[2,3,3,3,2],
  [0,1,1,2,2],[3,2,2,1,1],
  [1,1,0,1,1],[2,2,3,2,2],
]

export default function SlotsPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const { isPlacing } = useGameStore()
  const sessionStats = useSessionStats()
  const router = useRouter()

  const [betAmount, setBetAmount] = useState('1.00')
  const [isSpinning, setIsSpinning] = useState(false)
  const [grid, setGrid] = useState<SlotSymbol[][]>([])
  const [lastWin, setLastWin] = useState(0)
  const [winPositions, setWinPositions] = useState<Set<string>>(new Set())
  const [showFairness, setShowFairness] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)
  const [spinHistory, setSpinHistory] = useState<{ mult: number; won: boolean }[]>([])
  const [freeSpins, setFreeSpins] = useState(0)
  const [bigWinAnim, setBigWinAnim] = useState(false)

  useEffect(() => {
    const reg = SYMBOLS.filter(s => s.tier !== 'wild' && s.tier !== 'scatter')
    setGrid(
      Array.from({ length: NUM_REELS }, () =>
        Array.from({ length: NUM_ROWS }, () => reg[Math.floor(Math.random() * reg.length)])
      )
    )
  }, [])

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  /* ── Win detection ───────────────────────────────── */
  const calcWin = useCallback((g: SlotSymbol[][], bet: number) => {
    const pos = new Set<string>()
    let pay = 0
    let scatters = 0

    g.forEach((reel, ri) => reel.forEach((s, ci) => {
      if (s.id === 'scatter') { scatters++; pos.add(`${ri}-${ci}`) }
    }))

    for (const line of PAYLINES) {
      const lineSyms = line.map((row, reel) => ({ sym: g[reel]?.[row], reel, row }))
      if (lineSyms.some(ls => !ls.sym)) continue

      const first = lineSyms[0].sym
      let count = 1
      for (let i = 1; i < lineSyms.length; i++) {
        const cur = lineSyms[i].sym
        if (cur.id === first.id || cur.id === 'wild' || first.id === 'wild') count++
        else break
      }

      if (count >= 3) {
        const paySym = first.id === 'wild' && lineSyms[1].sym.id !== 'wild' ? lineSyms[1].sym : first
        const mult = count === 3 ? paySym.mult3 : count === 4 ? paySym.mult4 : paySym.mult5
        pay += bet * mult / 10
        for (let i = 0; i < count; i++) pos.add(`${lineSyms[i].reel}-${lineSyms[i].row}`)
      }
    }

    if (scatters >= 3) pay += bet * scatters * 3

    return { won: pay > 0, pay: Math.round(pay * 100) / 100, pos, scatters }
  }, [])

  /* ── Spin handler ────────────────────────────────── */
  const handleSpin = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = freeSpins > 0 ? 0 : (amount ?? parseFloat(betAmount))
    const display = amount ?? parseFloat(betAmount)
    if (!initialized || isSpinning) return { won: false, profit: 0 }
    if (freeSpins <= 0 && (!display || display <= 0 || isNaN(display))) return { won: false, profit: 0 }

    if (freeSpins > 0) setFreeSpins(p => p - 1)
    setIsSpinning(true)
    setLastWin(0)
    setWinPositions(new Set())
    setBigWinAnim(false)

    try {
      const newGrid: SlotSymbol[][] = []
      for (let reel = 0; reel < NUM_REELS; reel++) {
        const col: SlotSymbol[] = []
        for (let row = 0; row < NUM_ROWS; row++) {
          const { result } = await generateBet('slots', { reel, row })
          const val = typeof result === 'number' ? result : Array.isArray(result) ? (result as number[])[0] : 0
          col.push(SYMBOLS[Math.floor(Math.abs(val) * SYMBOLS.length) % SYMBOLS.length])
        }
        newGrid.push(col)
      }

      setGrid(newGrid)
      await new Promise(r => setTimeout(r, 800 + NUM_REELS * 150))

      const { won, pay, pos, scatters } = calcWin(newGrid, display)
      setWinPositions(pos)

      if (won) {
        setLastWin(pay)
        sessionStats.recordBet(true, bet, pay - bet, pay / display)
        if (pay / display >= 10) {
          setBigWinAnim(true)
          setTimeout(() => setBigWinAnim(false), 3500)
        }
        toast.success(`Won $${pay.toFixed(2)}!`)
      } else {
        sessionStats.recordBet(false, bet, -bet, 0)
      }

      if (scatters >= 3) {
        const fs = (scatters - 2) * 5
        setFreeSpins(p => p + fs)
        toast.success(`${fs} Free Spins awarded!`)
      }

      setSpinHistory(p => [{ mult: won ? pay / display : 0, won }, ...p.slice(0, 19)])
      return { won, profit: won ? pay - bet : -bet }
    } catch (err: any) {
      toast.error(err?.message || 'Spin failed')
      return { won: false, profit: -bet }
    } finally {
      setIsSpinning(false)
    }
  }, [betAmount, initialized, isSpinning, generateBet, calcWin, sessionStats, freeSpins])

  const autoBetHandler = useCallback(async (a: number) => handleSpin(a), [handleSpin])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (!isSpinning && !autoBetState.running) handleSpin() }, () => autoBetStop(), !isSpinning)

  /* ═══ RENDER ═══════════════════════════════════════ */
  return (
    <GameLayout>
      <GradientDefs />
      <div className="p-3 sm:p-5">
        <div className="max-w-7xl mx-auto space-y-4">
          <SessionStatsBar />

          {/* Free Spins Banner */}
          <AnimatePresence>
            {freeSpins > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-gradient-to-r from-purple-600/30 via-violet-500/20 to-purple-600/30 border border-purple-400/40 rounded-xl p-3 text-center backdrop-blur-sm"
              >
                <span className="text-purple-200 font-bold text-sm tracking-wide">{freeSpins} FREE SPINS REMAINING</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spin History */}
          {spinHistory.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider shrink-0">History</span>
              {spinHistory.map((h, i) => (
                <motion.span key={i} initial={i === 0 ? { scale: 0, opacity: 0 } : {}} animate={{ scale: 1, opacity: 1 }}
                  className={cn('px-2 py-0.5 rounded-md text-[11px] font-mono font-bold whitespace-nowrap',
                    h.won ? 'bg-brand/15 text-brand' : 'bg-accent-red/15 text-accent-red')}>
                  {h.won ? `${h.mult.toFixed(1)}x` : '0x'}
                </motion.span>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            {/* ── Left: Controls ──────────────────── */}
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={isSpinning}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig}
              onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState}
              onAutoBetStart={autoBetStart}
              onAutoBetStop={autoBetStop}
              actionButton={
                <button
                  onClick={() => handleSpin()}
                  disabled={isSpinning || isPlacing || !initialized}
                  className={cn(
                    'w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    freeSpins > 0
                      ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
                      : isSpinning
                        ? 'bg-[#1a1d24] text-[#555]'
                        : 'bg-gradient-to-r from-brand to-emerald-400 text-background-deep shadow-lg shadow-brand/25 hover:shadow-brand/40'
                  )}
                >
                  {isSpinning ? <><RotateCcw className="w-4 h-4 animate-spin" />Spinning...</>
                    : freeSpins > 0 ? <><Sparkles className="w-4 h-4" />Free Spin</>
                    : <><Zap className="w-4 h-4" />Spin</>}
                </button>
              }
            >
              <div className="space-y-3">
                <div className="bg-surface/50 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">Reels × Rows</span>
                    <span className="text-white font-medium">{NUM_REELS} × {NUM_ROWS}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">Paylines</span>
                    <span className="text-white font-medium">20</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">Volatility</span>
                    <span className="text-orange-400 font-bold uppercase text-[10px]">Very High</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Tumble', 'Multipliers', 'Free Spins'].map(f => (
                    <span key={f} className="px-2 py-0.5 rounded text-[10px] font-medium bg-brand/10 text-brand border border-brand/20">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </BetControls>

            {/* ── Center: Slot Machine ────────────── */}
            <div className="flex-1 min-w-0">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl
                bg-gradient-to-b from-[#0f0f2e] via-[#13132e] to-[#0a0a20]
                border border-[#2a2a5a]/50">

                {/* Gold accent bar */}
                <div className="h-1 bg-gradient-to-r from-transparent via-amber-500/80 to-transparent" />

                {/* Title area */}
                <div className="text-center pt-5 pb-3 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] to-transparent pointer-events-none" />
                  <h2 className="text-xl sm:text-2xl font-black tracking-wider
                    bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent
                    drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    GATES OF OLYMPUS
                  </h2>
                  <p className="text-[#6b6b8a] text-[11px] mt-0.5 tracking-wide">Zeus awaits with thunderous wins</p>
                </div>

                {/* Reel area */}
                <div className="px-2 sm:px-4 pb-4">
                  <div className="relative rounded-xl overflow-hidden
                    bg-gradient-to-b from-[#16163a] to-[#0d0d24]
                    border border-[#2a2a5a]/40
                    shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]">

                    {/* Glow edges */}
                    <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-amber-500/[0.04] to-transparent pointer-events-none z-[1]" />
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-purple-600/[0.04] to-transparent pointer-events-none z-[1]" />

                    {/* Reels */}
                    <div className="flex justify-center gap-[3px] sm:gap-1.5 p-2 sm:p-3">
                      {grid.map((reelSyms, ri) => (
                        <ReelColumn key={ri} finalSymbols={reelSyms} reelIndex={ri} spinning={isSpinning} winSet={winPositions} />
                      ))}
                    </div>

                    {/* Big Win Overlay */}
                    <AnimatePresence>
                      {bigWinAnim && (
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center z-20
                            bg-gradient-to-br from-black/80 via-black/70 to-black/80 backdrop-blur-sm"
                        >
                          <motion.div
                            className="text-center"
                            animate={{ scale: [0.8, 1.1, 1], rotate: [0, 2, -2, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <div className="text-5xl sm:text-7xl font-black
                              bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent
                              drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]">
                              ${lastWin.toFixed(2)}
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-white/90 mt-2 tracking-widest
                              drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                              BIG WIN
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between px-4 pb-4">
                  <button onClick={() => setSoundOn(!soundOn)}
                    className="p-2 rounded-lg bg-[#1a1a36] border border-[#2a2a50]/50 text-white/40 hover:text-white/80 hover:border-[#3a3a60] transition-all">
                    {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <div className="flex items-center gap-10">
                    <div className="text-center">
                      <div className="text-[9px] text-[#5a5a7a] uppercase tracking-widest font-medium">Bet</div>
                      <div className="text-lg font-bold text-white/90 font-mono tabular-nums">${parseFloat(betAmount).toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-[#5a5a7a] uppercase tracking-widest font-medium">Win</div>
                      <div className={cn('text-lg font-bold font-mono tabular-nums',
                        lastWin > 0 ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'text-white/25')}>
                        ${lastWin.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <GameSettingsDropdown />
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
              </div>

              {/* Paytable */}
              <div className="mt-4 bg-[#0f0f2e] rounded-xl border border-[#2a2a5a]/40 p-4">
                <h3 className="text-sm font-bold text-white/90 mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" /> Paytable
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {SYMBOLS.filter(s => s.tier !== 'scatter').map(sym => (
                    <div key={sym.id} className="bg-[#16163a] rounded-lg p-2.5 text-center border border-[#2a2a5a]/30 hover:border-amber-500/20 transition-colors">
                      <div className="flex justify-center mb-1.5">
                        <SymbolIcon sym={sym} size={40} />
                      </div>
                      <div className={cn('text-[10px] mb-1 font-semibold',
                        sym.tier === 'wild' ? 'text-amber-400' :
                        sym.tier === 'high' ? 'text-white/80' :
                        sym.tier === 'mid' ? 'text-white/60' : 'text-white/40')}>
                        {sym.name}
                      </div>
                      <div className="text-[10px] font-mono space-y-0.5">
                        <div><span className="text-white/20">3:</span> <span className="text-white/70">{sym.mult3}x</span></div>
                        <div><span className="text-white/20">5:</span> <span className="text-amber-400">{sym.mult5}x</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right: Live Bets ────────────────── */}
            <div className="w-full lg:w-[280px] shrink-0">
              <LiveBetsTable game="slots" />
            </div>
          </div>
        </div>
      </div>

      <FairnessModal
        isOpen={showFairness}
        onClose={() => setShowFairness(false)}
        game="slots"
        serverSeedHash={serverSeedHash}
        clientSeed={clientSeed}
        nonce={nonce}
        previousServerSeed={previousServerSeed}
        onRotateSeed={rotateSeed}
        onClientSeedChange={setClientSeed}
      />
    </GameLayout>
  )
}

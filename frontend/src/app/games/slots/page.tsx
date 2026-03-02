'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { useDemoBalance } from '@/stores/demoBalanceStore'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'
import { toast } from 'sonner'
import { Sparkles, RotateCcw, Zap, Volume2, VolumeX, ChevronDown, Trophy, Flame, Star, Gem, Crown, Diamond, Cherry, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ══════════════════════════════════════════════════════════════════════
   SLOT MACHINE CONFIGURATION
   ══════════════════════════════════════════════════════════════════════ */

interface SlotSymbol {
  id: string
  emoji: string
  name: string
  multiplier: number[]  // [3-of-kind, 4-of-kind, 5-of-kind]
  isScatter?: boolean
  isWild?: boolean
}

interface SlotTheme {
  id: string
  name: string
  description: string
  bgGradient: string
  accentColor: string
  symbols: SlotSymbol[]
  reels: number
  rows: number
  paylines: number
  rtp: number
  volatility: 'low' | 'medium' | 'high' | 'very-high'
  features: string[]
}

const SLOT_THEMES: SlotTheme[] = [
  {
    id: 'olympus',
    name: 'Gates of Fortune',
    description: 'Zeus awaits with thunderous wins',
    bgGradient: 'from-indigo-900 via-purple-900 to-indigo-950',
    accentColor: '#a78bfa',
    reels: 5,
    rows: 4,
    paylines: 20,
    rtp: 96.5,
    volatility: 'very-high',
    features: ['Tumble', 'Multipliers', 'Free Spins'],
    symbols: [
      { id: 'zeus', emoji: '⚡', name: 'Zeus', multiplier: [50, 250, 500], isScatter: true },
      { id: 'crown', emoji: '👑', name: 'Crown', multiplier: [10, 50, 200] },
      { id: 'ring', emoji: '💍', name: 'Ring', multiplier: [8, 40, 150] },
      { id: 'chalice', emoji: '🏆', name: 'Chalice', multiplier: [5, 25, 100] },
      { id: 'hourglass', emoji: '⏳', name: 'Hourglass', multiplier: [3, 15, 60] },
      { id: 'red', emoji: '🔴', name: 'Red Gem', multiplier: [1, 5, 25] },
      { id: 'green', emoji: '🟢', name: 'Green Gem', multiplier: [1, 4, 20] },
      { id: 'blue', emoji: '🔵', name: 'Blue Gem', multiplier: [0.5, 3, 15] },
      { id: 'purple', emoji: '🟣', name: 'Purple Gem', multiplier: [0.5, 2, 10] },
    ],
  },
  {
    id: 'sweets',
    name: 'Sweet Fortune',
    description: 'Candy-coated cascading wins',
    bgGradient: 'from-pink-900 via-rose-900 to-pink-950',
    accentColor: '#f472b6',
    reels: 6,
    rows: 5,
    paylines: 0, // Cluster pays
    rtp: 96.48,
    volatility: 'high',
    features: ['Tumble', 'Multiplier Bombs', 'Free Spins'],
    symbols: [
      { id: 'lollipop', emoji: '🍭', name: 'Lollipop', multiplier: [25, 100, 500], isScatter: true },
      { id: 'cupcake', emoji: '🧁', name: 'Cupcake', multiplier: [10, 40, 200] },
      { id: 'donut', emoji: '🍩', name: 'Donut', multiplier: [8, 30, 150] },
      { id: 'candy', emoji: '🍬', name: 'Candy', multiplier: [5, 20, 80] },
      { id: 'cookie', emoji: '🍪', name: 'Cookie', multiplier: [3, 12, 50] },
      { id: 'grape', emoji: '🍇', name: 'Grape', multiplier: [1.5, 6, 30] },
      { id: 'banana', emoji: '🍌', name: 'Banana', multiplier: [1, 5, 25] },
      { id: 'apple', emoji: '🍎', name: 'Apple', multiplier: [0.8, 4, 20] },
      { id: 'blueberry', emoji: '🫐', name: 'Blueberry', multiplier: [0.5, 3, 15] },
    ],
  },
  {
    id: 'egypt',
    name: 'Book of Riches',
    description: 'Ancient treasures await',
    bgGradient: 'from-amber-900 via-yellow-900 to-amber-950',
    accentColor: '#fbbf24',
    reels: 5,
    rows: 3,
    paylines: 10,
    rtp: 96.21,
    volatility: 'high',
    features: ['Expanding Symbols', 'Free Spins', 'Gamble'],
    symbols: [
      { id: 'book', emoji: '📖', name: 'Book', multiplier: [20, 200, 2000], isScatter: true, isWild: true },
      { id: 'pharaoh', emoji: '🤴', name: 'Pharaoh', multiplier: [10, 100, 500] },
      { id: 'anubis', emoji: '🐺', name: 'Anubis', multiplier: [5, 40, 200] },
      { id: 'scarab', emoji: '🪲', name: 'Scarab', multiplier: [5, 30, 150] },
      { id: 'eye', emoji: '👁️', name: 'Eye of Ra', multiplier: [3, 20, 100] },
      { id: 'ace', emoji: '🅰️', name: 'Ace', multiplier: [1, 10, 40] },
      { id: 'king', emoji: '🤴', name: 'King', multiplier: [1, 10, 40] },
      { id: 'queen', emoji: '👸', name: 'Queen', multiplier: [0.5, 5, 25] },
      { id: 'jack', emoji: '🃏', name: 'Jack', multiplier: [0.5, 5, 25] },
    ],
  },
  {
    id: 'fishing',
    name: 'Big Catch Bonanza',
    description: 'Reel in massive wins',
    bgGradient: 'from-cyan-900 via-blue-900 to-cyan-950',
    accentColor: '#22d3ee',
    reels: 5,
    rows: 4,
    paylines: 12,
    rtp: 96.71,
    volatility: 'medium',
    features: ['Money Collect', 'Free Spins', 'Big Catch Bonus'],
    symbols: [
      { id: 'fisherman', emoji: '🎣', name: 'Fisherman', multiplier: [100, 500, 2000], isScatter: true },
      { id: 'marlin', emoji: '🐟', name: 'Marlin', multiplier: [20, 100, 400] },
      { id: 'shark', emoji: '🦈', name: 'Shark', multiplier: [15, 75, 300] },
      { id: 'octopus', emoji: '🐙', name: 'Octopus', multiplier: [10, 50, 200] },
      { id: 'crab', emoji: '🦀', name: 'Crab', multiplier: [5, 25, 100] },
      { id: 'tackle', emoji: '🪝', name: 'Tackle Box', multiplier: [3, 15, 60] },
      { id: 'boat', emoji: '⛵', name: 'Boat', multiplier: [2, 10, 40] },
      { id: 'cooler', emoji: '🧊', name: 'Cooler', multiplier: [1, 5, 20] },
    ],
  },
  {
    id: 'stars',
    name: 'Starlight Riches',
    description: 'Cosmic fortune among the stars',
    bgGradient: 'from-violet-900 via-fuchsia-900 to-violet-950',
    accentColor: '#e879f9',
    reels: 5,
    rows: 3,
    paylines: 20,
    rtp: 96.26,
    volatility: 'very-high',
    features: ['Princess Respin', 'Tumble', 'Multipliers'],
    symbols: [
      { id: 'princess', emoji: '👸', name: 'Princess', multiplier: [50, 250, 1000], isScatter: true },
      { id: 'star', emoji: '⭐', name: 'Star', multiplier: [15, 75, 300] },
      { id: 'moon', emoji: '🌙', name: 'Moon', multiplier: [12, 60, 250] },
      { id: 'planet', emoji: '🪐', name: 'Planet', multiplier: [8, 40, 150] },
      { id: 'crystal', emoji: '🔮', name: 'Crystal', multiplier: [5, 25, 100] },
      { id: 'heart', emoji: '💜', name: 'Heart', multiplier: [2, 12, 50] },
      { id: 'spade', emoji: '♠️', name: 'Spade', multiplier: [1.5, 8, 35] },
      { id: 'club', emoji: '♣️', name: 'Club', multiplier: [1, 6, 25] },
      { id: 'diamond', emoji: '♦️', name: 'Diamond', multiplier: [1, 5, 20] },
    ],
  },
  {
    id: 'wolf',
    name: 'Wild Wolf Gold',
    description: 'Hunt for golden riches',
    bgGradient: 'from-orange-900 via-red-900 to-orange-950',
    accentColor: '#fb923c',
    reels: 5,
    rows: 3,
    paylines: 25,
    rtp: 96.01,
    volatility: 'medium',
    features: ['Money Respins', 'Jackpots', 'Free Spins'],
    symbols: [
      { id: 'wolf', emoji: '🐺', name: 'Wolf', multiplier: [40, 200, 800], isWild: true },
      { id: 'bison', emoji: '🦬', name: 'Bison', multiplier: [20, 100, 400] },
      { id: 'cougar', emoji: '🐆', name: 'Cougar', multiplier: [15, 75, 300] },
      { id: 'eagle', emoji: '🦅', name: 'Eagle', multiplier: [10, 50, 200] },
      { id: 'horse', emoji: '🐴', name: 'Horse', multiplier: [6, 30, 120] },
      { id: 'ace_w', emoji: '🅰️', name: 'Ace', multiplier: [2, 10, 40] },
      { id: 'king_w', emoji: '👑', name: 'King', multiplier: [1.5, 8, 30] },
      { id: 'queen_w', emoji: '💎', name: 'Queen', multiplier: [1, 6, 25] },
      { id: 'jack_w', emoji: '🎯', name: 'Jack', multiplier: [1, 5, 20] },
    ],
  },
]

/* ══════════════════════════════════════════════════════════════════════
   SLOT REEL COMPONENT
   ══════════════════════════════════════════════════════════════════════ */

interface ReelProps {
  symbols: SlotSymbol[]
  finalSymbol: SlotSymbol
  spinning: boolean
  delay: number
  theme: SlotTheme
}

function Reel({ symbols, finalSymbol, spinning, delay, theme }: ReelProps) {
  const [displaySymbols, setDisplaySymbols] = useState<SlotSymbol[]>([])
  
  useEffect(() => {
    if (spinning) {
      // During spin, show random symbols rapidly
      const interval = setInterval(() => {
        const randomSymbols = Array.from({ length: theme.rows }, () => 
          symbols[Math.floor(Math.random() * symbols.length)]
        )
        setDisplaySymbols(randomSymbols)
      }, 80)
      
      // Stop after delay and show final symbol
      const timeout = setTimeout(() => {
        clearInterval(interval)
        // Show final symbol in middle position with random neighbors
        const final = Array.from({ length: theme.rows }, (_, i) => {
          if (i === Math.floor(theme.rows / 2)) return finalSymbol
          return symbols[Math.floor(Math.random() * symbols.length)]
        })
        setDisplaySymbols(final)
      }, 800 + delay)
      
      return () => {
        clearInterval(interval)
        clearTimeout(timeout)
      }
    } else {
      // Initial state
      const initial = Array.from({ length: theme.rows }, () => 
        symbols[Math.floor(Math.random() * symbols.length)]
      )
      setDisplaySymbols(initial)
    }
  }, [spinning, finalSymbol, symbols, delay, theme.rows])
  
  return (
    <div className="flex flex-col gap-1">
      {displaySymbols.map((sym, i) => (
        <motion.div
          key={i}
          animate={spinning ? { y: [0, -5, 0] } : {}}
          transition={{ duration: 0.1, repeat: spinning ? Infinity : 0 }}
          className={cn(
            'w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center text-3xl sm:text-4xl',
            'bg-black/30 border border-white/10 backdrop-blur-sm',
            i === Math.floor(theme.rows / 2) && !spinning && 'ring-2 ring-white/20'
          )}
        >
          {sym.emoji}
        </motion.div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN SLOTS PAGE
   ══════════════════════════════════════════════════════════════════════ */

export default function SlotsPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()
  const { balance: demoBalance, deduct, credit } = useDemoBalance()

  const [selectedTheme, setSelectedTheme] = useState<SlotTheme>(SLOT_THEMES[0])
  const [betAmount, setBetAmount] = useState('1.00')
  const [isSpinning, setIsSpinning] = useState(false)
  const [reelResults, setReelResults] = useState<SlotSymbol[]>([])
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [winningSymbol, setWinningSymbol] = useState<SlotSymbol | null>(null)
  const [showFairness, setShowFairness] = useState(false)
  const [showThemeSelect, setShowThemeSelect] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)
  const [totalWon, setTotalWon] = useState(0)
  const [spinHistory, setSpinHistory] = useState<{ mult: number; won: boolean }[]>([])

  // Initialize reels
  useEffect(() => {
    const initial = Array.from({ length: selectedTheme.reels }, () => 
      selectedTheme.symbols[Math.floor(Math.random() * selectedTheme.symbols.length)]
    )
    setReelResults(initial)
  }, [selectedTheme])

  const calculateWin = useCallback((results: SlotSymbol[], bet: number): { won: boolean, payout: number, symbol: SlotSymbol | null } => {
    // Count symbol occurrences
    const counts = new Map<string, number>()
    results.forEach(sym => {
      counts.set(sym.id, (counts.get(sym.id) || 0) + 1)
    })
    
    // Find best winning combination
    let bestPayout = 0
    let bestSymbol: SlotSymbol | null = null
    
    counts.forEach((count, symbolId) => {
      if (count >= 3) {
        const symbol = selectedTheme.symbols.find(s => s.id === symbolId)
        if (symbol) {
          const multIndex = Math.min(count - 3, 2) // 3, 4, or 5+ of a kind
          const multiplier = symbol.multiplier[multIndex]
          const payout = bet * multiplier
          if (payout > bestPayout) {
            bestPayout = payout
            bestSymbol = symbol
          }
        }
      }
    })
    
    // Scatter bonus: 3+ scatters anywhere = extra multiplier
    const scatters = results.filter(s => s.isScatter).length
    if (scatters >= 3 && bestPayout > 0) {
      bestPayout *= (1 + (scatters - 2) * 0.5) // +50% per extra scatter
    }
    
    return { won: bestPayout > 0, payout: bestPayout, symbol: bestSymbol }
  }, [selectedTheme])

  const handleSpin = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet) || !initialized || isSpinning) return { won: false, profit: 0 }
    if (!isAuthenticated && demoBalance < bet) { 
      toast.error('Insufficient balance!') 
      return { won: false, profit: 0 } 
    }

    if (!isAuthenticated) deduct(bet)
    setIsSpinning(true)
    setLastWin(null)
    setWinningSymbol(null)

    try {
      // Generate provably fair results for each reel
      const results: SlotSymbol[] = []
      for (let i = 0; i < selectedTheme.reels; i++) {
        const { result } = await generateBet('slots', { reel: i, theme: selectedTheme.id })
        const symbolIndex = (result as number) % selectedTheme.symbols.length
        results.push(selectedTheme.symbols[symbolIndex])
      }
      
      setReelResults(results)
      
      // Wait for spin animation
      await new Promise(r => setTimeout(r, 1200 + selectedTheme.reels * 150))
      
      // Calculate winnings
      const { won, payout, symbol } = calculateWin(results, bet)
      const profit = won ? payout - bet : -bet
      
      if (won) {
        if (!isAuthenticated) credit(payout)
        setLastWin(payout)
        setWinningSymbol(symbol)
        setTotalWon(prev => prev + payout)
        sessionStats.recordBet(true, bet, payout - bet, payout / bet)
        toast.success(`🎰 ${symbol?.name}! Won $${payout.toFixed(2)}!`)
      } else {
        sessionStats.recordBet(false, bet, -bet, 0)
      }
      
      setSpinHistory(prev => [{ mult: won ? payout / bet : 0, won }, ...prev.slice(0, 19)])
      return { won, profit }
      
    } catch (err: any) {
      if (!isAuthenticated) credit(bet)
      toast.error(err?.message || 'Spin failed')
      return { won: false, profit: -bet }
    } finally {
      setIsSpinning(false)
    }
  }, [betAmount, initialized, isSpinning, isAuthenticated, demoBalance, deduct, credit, generateBet, selectedTheme, calculateWin, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => handleSpin(amount), [handleSpin])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (!isSpinning && !autoBetState.running) handleSpin() }, () => autoBetStop(), !isSpinning)

  const getVolatilityColor = (vol: string) => {
    switch (vol) {
      case 'low': return 'text-green-400'
      case 'medium': return 'text-yellow-400'
      case 'high': return 'text-orange-400'
      case 'very-high': return 'text-red-400'
      default: return 'text-white'
    }
  }

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-7xl mx-auto space-y-4">
          <SessionStatsBar />

          {/* History */}
          {spinHistory.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider shrink-0">History</span>
              {spinHistory.map((h, i) => (
                <motion.span key={i} initial={i === 0 ? { scale: 0, opacity: 0 } : {}} animate={{ scale: 1, opacity: 1 }}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[11px] font-mono font-bold whitespace-nowrap',
                    h.won ? 'bg-brand/15 text-brand' : 'bg-accent-red/15 text-accent-red'
                  )}>
                  {h.won ? `${h.mult.toFixed(1)}x` : '0x'}
                </motion.span>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: Bet Controls */}
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
                  className="w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isSpinning 
                      ? '#1a1d24' 
                      : `linear-gradient(135deg, ${selectedTheme.accentColor} 0%, ${selectedTheme.accentColor}dd 100%)`,
                    color: isSpinning ? '#666' : '#0A0B0F',
                    boxShadow: isSpinning ? 'none' : `0 4px 20px ${selectedTheme.accentColor}40`,
                  }}
                >
                  {isSpinning ? (
                    <><RotateCcw className="w-4 h-4 animate-spin" />Spinning...</>
                  ) : (
                    <><Zap className="w-4 h-4" />Spin</>
                  )}
                </button>
              }
            >
              {/* Game Selector */}
              <div className="relative">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Select Game</span>
                <button
                  onClick={() => setShowThemeSelect(!showThemeSelect)}
                  disabled={isSpinning}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-surface border border-border rounded-xl text-left transition-all hover:border-white/20 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{selectedTheme.symbols[0].emoji}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-white truncate">{selectedTheme.name}</div>
                      <div className="text-[10px] text-muted">{selectedTheme.rtp}% RTP</div>
                    </div>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-muted transition-transform', showThemeSelect && 'rotate-180')} />
                </button>
                
                <AnimatePresence>
                  {showThemeSelect && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto"
                    >
                      {SLOT_THEMES.map(theme => (
                        <button
                          key={theme.id}
                          onClick={() => { setSelectedTheme(theme); setShowThemeSelect(false) }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-white/5',
                            selectedTheme.id === theme.id && 'bg-brand/10'
                          )}
                        >
                          <span className="text-2xl">{theme.symbols[0].emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-white">{theme.name}</div>
                            <div className="text-[10px] text-muted">{theme.description}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[11px] text-muted">{theme.rtp}%</div>
                            <div className={cn('text-[10px] font-bold uppercase', getVolatilityColor(theme.volatility))}>
                              {theme.volatility}
                            </div>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Game Info */}
              <div className="bg-surface/50 rounded-lg p-2.5 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted">Reels × Rows</span>
                  <span className="text-white font-medium">{selectedTheme.reels} × {selectedTheme.rows}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted">Paylines</span>
                  <span className="text-white font-medium">{selectedTheme.paylines || 'Cluster'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted">Volatility</span>
                  <span className={cn('font-bold uppercase', getVolatilityColor(selectedTheme.volatility))}>
                    {selectedTheme.volatility}
                  </span>
                </div>
              </div>

              {/* Features */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Features</span>
                <div className="flex flex-wrap gap-1">
                  {selectedTheme.features.map(f => (
                    <span key={f} className="px-2 py-1 bg-white/5 rounded-md text-[10px] text-muted-light">{f}</span>
                  ))}
                </div>
              </div>
            </BetControls>

            {/* Center: Slot Machine */}
            <div className="flex-1 min-w-0">
              <div className={cn(
                'relative rounded-2xl overflow-hidden border border-white/10',
                `bg-gradient-to-br ${selectedTheme.bgGradient}`
              )}>
                {/* Decorative top */}
                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                
                {/* Game title */}
                <div className="relative z-10 text-center py-4">
                  <h2 className="text-2xl font-black text-white tracking-tight">{selectedTheme.name}</h2>
                  <p className="text-sm text-white/60">{selectedTheme.description}</p>
                </div>  

                {/* Reels container */}
                <div className="relative px-4 pb-6">
                  <div className="flex justify-center gap-2 bg-black/20 rounded-xl p-4 border border-white/5">
                    {reelResults.map((result, i) => (
                      <Reel
                        key={i}
                        symbols={selectedTheme.symbols}
                        finalSymbol={result}
                        spinning={isSpinning}
                        delay={i * 150}
                        theme={selectedTheme}
                      />
                    ))}
                  </div>
                </div>

                {/* Win display */}
                <AnimatePresence>
                  {lastWin !== null && lastWin > 0 && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20"
                    >
                      <div className="text-center">
                        {winningSymbol && (
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="text-6xl mb-2"
                          >
                            {winningSymbol.emoji}
                          </motion.div>
                        )}
                        <div className="text-4xl font-black text-white mb-1">
                          ${lastWin.toFixed(2)}
                        </div>
                        <div className="text-lg text-white/70">YOU WIN!</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Controls */}
                <div className="flex items-center justify-between px-4 pb-4">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:text-white transition-colors"
                  >
                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                  
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <div className="text-[10px] text-white/50 uppercase">Bet</div>
                      <div className="text-lg font-bold text-white font-mono">${parseFloat(betAmount).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/50 uppercase">Win</div>
                      <div className="text-lg font-bold font-mono" style={{ color: selectedTheme.accentColor }}>
                        ${(lastWin ?? 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowFairness(true)}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:text-white transition-colors"
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Paytable */}
              <div className="mt-4 bg-background-secondary rounded-xl border border-border/60 p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Paytable
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {selectedTheme.symbols.slice(0, 5).map(sym => (
                    <div key={sym.id} className="bg-surface/50 rounded-lg p-2 text-center">
                      <div className="text-2xl mb-1">{sym.emoji}</div>
                      <div className="text-[10px] text-muted mb-1">{sym.name}</div>
                      <div className="text-[11px] font-mono">
                        <span className="text-white/60">3:</span> <span className="text-white">{sym.multiplier[0]}x</span>
                      </div>
                      <div className="text-[11px] font-mono">
                        <span className="text-white/60">5:</span> <span className="text-brand">{sym.multiplier[2]}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Live Bets */}
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

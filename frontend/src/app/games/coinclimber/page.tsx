'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { Shield, Sparkles, ArrowLeft, ArrowRight, Coins, RotateCcw, TrendingUp, Layers } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'
import { toast } from 'sonner'

/* ── Game config ───────────────────────────────────── */
const MAX_LEVELS = 10
const DIFFICULTY_PRESETS = [
  { label: 'Easy',   cols: 4, color: 'text-brand',       bg: 'bg-brand/15 border-brand/40' },
  { label: 'Medium', cols: 3, color: 'text-accent-amber', bg: 'bg-accent-amber/15 border-accent-amber/40' },
  { label: 'Hard',   cols: 2, color: 'text-accent-red',   bg: 'bg-accent-red/15 border-accent-red/40' },
]

const getMultiplier = (cols: number, level: number): number => {
  if (level === 0) return 1
  const edge = 0.97  // 3% house edge
  let mult = 1
  for (let i = 0; i < level; i++) {
    mult *= cols * edge
  }
  return parseFloat(mult.toFixed(2))
}

/* ── Tile type ─────────────────────────────────────── */
interface Level {
  correctIndex: number
}

export default function CoinClimberPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [difficulty, setDifficulty] = useState(1) // 0=easy, 1=medium, 2=hard
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [showFairness, setShowFairness] = useState(false)

  const [gameActive, setGameActive] = useState(false)
  const [currentLevel, setCurrentLevel] = useState(0)
  const [levels, setLevels] = useState<Level[]>([])
  const [picked, setPicked] = useState<{ level: number; col: number }[]>([])
  const [hitWrong, setHitWrong] = useState<{ level: number; col: number } | null>(null)
  const [cashedOut, setCashedOut] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const cols = DIFFICULTY_PRESETS[difficulty].cols
  const currentMult = getMultiplier(cols, currentLevel)
  const nextMult = getMultiplier(cols, currentLevel + 1)
  const profit = parseFloat(betAmount) * currentMult - parseFloat(betAmount)

  // Auto-scroll to current level
  useEffect(() => {
    if (scrollRef.current && currentLevel > 0) {
      const el = scrollRef.current
      el.scrollTop = 0
    }
  }, [currentLevel])

  const generateLevels = useCallback(async (): Promise<Level[]> => {
    const newLevels: Level[] = []
    for (let i = 0; i < MAX_LEVELS; i++) {
      const { result } = await generateBet('coinclimber', { level: i, cols })
      const hashNum = typeof result === 'number' ? result : parseInt(String(result), 16)
      newLevels.push({ correctIndex: Math.abs(hashNum) % cols })
    }
    return newLevels
  }, [generateBet, cols])

  const startGame = async () => {
    if (parseFloat(betAmount) <= 0 || !initialized || isPlacing) return
    try {
      const newLevels = await generateLevels()
      setLevels(newLevels)
      setCurrentLevel(0)
      setPicked([])
      setHitWrong(null)
      setCashedOut(false)
      setGameActive(true)
    } catch (err: any) {
      toast.error(err?.message || 'Error starting game')
    }
  }

  const pickTile = (level: number, col: number) => {
    if (!gameActive || level !== currentLevel || hitWrong || cashedOut) return

    const isCorrect = levels[level].correctIndex === col
    const newPicked = [...picked, { level, col }]
    setPicked(newPicked)

    if (!isCorrect) {
      setHitWrong({ level, col })
      setGameActive(false)
      sessionStats.recordBet(false, parseFloat(betAmount), -parseFloat(betAmount), 0)
      toast.error('Wrong tile! You lost.')
    } else if (level + 1 >= MAX_LEVELS) {
      setCurrentLevel(level + 1)
      setGameActive(false)
      setCashedOut(true)
      const finalMult = getMultiplier(cols, level + 1)
      sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * finalMult - parseFloat(betAmount), finalMult)
      toast.success(`Max level reached! Won $${(parseFloat(betAmount) * finalMult).toFixed(2)}`)
    } else {
      setCurrentLevel(level + 1)
    }
  }

  const cashout = () => {
    if (!gameActive || currentLevel === 0) return
    setCashedOut(true)
    setGameActive(false)
    sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * currentMult - parseFloat(betAmount), currentMult)
    toast.success(`Cashed out $${(parseFloat(betAmount) * currentMult).toFixed(2)}!`)
  }

  const resetGame = () => {
    setGameActive(false)
    setCurrentLevel(0)
    setLevels([])
    setPicked([])
    setHitWrong(null)
    setCashedOut(false)
  }

  // Build visual rows (bottom = level 0, top = max)
  const visibleLevels = Array.from({ length: MAX_LEVELS }, (_, i) => MAX_LEVELS - 1 - i)

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          <div className="flex flex-col lg:flex-row gap-4">

            {/* ── Left: Controls ─────────────────────── */}
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={gameActive}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              showAutoTab={false}
              actionButton={
                !gameActive && !cashedOut && !hitWrong ? (
                  <button onClick={startGame} disabled={parseFloat(betAmount) <= 0 || !initialized}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />Start Climbing
                  </button>
                ) : gameActive && currentLevel > 0 ? (
                  <button onClick={cashout}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
                    Cash Out ${(parseFloat(betAmount) * currentMult).toFixed(2)}
                  </button>
                ) : gameActive ? (
                  <div className="w-full py-3.5 bg-surface border border-brand/30 font-bold text-[14px] text-brand rounded-xl text-center animate-pulse">
                    Pick a tile on Level 1
                  </div>
                ) : (
                  <button onClick={resetGame}
                    className={`w-full py-3.5 font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2
                      ${hitWrong ? 'bg-accent-red text-white' : 'bg-brand text-background-deep shadow-glow-brand-sm'}`}>
                    <RotateCcw className="w-4 h-4" />Play Again
                  </button>
                )
              }
            >
              {/* Difficulty */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Difficulty</span>
                <div className="flex gap-1.5">
                  {DIFFICULTY_PRESETS.map((d, i) => (
                    <button key={d.label} onClick={() => !gameActive && setDifficulty(i)} disabled={gameActive}
                      className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all disabled:opacity-50
                        ${difficulty === i ? `${d.bg} ${d.color}` : 'bg-surface border-border text-muted hover:text-white'}`}>
                      {d.label}
                      <div className="text-[10px] font-normal opacity-70">{d.cols} cols</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Level</div>
                  <div className="text-base font-bold text-brand font-mono">{currentLevel}/{MAX_LEVELS}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Next Mult</div>
                  <div className="text-base font-bold text-accent-amber font-mono">{nextMult.toFixed(2)}x</div>
                </div>
              </div>

              {/* Active game multiplier */}
              <AnimatePresence>
                {gameActive && currentLevel > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="bg-brand/[0.06] rounded-xl p-3.5 border border-brand/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-muted uppercase mb-0.5">Current</div>
                        <div className="text-xl text-brand font-bold font-mono">{currentMult.toFixed(2)}x</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted uppercase mb-0.5">Payout</div>
                        <div className="text-xl text-brand font-bold font-mono">${(parseFloat(betAmount) * currentMult).toFixed(2)}</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* ── Right: Tower ───────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="bg-background-secondary rounded-2xl border border-border/60 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent-amber/15 border border-accent-amber/30 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-accent-amber" />
                    </div>
                    <span className="text-white font-bold text-base">Coin Climber</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border
                      ${gameActive ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-surface border-border text-muted'}`}>
                      <Layers className="w-3 h-3 inline mr-1" />{currentLevel}/{MAX_LEVELS}
                    </div>
                  </div>
                </div>

                {/* Tower grid */}
                <div ref={scrollRef} className="p-4 space-y-1.5 max-h-[520px] overflow-y-auto scrollbar-thin">
                  {/* Top: Summit badge */}
                  <div className="flex items-center justify-center py-2 mb-1">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-amber/10 border border-accent-amber/25">
                      <span className="text-accent-amber text-sm">👑</span>
                      <span className="text-[11px] font-bold text-accent-amber/80 uppercase tracking-wider">Summit — {getMultiplier(cols, MAX_LEVELS).toFixed(2)}x</span>
                    </div>
                  </div>

                  {visibleLevels.map(lvl => {
                    const isCurrentLevel = gameActive && lvl === currentLevel
                    const isPastLevel = lvl < currentLevel
                    const isFutureLevel = lvl > currentLevel
                    const levelPick = picked.find(p => p.level === lvl)
                    const isWrongLevel = hitWrong?.level === lvl
                    const multiplier = getMultiplier(cols, lvl + 1)

                    return (
                      <motion.div
                        key={lvl}
                        initial={false}
                        animate={{
                          opacity: isFutureLevel && !hitWrong && !cashedOut ? 0.3 : 1,
                        }}
                        className="relative"
                      >
                        {/* Connector line between levels */}
                        {lvl < MAX_LEVELS - 1 && (
                          <div className={`absolute left-[2.2rem] -top-1.5 w-px h-1.5 ${isPastLevel ? 'bg-brand/40' : 'bg-border/40'}`} />
                        )}

                        <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-300
                          ${isCurrentLevel ? 'bg-brand/[0.07] ring-1 ring-brand/30 shadow-lg shadow-brand/5' : ''}
                        `}>
                          {/* Level indicator */}
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold font-mono shrink-0 border transition-colors
                            ${isCurrentLevel
                              ? 'bg-brand/15 border-brand/40 text-brand'
                              : isPastLevel
                              ? 'bg-brand/10 border-brand/20 text-brand/60'
                              : 'bg-surface border-border/40 text-muted/40'
                            }`}>
                            {lvl + 1}
                          </div>

                          {/* Tiles */}
                          <div className="flex-1 flex gap-1.5">
                            {Array.from({ length: cols }, (_, c) => {
                              const wasPicked = levelPick?.col === c
                              const isCorrectTile = levels[lvl]?.correctIndex === c
                              const showResult = isPastLevel || isWrongLevel || cashedOut
                              const isCorrectRevealed = showResult && isCorrectTile
                              const isWrongPick = isWrongLevel && wasPicked && !isCorrectTile

                              return (
                                <motion.button
                                  key={c}
                                  onClick={() => pickTile(lvl, c)}
                                  disabled={!isCurrentLevel || !!hitWrong || cashedOut}
                                  whileHover={isCurrentLevel && !hitWrong ? { scale: 1.05, y: -2 } : {}}
                                  whileTap={isCurrentLevel && !hitWrong ? { scale: 0.95 } : {}}
                                  className={`flex-1 h-11 sm:h-12 rounded-xl font-bold text-[13px] transition-all duration-200 flex items-center justify-center
                                    ${isWrongPick
                                      ? 'bg-accent-red/20 ring-2 ring-accent-red/50 text-accent-red shadow-lg shadow-accent-red/20 animate-pulse'
                                      : isCorrectRevealed && wasPicked
                                      ? 'bg-brand/20 ring-2 ring-brand/50 text-brand shadow-lg shadow-brand/20'
                                      : isCorrectRevealed
                                      ? 'bg-brand/10 ring-1 ring-brand/20 text-brand/50'
                                      : showResult && !isCorrectTile
                                      ? 'bg-surface/40 ring-1 ring-border/20 text-muted/20'
                                      : isCurrentLevel
                                      ? 'bg-surface ring-1 ring-border/60 hover:ring-brand/40 hover:bg-brand/[0.06] text-white/70 cursor-pointer hover:shadow-md hover:shadow-brand/5'
                                      : 'bg-surface/30 ring-1 ring-border/15 text-muted/15 cursor-not-allowed'
                                    }`}
                                >
                                  {isWrongPick ? '✕' : isCorrectRevealed && wasPicked ? (
                                    <span className="text-base">🪙</span>
                                  ) : isCorrectRevealed ? (
                                    <span className="text-sm opacity-50">🪙</span>
                                  ) : isCurrentLevel ? (
                                    <span className="opacity-40">?</span>
                                  ) : ''}
                                </motion.button>
                              )
                            })}
                          </div>

                          {/* Multiplier badge */}
                          <div className={`w-[4.5rem] text-right shrink-0`}>
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-bold
                              ${isCurrentLevel
                                ? 'bg-accent-amber/15 text-accent-amber border border-accent-amber/25'
                                : isPastLevel
                                ? 'text-brand/60'
                                : 'text-muted/30'
                              }`}>
                              {multiplier.toFixed(2)}x
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}

                  {/* Base: Start indicator */}
                  <div className="flex items-center justify-center pt-2 mt-1">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-border/60">
                      <TrendingUp className="w-3 h-3 text-muted" />
                      <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Start</span>
                    </div>
                  </div>
                </div>

                {/* Result overlay */}
                <AnimatePresence>
                  {(hitWrong || cashedOut) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mx-4 mb-4 rounded-xl p-4 border text-center
                        ${hitWrong
                          ? 'bg-accent-red/10 border-accent-red/30'
                          : 'bg-brand/10 border-brand/30'
                        }`}
                    >
                      <div className={`text-2xl font-black font-mono ${hitWrong ? 'text-accent-red' : 'text-brand'}`}>
                        {hitWrong ? 'BUSTED' : `${currentMult.toFixed(2)}x`}
                      </div>
                      <div className={`text-sm mt-1 ${hitWrong ? 'text-accent-red/70' : 'text-brand/70'}`}>
                        {hitWrong
                          ? `Lost $${parseFloat(betAmount).toFixed(2)} at level ${(hitWrong.level + 1)}`
                          : `Won $${(parseFloat(betAmount) * currentMult).toFixed(2)}`
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-4">
                <LiveBetsTable game="coinclimber" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <FairnessModal
        isOpen={showFairness}
        onClose={() => setShowFairness(false)}
        game="coinclimber"
        serverSeedHash={serverSeedHash}
        clientSeed={clientSeed}
        nonce={nonce}
        previousServerSeed={previousServerSeed}
        onClientSeedChange={setClientSeed}
        onRotateSeed={rotateSeed}
      />
    </GameLayout>
  )
}

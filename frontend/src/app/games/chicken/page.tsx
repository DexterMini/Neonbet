'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { Shield, Sparkles, RotateCcw, Car, Footprints } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'
import { toast } from 'sonner'

/* ── Game config ───────────────────────────────────── */
const MAX_ROWS = 10

const DIFFICULTY_PRESETS = [
  { label: 'Easy',   lanes: 4, color: 'text-brand',       bg: 'bg-brand/15 border-brand/40',           safeLabel: '3 safe' },
  { label: 'Medium', lanes: 3, color: 'text-accent-amber', bg: 'bg-accent-amber/15 border-accent-amber/40', safeLabel: '2 safe' },
  { label: 'Hard',   lanes: 2, color: 'text-accent-red',   bg: 'bg-accent-red/15 border-accent-red/40',   safeLabel: '1 safe' },
]

const getMultiplier = (lanes: number, row: number): number => {
  if (row === 0) return 1
  const edge = 0.97 // 3% house edge
  let mult = 1
  for (let i = 0; i < row; i++) {
    mult *= lanes * edge
  }
  return parseFloat(mult.toFixed(2))
}

/* ── Row type ─────────────────────────────────────── */
interface Row {
  carIndex: number // which lane has the car
}

export default function ChickenPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [difficulty, setDifficulty] = useState(1) // 0=easy, 1=medium, 2=hard
  const [showFairness, setShowFairness] = useState(false)

  const [gameActive, setGameActive] = useState(false)
  const [currentRow, setCurrentRow] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [picked, setPicked] = useState<{ row: number; lane: number }[]>([])
  const [hitCar, setHitCar] = useState<{ row: number; lane: number } | null>(null)
  const [cashedOut, setCashedOut] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const lanes = DIFFICULTY_PRESETS[difficulty].lanes
  const currentMult = getMultiplier(lanes, currentRow)
  const nextMult = getMultiplier(lanes, currentRow + 1)
  const profit = parseFloat(betAmount) * currentMult - parseFloat(betAmount)

  // Auto-scroll to current row
  useEffect(() => {
    if (scrollRef.current && currentRow > 0) {
      scrollRef.current.scrollTop = 0
    }
  }, [currentRow])

  const generateRows = useCallback(async (): Promise<Row[]> => {
    const newRows: Row[] = []
    for (let i = 0; i < MAX_ROWS; i++) {
      const { result } = await generateBet('chicken', { row: i, lanes })
      const hashNum = typeof result === 'number' ? result : parseInt(String(result), 16)
      newRows.push({ carIndex: Math.abs(hashNum) % lanes })
    }
    return newRows
  }, [generateBet, lanes])

  const startGame = async () => {
    if (parseFloat(betAmount) <= 0 || !initialized || isPlacing) return
    try {
      const newRows = await generateRows()
      setRows(newRows)
      setCurrentRow(0)
      setPicked([])
      setHitCar(null)
      setCashedOut(false)
      setGameActive(true)
    } catch (err: any) {
      toast.error(err?.message || 'Error starting game')
    }
  }

  const pickLane = (row: number, lane: number) => {
    if (!gameActive || row !== currentRow || hitCar || cashedOut) return

    const isSafe = rows[row].carIndex !== lane
    const newPicked = [...picked, { row, lane }]
    setPicked(newPicked)

    if (!isSafe) {
      setHitCar({ row, lane })
      setGameActive(false)
      sessionStats.recordBet(false, parseFloat(betAmount), -parseFloat(betAmount), 0)
      toast.error('🚗 Hit by a car! You lost.')
    } else if (row + 1 >= MAX_ROWS) {
      setCurrentRow(row + 1)
      setGameActive(false)
      setCashedOut(true)
      const finalMult = getMultiplier(lanes, row + 1)
      sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * finalMult - parseFloat(betAmount), finalMult)
      toast.success(`🐔 Chicken crossed safely! Won $${(parseFloat(betAmount) * finalMult).toFixed(2)}`)
    } else {
      setCurrentRow(row + 1)
    }
  }

  const cashout = () => {
    if (!gameActive || currentRow === 0) return
    setCashedOut(true)
    setGameActive(false)
    sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * currentMult - parseFloat(betAmount), currentMult)
    toast.success(`🐔 Chicken cashed out $${(parseFloat(betAmount) * currentMult).toFixed(2)}!`)
  }

  const resetGame = () => {
    setGameActive(false)
    setCurrentRow(0)
    setRows([])
    setPicked([])
    setHitCar(null)
    setCashedOut(false)
  }

  // Build visual rows (bottom = row 0, top = max)
  const visibleRows = Array.from({ length: MAX_ROWS }, (_, i) => MAX_ROWS - 1 - i)

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
                !gameActive && !cashedOut && !hitCar ? (
                  <button onClick={startGame} disabled={parseFloat(betAmount) <= 0 || !initialized}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />Cross the Road
                  </button>
                ) : gameActive && currentRow > 0 ? (
                  <button onClick={cashout}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
                    Cash Out ${(parseFloat(betAmount) * currentMult).toFixed(2)}
                  </button>
                ) : gameActive ? (
                  <div className="w-full py-3.5 bg-surface border border-brand/30 font-bold text-[14px] text-brand rounded-xl text-center animate-pulse">
                    🐔 Pick a safe lane!
                  </div>
                ) : (
                  <button onClick={resetGame}
                    className={`w-full py-3.5 font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2
                      ${hitCar ? 'bg-accent-red text-white' : 'bg-brand text-background-deep shadow-glow-brand-sm'}`}>
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
                      <div className="text-[10px] font-normal opacity-70">{d.safeLabel}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Crossed</div>
                  <div className="text-base font-bold text-brand font-mono">{currentRow}/{MAX_ROWS}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Next Mult</div>
                  <div className="text-base font-bold text-accent-amber font-mono">{nextMult.toFixed(2)}x</div>
                </div>
              </div>

              {/* Active game multiplier */}
              <AnimatePresence>
                {gameActive && currentRow > 0 && (
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

            {/* ── Right: Road ───────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="bg-background-secondary rounded-2xl border border-border/60 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <span className="text-lg">🐔</span>
                    </div>
                    <div>
                      <span className="text-white font-bold text-sm">Chicken Road</span>
                      <span className="text-muted text-[11px] ml-2">Cross {MAX_ROWS} lanes to win</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-lg bg-surface border border-border">
                      <span className="text-[11px] text-muted">Road </span>
                      <span className="text-brand font-mono font-bold text-[13px]">{currentRow}</span>
                      <span className="text-muted text-[11px]">/{MAX_ROWS}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {/* Finish line */}
                  <div className="mb-2">
                    <div className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand/10 via-brand/5 to-brand/10 border border-brand/25"
                      style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(0,232,123,0.08) 12px, rgba(0,232,123,0.08) 24px)' }}>
                      <span className="text-lg">🏁</span>
                      <span className="text-brand text-[13px] font-bold tracking-wide">FINISH LINE</span>
                      <span className="ml-auto text-accent-amber font-mono font-bold text-[13px]">
                        {getMultiplier(lanes, MAX_ROWS).toFixed(2)}x
                      </span>
                    </div>
                  </div>

                  {/* Road grid */}
                  <div ref={scrollRef} className="max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
                    {visibleRows.map(row => {
                      const isCurrentRow = gameActive && row === currentRow
                      const isPastRow = row < currentRow
                      const isFutureRow = row > currentRow
                      const rowPick = picked.find(p => p.row === row)
                      const isHitRow = hitCar?.row === row
                      const multiplier = getMultiplier(lanes, row + 1)

                      return (
                        <motion.div
                          key={row}
                          initial={false}
                          animate={{
                            opacity: isFutureRow && !hitCar && !cashedOut ? 0.4 : 1,
                          }}
                          className={`flex items-center gap-2 py-1 transition-all`}
                        >
                          {/* Row number */}
                          <div className={`w-7 text-right text-[11px] font-mono font-bold shrink-0
                            ${isCurrentRow ? 'text-amber-400' : isPastRow ? 'text-brand/60' : 'text-muted/40'}`}>
                            {row + 1}
                          </div>

                          {/* Road with lanes */}
                          <div className={`flex-1 flex gap-1.5 p-1.5 rounded-xl transition-all duration-200
                            ${isCurrentRow 
                              ? 'bg-amber-500/[0.06] ring-1 ring-amber-500/25' 
                              : isPastRow 
                                ? 'bg-brand/[0.03]' 
                                : ''}`}
                          >
                            {Array.from({ length: lanes }, (_, l) => {
                              const wasPicked = rowPick?.lane === l
                              const isCarLane = rows[row]?.carIndex === l
                              const showResult = isPastRow || isHitRow || cashedOut
                              const isSafeRevealed = showResult && !isCarLane
                              const isCarRevealed = showResult && isCarLane
                              const isHitPick = isHitRow && wasPicked && isCarLane

                              return (
                                <motion.button
                                  key={l}
                                  onClick={() => pickLane(row, l)}
                                  disabled={!isCurrentRow || !!hitCar || cashedOut}
                                  whileHover={isCurrentRow && !hitCar ? { scale: 1.04, y: -1 } : {}}
                                  whileTap={isCurrentRow && !hitCar ? { scale: 0.97 } : {}}
                                  className={`relative flex-1 h-[52px] rounded-lg font-bold text-[13px] transition-all duration-200 flex items-center justify-center
                                    ${isHitPick
                                      ? 'bg-red-500/25 ring-2 ring-red-500/70 text-red-400'
                                      : isSafeRevealed && wasPicked
                                      ? 'bg-brand/15 ring-2 ring-brand/50 text-brand'
                                      : isSafeRevealed
                                      ? 'bg-brand/[0.06] ring-1 ring-brand/15 text-brand/50'
                                      : isCarRevealed && !wasPicked
                                      ? 'bg-zinc-800/60 ring-1 ring-zinc-700/40 text-zinc-500'
                                      : isCurrentRow
                                      ? 'bg-zinc-800/70 ring-1 ring-zinc-600/40 text-muted-light cursor-pointer hover:bg-amber-500/10 hover:ring-amber-400/40 hover:text-white active:ring-amber-400/60'
                                      : 'bg-zinc-800/30 ring-1 ring-zinc-700/20 text-muted/20 cursor-default'
                                    }`}
                                >
                                  {isHitPick ? (
                                    <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1.3, rotate: 0 }} className="text-xl select-none">🚗</motion.span>
                                  ) : isCarRevealed ? (
                                    <span className="text-base opacity-40 select-none">🚗</span>
                                  ) : isSafeRevealed && wasPicked ? (
                                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1.1 }} className="text-xl select-none">🐔</motion.span>
                                  ) : isSafeRevealed ? (
                                    <span className="text-base opacity-30 select-none">✓</span>
                                  ) : isCurrentRow ? (
                                    <span className="text-lg opacity-40 select-none">?</span>
                                  ) : null}

                                  {/* Lane divider dashes */}
                                  {l < lanes - 1 && !isCurrentRow && !isPastRow && (
                                    <div className="absolute -right-[5px] top-2 bottom-2 w-[2px] border-r border-dashed border-zinc-700/30 pointer-events-none" />
                                  )}
                                </motion.button>
                              )
                            })}
                          </div>

                          {/* Multiplier */}
                          <div className={`w-[60px] text-right text-[11px] font-mono font-bold shrink-0
                            ${isCurrentRow ? 'text-accent-amber' : isPastRow ? 'text-brand/50' : 'text-muted/30'}`}>
                            {multiplier.toFixed(2)}x
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* Start zone */}
                  <div className="mt-2">
                    <div className="flex items-center gap-2 py-2 px-4 rounded-xl bg-zinc-800/30 border border-zinc-700/20">
                      <span className="text-base">🚶</span>
                      <span className="text-muted text-[12px] font-medium">START</span>
                      <span className="ml-auto text-[11px] text-muted/50 font-mono">1.00x</span>
                    </div>
                  </div>
                </div>

                {/* Result overlay */}
                <AnimatePresence>
                  {(hitCar || cashedOut) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mx-4 mb-4 rounded-xl p-4 border text-center
                        ${hitCar
                          ? 'bg-accent-red/10 border-accent-red/30'
                          : 'bg-brand/10 border-brand/30'
                        }`}
                    >
                      <div className={`text-2xl font-black font-mono ${hitCar ? 'text-accent-red' : 'text-brand'}`}>
                        {hitCar ? '🚗 ROADKILL' : `🐔 ${currentMult.toFixed(2)}x`}
                      </div>
                      <div className={`text-sm mt-1 ${hitCar ? 'text-accent-red/70' : 'text-brand/70'}`}>
                        {hitCar
                          ? `Lost $${parseFloat(betAmount).toFixed(2)} at road ${hitCar.row + 1}`
                          : `Won $${(parseFloat(betAmount) * currentMult).toFixed(2)}`
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <LiveBetsTable game="chicken" />
            </div>
          </div>
        </div>
      </div>

      <FairnessModal
        isOpen={showFairness}
        onClose={() => setShowFairness(false)}
        game="chicken"
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

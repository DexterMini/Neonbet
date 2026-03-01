'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { Sparkles, RotateCcw, Zap, Bird, Car, Flag, User, XCircle, Trophy, Check, AlertTriangle } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { toast } from 'sonner'

/* ── Config ────────────────────────────────────────── */
const MAX_ROWS = 10

const DIFFICULTY_PRESETS = [
  { label: 'Easy',   lanes: 4, color: 'text-brand',     bg: 'bg-brand/15 border-brand/40',         safeLabel: '3 safe', accent: '#00E87B' },
  { label: 'Medium', lanes: 3, color: 'text-amber-400', bg: 'bg-amber-400/15 border-amber-400/40', safeLabel: '2 safe', accent: '#FBBF24' },
  { label: 'Hard',   lanes: 2, color: 'text-red-400',   bg: 'bg-red-400/15 border-red-400/40',     safeLabel: '1 safe', accent: '#F87171' },
]

const getMultiplier = (lanes: number, row: number): number => {
  if (row === 0) return 1
  const edge = 0.97
  // Correct formula: payout = (lanes / (lanes - 1)) * edge per row
  // P(safe) = (lanes-1)/lanes, so fair payout = lanes/(lanes-1)
  let mult = 1
  for (let i = 0; i < row; i++) mult *= (lanes / (lanes - 1)) * edge
  return parseFloat(mult.toFixed(2))
}

interface Row { carIndex: number }

/* ── Floating particles component ──────────────────── */
function FloatingParticles({ active, color }: { active: boolean; color: string }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 6 }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: '100%', x: `${15 + i * 15}%` }}
          animate={{ opacity: [0, 0.6, 0], y: '-10%', x: `${15 + i * 15 + (Math.random() - 0.5) * 20}%` }}
          transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
          className="absolute w-1 h-1 rounded-full"
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

export default function ChickenPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [difficulty, setDifficulty] = useState(1)
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

  useEffect(() => {
    if (scrollRef.current && currentRow > 0) scrollRef.current.scrollTop = 0
  }, [currentRow])

  const generateRows = useCallback(async (): Promise<Row[]> => {
    const r: Row[] = []
    for (let i = 0; i < MAX_ROWS; i++) {
      const { result } = await generateBet('chicken', { row: i, lanes })
      const n = typeof result === 'number' ? result : parseInt(String(result), 16)
      r.push({ carIndex: Math.abs(n) % lanes })
    }
    return r
  }, [generateBet, lanes])

  const startGame = async () => {
    if (parseFloat(betAmount) <= 0 || !initialized || isPlacing) return
    try {
      const nr = await generateRows()
      setRows(nr); setCurrentRow(0); setPicked([]); setHitCar(null); setCashedOut(false); setGameActive(true)
    } catch (err: any) { toast.error(err?.message || 'Error starting game') }
  }

  const pickLane = (row: number, lane: number) => {
    if (!gameActive || row !== currentRow || hitCar || cashedOut) return
    const isSafe = rows[row].carIndex !== lane
    setPicked(p => [...p, { row, lane }])
    if (!isSafe) {
      setHitCar({ row, lane }); setGameActive(false)
      sessionStats.recordBet(false, parseFloat(betAmount), -parseFloat(betAmount), 0)
      toast.error('Hit by a car!')
    } else if (row + 1 >= MAX_ROWS) {
      setCurrentRow(row + 1); setGameActive(false); setCashedOut(true)
      const fm = getMultiplier(lanes, row + 1)
      sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * fm - parseFloat(betAmount), fm)
      toast.success(`Won $${(parseFloat(betAmount) * fm).toFixed(2)}!`)
    } else { setCurrentRow(row + 1) }
  }

  const cashout = () => {
    if (!gameActive || currentRow === 0) return
    setCashedOut(true); setGameActive(false)
    sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * currentMult - parseFloat(betAmount), currentMult)
    toast.success(`Cashed out $${(parseFloat(betAmount) * currentMult).toFixed(2)}!`)
  }

  const resetGame = () => {
    setGameActive(false); setCurrentRow(0); setRows([]); setPicked([]); setHitCar(null); setCashedOut(false)
  }

  const visibleRows = Array.from({ length: MAX_ROWS }, (_, i) => MAX_ROWS - 1 - i)
  const diffPreset = DIFFICULTY_PRESETS[difficulty]
  const gameEnded = !!hitCar || cashedOut

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
                !gameActive && !gameEnded ? (
                  <button onClick={startGame} disabled={parseFloat(betAmount) <= 0 || !initialized}
                    className="w-full py-3.5 bg-gradient-to-r from-brand to-emerald-400 text-background-deep font-bold text-[14px] rounded-xl shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />Cross the Road
                  </button>
                ) : gameActive && currentRow > 0 ? (
                  <motion.button onClick={cashout}
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-full py-3.5 bg-gradient-to-r from-brand via-emerald-400 to-brand text-background-deep font-bold text-[14px] rounded-xl shadow-lg shadow-brand/30 hover:shadow-brand/50 transition-all flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />Cash Out ${(parseFloat(betAmount) * currentMult).toFixed(2)}
                  </motion.button>
                ) : gameActive ? (
                  <div className="w-full py-3.5 bg-surface border border-amber-400/30 font-bold text-[14px] text-amber-400 rounded-xl text-center">
                    <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                      Pick a safe lane!
                    </motion.span>
                  </div>
                ) : (
                  <button onClick={resetGame}
                    className={`w-full py-3.5 font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2
                      ${hitCar ? 'bg-gradient-to-r from-red-500 to-red-400 text-white shadow-lg shadow-red-500/25' : 'bg-gradient-to-r from-brand to-emerald-400 text-background-deep shadow-lg shadow-brand/25'}`}>
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

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Crossed</div>
                  <div className="text-base font-bold text-brand font-mono">{currentRow}/{MAX_ROWS}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Next</div>
                  <div className="text-base font-bold text-amber-400 font-mono">{nextMult.toFixed(2)}x</div>
                </div>
              </div>

              {/* Active multiplier */}
              <AnimatePresence>
                {gameActive && currentRow > 0 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative overflow-hidden rounded-xl border border-brand/25">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand/[0.08] via-brand/[0.04] to-brand/[0.08]" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,232,123,0.1),transparent_70%)]" />
                    <div className="relative flex items-center justify-between p-3.5">
                      <div>
                        <div className="text-[10px] text-muted uppercase mb-0.5">Multiplier</div>
                        <div className="text-2xl text-brand font-black font-mono animate-multiplier-glow">{currentMult.toFixed(2)}x</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted uppercase mb-0.5">Payout</div>
                        <div className="text-2xl text-brand font-black font-mono">${(parseFloat(betAmount) * currentMult).toFixed(2)}</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* ── Right: Road Scene ──────────────────── */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(180deg, #0d1a14 0%, #0a0e0c 30%, #0e1015 100%)' }}>

                {/* Floating particles */}
                <FloatingParticles active={gameActive} color={diffPreset.accent} />

                {/* Top bar */}
                <div className="relative z-10 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/[0.05]"
                  style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3), transparent)' }}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-600/15 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
                        <Bird className="w-6 h-6 text-brand" />
                      </div>
                      {gameActive && (
                        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.3, 0.8] }} transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand" />
                      )}
                    </div>
                    <div>
                      <div className="text-white font-bold text-[15px] tracking-tight">Chicken Road</div>
                      <div className="text-[11px] text-white/35">Avoid the cars, claim the prize</div>
                    </div>
                  </div>

                  {/* Progress dots */}
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-[3px] bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/[0.05]">
                      {Array.from({ length: MAX_ROWS }, (_, i) => (
                        <motion.div key={i}
                          animate={i === currentRow && gameActive ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ repeat: Infinity, duration: 1 }}
                          className={`w-[6px] h-[6px] rounded-full transition-all duration-500
                          ${i < currentRow ? 'bg-brand shadow-sm shadow-brand/60'
                            : i === currentRow && gameActive ? 'bg-amber-400'
                            : 'bg-white/[0.08]'}`} />
                      ))}
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08]">
                      <span className="text-amber-400 font-mono font-bold text-sm">{currentRow}</span>
                      <span className="text-white/25 text-xs">/{MAX_ROWS}</span>
                    </div>
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Road scene */}
                <div className="relative p-3 sm:p-4">
                  {/* Ambient glow */}
                  {gameActive && (
                    <div className="absolute inset-0 pointer-events-none transition-all duration-700" style={{
                      background: `radial-gradient(ellipse at 50% ${90 - (currentRow / MAX_ROWS) * 75}%, ${diffPreset.accent}0A 0%, transparent 55%)`
                    }} />
                  )}

                  {/* Finish line */}
                  <div className="relative mb-2 group">
                    <div className="absolute inset-0 rounded-xl bg-brand/5 blur-xl group-hover:bg-brand/10 transition-colors" />
                    <div className="relative flex items-center gap-3 py-3 px-4 rounded-xl border border-brand/20 overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,232,123,0.08) 0%, rgba(0,232,123,0.02) 50%, rgba(0,232,123,0.06) 100%)',
                      }}>
                      {/* Checkered pattern */}
                      <div className="absolute inset-0 opacity-[0.04]" style={{
                        backgroundImage: `repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)`,
                        backgroundSize: '16px 16px'
                      }} />
                      <div className="relative flex items-center gap-3 flex-1">
                        <Flag className="w-5 h-5 text-brand" />
                        <div>
                          <div className="text-brand text-[13px] font-bold tracking-wide">FINISH LINE</div>
                          <div className="text-brand/40 text-[10px]">Safe across all roads</div>
                        </div>
                      </div>
                      <div className="relative">
                        <span className="text-amber-400 font-mono font-black text-lg">{getMultiplier(lanes, MAX_ROWS).toFixed(2)}x</span>
                      </div>
                    </div>
                  </div>

                  {/* Road grid */}
                  <div ref={scrollRef} className="space-y-[3px] max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
                    {visibleRows.map((row) => {
                      const isCurrentRow = gameActive && row === currentRow
                      const isPastRow = row < currentRow
                      const isFutureRow = row > currentRow
                      const rowPick = picked.find(p => p.row === row)
                      const isHitRow = hitCar?.row === row
                      const multiplier = getMultiplier(lanes, row + 1)
                      const dangerLevel = (row + 1) / MAX_ROWS

                      return (
                        <motion.div
                          key={row}
                          layout
                          initial={false}
                          animate={{ opacity: isFutureRow && !gameEnded ? 0.3 + dangerLevel * 0.15 : 1 }}
                        >
                          <div className={`relative flex items-center gap-2 py-[3px] px-1.5 rounded-xl transition-all duration-300
                            ${isCurrentRow ? 'z-10' : ''}`}>

                            {/* Row indicator */}
                            <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold font-mono shrink-0 transition-all duration-300 overflow-hidden
                              ${isCurrentRow
                                ? 'text-amber-400'
                                : isPastRow
                                ? 'text-brand'
                                : 'text-white/20'
                              }`}>
                              {/* BG */}
                              <div className={`absolute inset-0 rounded-lg transition-all duration-300
                                ${isCurrentRow
                                  ? 'bg-amber-400/15 border border-amber-400/40 shadow-lg shadow-amber-400/10'
                                  : isPastRow
                                  ? 'bg-brand/10 border border-brand/20'
                                  : 'bg-white/[0.03] border border-white/[0.05]'
                                }`} />
                              <span className="relative z-10 flex items-center justify-center">{isPastRow ? <Check className="w-3.5 h-3.5 text-brand" /> : row + 1}</span>
                              {isCurrentRow && (
                                <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }} transition={{ repeat: Infinity, duration: 1.8 }}
                                  className="absolute inset-0 rounded-lg border-2 border-amber-400/50" />
                              )}
                            </div>

                            {/* Lane tiles */}
                            <div className={`flex-1 flex gap-[5px] p-[5px] rounded-xl transition-all duration-300
                              ${isCurrentRow
                                ? 'bg-amber-400/[0.04] ring-1 ring-amber-400/15'
                                : ''}`}>
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
                                    whileHover={isCurrentRow && !hitCar ? { scale: 1.05, y: -3, transition: { duration: 0.15 } } : {}}
                                    whileTap={isCurrentRow && !hitCar ? { scale: 0.93 } : {}}
                                    className={`relative flex-1 h-[50px] sm:h-[54px] rounded-xl font-bold transition-all duration-200 flex items-center justify-center overflow-hidden
                                      ${isHitPick
                                        ? 'shadow-2xl shadow-red-500/30'
                                        : isSafeRevealed && wasPicked
                                        ? 'shadow-lg shadow-brand/20'
                                        : isCurrentRow
                                        ? 'cursor-pointer hover:shadow-xl hover:shadow-amber-400/10'
                                        : 'cursor-default'
                                      }`}
                                    style={{
                                      background: isHitPick
                                        ? 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(239,68,68,0.1))'
                                        : isSafeRevealed && wasPicked
                                        ? 'linear-gradient(135deg, rgba(0,232,123,0.2), rgba(0,232,123,0.08))'
                                        : isSafeRevealed
                                        ? 'linear-gradient(135deg, rgba(0,232,123,0.06), rgba(0,232,123,0.02))'
                                        : isCarRevealed
                                        ? 'rgba(255,255,255,0.015)'
                                        : isCurrentRow
                                        ? 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
                                        : 'rgba(255,255,255,0.015)',
                                    }}
                                  >
                                    {/* Ring border */}
                                    <div className={`absolute inset-0 rounded-xl transition-all duration-200
                                      ${isHitPick
                                        ? 'ring-2 ring-red-500/60'
                                        : isSafeRevealed && wasPicked
                                        ? 'ring-2 ring-brand/50'
                                        : isSafeRevealed
                                        ? 'ring-1 ring-brand/15'
                                        : isCarRevealed
                                        ? 'ring-1 ring-white/[0.04]'
                                        : isCurrentRow
                                        ? 'ring-1 ring-white/[0.08] hover:ring-amber-400/30'
                                        : 'ring-1 ring-white/[0.03]'
                                      }`} />

                                    {/* Asphalt texture */}
                                    {!showResult && (
                                      <div className="absolute inset-0 opacity-[0.025]" style={{
                                        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.15) 6px, rgba(255,255,255,0.15) 7px)',
                                      }} />
                                    )}

                                    {/* Content */}
                                    <div className="relative z-10">
                                      {isHitPick ? (
                                        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: [0, -5, 5, 0] }}
                                          transition={{ type: 'spring', damping: 8 }}
                                          className="flex flex-col items-center">
                                          <Car className="w-6 h-6 text-red-400 drop-shadow-lg" />
                                          <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                                            className="text-[8px] text-red-400 font-black uppercase tracking-widest mt-0.5">CRASH</motion.span>
                                        </motion.div>
                                      ) : isCarRevealed ? (
                                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.3 }}
                                          className="text-base select-none flex items-center justify-center"><Car className="w-4 h-4 text-red-400/30" /></motion.span>
                                      ) : isSafeRevealed && wasPicked ? (
                                        <motion.div initial={{ scale: 0, y: 8 }} animate={{ scale: 1, y: 0 }}
                                          transition={{ type: 'spring', damping: 12 }}
                                          className="flex flex-col items-center">
                                          <Bird className="w-5 h-5 text-brand" />
                                        </motion.div>
                                      ) : isSafeRevealed ? (
                                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.2 }}
                                          className="text-xs text-brand select-none flex items-center justify-center"><Check className="w-3 h-3" /></motion.span>
                                      ) : isCurrentRow ? (
                                        <motion.span animate={{ y: [0, -2, 0], opacity: [0.25, 0.5, 0.25] }}
                                          transition={{ repeat: Infinity, duration: 2.5, delay: l * 0.15 }}
                                          className="text-base select-none">?</motion.span>
                                      ) : null}
                                    </div>
                                  </motion.button>
                                )
                              })}
                            </div>

                            {/* Multiplier */}
                            <div className="w-[60px] shrink-0 text-right">
                              <span className={`inline-block px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all
                                ${isCurrentRow
                                  ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                                  : isPastRow
                                  ? 'text-brand/50'
                                  : 'text-white/15'
                                }`}>
                                {multiplier.toFixed(2)}x
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* Start zone */}
                  <div className="mt-2">
                    <div className="flex items-center gap-3 py-2.5 px-4 rounded-xl border border-white/[0.05]"
                      style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.015), transparent, rgba(255,255,255,0.015))' }}>
                      <User className="w-4 h-4 text-white/50" />
                      <div>
                        <div className="text-white/50 text-[12px] font-bold">START</div>
                        <div className="text-white/20 text-[10px]">Step into the road</div>
                      </div>
                      <span className="ml-auto text-white/15 font-mono text-[11px]">1.00x</span>
                    </div>
                  </div>
                </div>

                {/* Result overlay */}
                <AnimatePresence>
                  {gameEnded && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ type: 'spring', damping: 15 }}
                      className="relative mx-4 mb-4"
                    >
                      <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-sm
                        ${hitCar ? 'border-red-500/25' : 'border-brand/25'}`}>
                        {/* Gradient BG */}
                        <div className={`absolute inset-0 ${hitCar
                          ? 'bg-gradient-to-br from-red-500/15 via-red-900/10 to-transparent'
                          : 'bg-gradient-to-br from-brand/15 via-emerald-900/10 to-transparent'}`} />
                        {/* Radial glow */}
                        <div className={`absolute inset-0 ${hitCar
                          ? 'bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.15),transparent_70%)]'
                          : 'bg-[radial-gradient(circle_at_50%_0%,rgba(0,232,123,0.15),transparent_70%)]'}`} />

                        <div className="relative p-6 text-center">
                          <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 10, delay: 0.1 }}
                            className="text-5xl mb-3">
                            {hitCar ? <XCircle className="w-12 h-12 text-red-400" /> : <Trophy className="w-12 h-12 text-brand" />}
                          </motion.div>
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10, delay: 0.25 }}
                            className={`text-3xl font-black font-mono mb-1 ${hitCar ? 'text-red-400' : 'text-brand animate-multiplier-glow'}`}>
                            {hitCar ? 'ROADKILL' : `${currentMult.toFixed(2)}x`}
                          </motion.div>
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                            className={`text-sm font-medium ${hitCar ? 'text-red-400/60' : 'text-brand/60'}`}>
                            {hitCar ? `Lost $${parseFloat(betAmount).toFixed(2)} at road ${hitCar.row + 1}` : `Won $${(parseFloat(betAmount) * currentMult).toFixed(2)}`}
                          </motion.div>
                        </div>
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

      <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="chicken"
        serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
        previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
    </GameLayout>
  )
}

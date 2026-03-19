'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'
import { toast } from 'sonner'
import { Footprints, Play, RotateCcw, Skull, Star, ArrowUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

/* ── Difficulty configs ───────────────────────────── */
const DIFFICULTIES = [
  { label: 'Easy', cols: 4, trapCount: 1, color: 'brand', rows: 10 },
  { label: 'Medium', cols: 3, trapCount: 1, color: 'amber-400', rows: 10 },
  { label: 'Hard', cols: 2, trapCount: 1, color: 'accent-red', rows: 10 },
] as const

/* ── Multiplier tables ────────────────────────────── */
const MULTIPLIER_TABLES: Record<number, number[]> = {
  4: [1, 1.31, 1.74, 2.30, 3.04, 4.01, 5.30, 7.00, 9.24, 12.20, 16.12],
  3: [1, 1.45, 2.11, 3.05, 4.43, 6.42, 9.31, 13.50, 19.58, 28.40, 41.18],
  2: [1, 1.94, 3.76, 7.30, 14.16, 27.47, 53.30, 103.40, 200.60, 389.20, 755.00],
}

/* ── Floating particles ───────────────────────────── */
const STAIR_PARTICLES = ['#a855f7', '#c084fc', '#e9d5ff', '#7c3aed', '#6d28d9', '#f3e8ff']
function FloatingSteps({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {STAIR_PARTICLES.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${5 + i * 16}%` }}
          animate={{ opacity: [0, 0.35, 0], y: '-10%', x: `${5 + i * 16 + (Math.random() - 0.5) * 10}%` }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

type TileState = 'hidden' | 'safe' | 'trap' | 'skipped'

export default function StairsPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()
  const router = useRouter()

  const [betAmount, setBetAmount] = useState('10.00')
  const [diffIdx, setDiffIdx] = useState(0)
  const [gameActive, setGameActive] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentRow, setCurrentRow] = useState(0) // 0 = not started, 1 = first row
  const [grid, setGrid] = useState<TileState[][]>([])
  const [trapPositions, setTrapPositions] = useState<number[][]>([])
  const [lastWin, setLastWin] = useState<boolean | null>(null)
  const [showFairness, setShowFairness] = useState(false)
  const [history, setHistory] = useState<{ rows: number; won: boolean; multi: number }[]>([])
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)
  const [revealingRow, setRevealingRow] = useState<number | null>(null)

  const diff = DIFFICULTIES[diffIdx]
  const multTable = MULTIPLIER_TABLES[diff.cols]
  const currentMultiplier = multTable[currentRow] ?? multTable[multTable.length - 1]
  const nextMultiplier = multTable[Math.min(currentRow + 1, multTable.length - 1)] ?? currentMultiplier
  const potentialProfit = parseFloat(betAmount) * currentMultiplier - parseFloat(betAmount)

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  const initGrid = useCallback(() => {
    const rows = diff.rows
    const cols = diff.cols
    const newGrid: TileState[][] = []
    const newTraps: number[][] = []

    for (let r = 0; r < rows; r++) {
      newGrid.push(Array(cols).fill('hidden'))
      // Generate trap position for each row
      const trapPos = Math.floor(Math.random() * cols)
      newTraps.push([trapPos])
    }

    setGrid(newGrid)
    setTrapPositions(newTraps)
  }, [diff])

  const startGame = useCallback(() => {
    const bet = parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet) || !initialized) return

    initGrid()
    setCurrentRow(0)
    setGameActive(true)
    setLastWin(null)
    setRevealingRow(null)
  }, [betAmount, initialized, initGrid])

  const pickTile = useCallback(async (col: number) => {
    if (!gameActive || isPlaying || currentRow >= diff.rows) return
    setIsPlaying(true)

    try {
      let trapCol: number

      if (isAuthenticated) {
        const data = await placeBet('stairs', String(parseFloat(betAmount)), 'usdt', {
          difficulty: diff.label.toLowerCase(), row: currentRow, col,
        })
        trapCol = data.result_data?.trap_col ?? Math.floor(Math.random() * diff.cols)
      } else {
        const { result: gameResult } = await generateBet('stairs')
        trapCol = Math.floor((gameResult as number) * diff.cols) % diff.cols
      }
      setTrapPositions(prev => {
        const next = [...prev]
        next[currentRow] = [trapCol]
        return next
      })

      const isTrap = col === trapCol
      setRevealingRow(currentRow)

      // Reveal tiles
      setGrid(prev => {
        const next = prev.map(r => [...r])
        for (let c = 0; c < diff.cols; c++) {
          if (c === col) {
            next[currentRow][c] = isTrap ? 'trap' : 'safe'
          } else if (c === trapCol) {
            next[currentRow][c] = isTrap ? 'trap' : 'skipped'
          } else {
            next[currentRow][c] = 'skipped'
          }
        }
        return next
      })

      await new Promise(r => setTimeout(r, 400))

      if (isTrap) {
        // Game over — reveal all remaining traps
        setGrid(prev => {
          const next = prev.map(r => [...r])
          for (let row = currentRow + 1; row < diff.rows; row++) {
            for (let c = 0; c < diff.cols; c++) {
              if (trapPositions[row]?.includes(c)) {
                next[row][c] = 'trap'
              } else {
                next[row][c] = 'skipped'
              }
            }
          }
          return next
        })

        const bet = parseFloat(betAmount)
        setLastWin(false)
        setGameActive(false)
        setHistory(prev => [{ rows: currentRow, won: false, multi: 0 }, ...prev.slice(0, 19)])
        sessionStats.recordBet(false, bet, -bet, 0)
        toast.error(`💀 Trap! Game over at row ${currentRow + 1}`)
      } else {
        const newRow = currentRow + 1
        setCurrentRow(newRow)

        if (newRow >= diff.rows) {
          // Completed all rows!
          const bet = parseFloat(betAmount)
          const finalMulti = multTable[newRow] ?? multTable[multTable.length - 1]
          setLastWin(true)
          setGameActive(false)
          setHistory(prev => [{ rows: newRow, won: true, multi: finalMulti }, ...prev.slice(0, 19)])
          sessionStats.recordBet(true, bet, bet * finalMulti - bet, finalMulti)
          toast.success(`🏆 Cleared all ${diff.rows} rows! ${finalMulti}x`)
        } else {
          toast.success(`✓ Row ${currentRow + 1} cleared! ${multTable[newRow]?.toFixed(2)}x`)
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    } finally {
      setIsPlaying(false)
      setRevealingRow(null)
    }
  }, [gameActive, isPlaying, currentRow, diff, isAuthenticated, placeBet, generateBet, betAmount, trapPositions, multTable, sessionStats])

  const cashOut = useCallback(() => {
    if (!gameActive || currentRow < 1) return
    const bet = parseFloat(betAmount)
    const profit = bet * currentMultiplier - bet
    setLastWin(true)
    setGameActive(false)
    setHistory(prev => [{ rows: currentRow, won: true, multi: currentMultiplier }, ...prev.slice(0, 19)])
    sessionStats.recordBet(true, bet, profit, currentMultiplier)
    toast.success(`Cashed out at ${currentMultiplier}x! Won $${profit.toFixed(2)}`)
  }, [gameActive, currentRow, betAmount, currentMultiplier, sessionStats])

  const autoBetHandler = useCallback(async (amount: number): Promise<{ won: boolean; profit: number }> => {
    if (!initialized) return { won: false, profit: -amount }

    // Auto-bet: pick random col for 3 rows then cash out
    let multi = 1
    for (let r = 0; r < 3; r++) {
      const { result: gameResult } = await generateBet('stairs')
      const trapCol = Math.floor((gameResult as number) * diff.cols) % diff.cols
      const pickCol = Math.floor(Math.random() * diff.cols)
      if (pickCol === trapCol) {
        sessionStats.recordBet(false, amount, -amount, 0)
        return { won: false, profit: -amount }
      }
      multi = multTable[r + 1] ?? multi
    }
    const profit = amount * multi - amount
    sessionStats.recordBet(true, amount, profit, multi)
    return { won: true, profit }
  }, [initialized, generateBet, diff, multTable, sessionStats])

  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)

  const tileIcon = (state: TileState) => {
    switch (state) {
      case 'safe': return <Star className="w-5 h-5 text-brand drop-shadow-[0_0_8px_rgba(0,232,123,0.6)]" />
      case 'trap': return <Skull className="w-5 h-5 text-accent-red drop-shadow-[0_0_8px_rgba(255,71,87,0.6)]" />
      default: return null
    }
  }

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          {/* History */}
          {history.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider shrink-0">History</span>
              {history.map((h, i) => (
                <motion.span key={i} initial={i === 0 ? { scale: 0, opacity: 0 } : {}} animate={{ scale: 1, opacity: 1 }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold whitespace-nowrap ${h.won ? 'bg-brand/15 text-brand' : 'bg-accent-red/15 text-accent-red'}`}>
                  {h.won ? `${h.multi}x` : `R${h.rows}`}
                </motion.span>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            <BetControls betAmount={betAmount} onBetAmountChange={setBetAmount} disabled={gameActive}
              serverSeedHash={serverSeedHash} nonce={nonce} onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig} onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState} onAutoBetStart={autoBetStart} onAutoBetStop={autoBetStop}
              actionButton={
                !gameActive ? (
                  <button onClick={startGame} disabled={isPlaying || isPlacing || !initialized}
                    className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                      isPlaying || isPlacing ? 'bg-surface text-muted cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-500/30 hover:brightness-110'
                    }`}>
                    <Play className="w-4 h-4" /> Start Climb
                  </button>
                ) : (
                  <button onClick={cashOut} disabled={currentRow < 1 || isPlaying}
                    className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                      currentRow < 1 || isPlaying ? 'bg-surface text-muted cursor-not-allowed' : 'bg-gradient-to-r from-brand to-emerald-400 text-background-deep shadow-lg shadow-brand/30 hover:brightness-110'
                    }`}>
                    Cash Out {currentMultiplier.toFixed(2)}x (${potentialProfit.toFixed(2)})
                  </button>
                )
              }
            >
              {/* Difficulty */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">Difficulty</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIFFICULTIES.map((d, i) => (
                    <button key={d.label} onClick={() => { if (!gameActive) setDiffIdx(i) }} disabled={gameActive}
                      className={`py-2 rounded-lg text-[12px] font-bold transition-all ${
                        diffIdx === i
                          ? i === 0 ? 'bg-brand/15 border border-brand/40 text-brand' :
                            i === 1 ? 'bg-amber-400/15 border border-amber-400/40 text-amber-400' :
                            'bg-accent-red/15 border border-accent-red/40 text-accent-red'
                          : 'bg-surface border border-border text-muted hover:text-white'
                      }`}>
                      {d.label}
                      <div className="text-[9px] font-mono mt-0.5 opacity-60">{d.cols} cols</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Multiplier ladder */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Multiplier Ladder</span>
                <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
                  {multTable.slice(1).map((m, i) => {
                    const rowIdx = i + 1
                    const isCurrent = rowIdx === currentRow + 1 && gameActive
                    const isPast = rowIdx <= currentRow && gameActive
                    return (
                      <div key={i} className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-mono transition-all ${
                        isCurrent ? 'bg-purple-500/15 border border-purple-400/30 text-purple-300' :
                        isPast ? 'bg-brand/10 text-brand/60' :
                        'text-muted'
                      }`}>
                        <span>Row {rowIdx}</span>
                        <span className="font-bold">{m}x</span>
                      </div>
                    )
                  }).reverse()}
                </div>
              </div>

              {/* Current state */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Multi</div>
                  <div className={`text-base font-bold font-mono ${currentMultiplier > 1 ? 'text-brand' : 'text-white'}`}>
                    {currentMultiplier.toFixed(2)}x
                  </div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Next</div>
                  <div className="text-base font-bold text-purple-400 font-mono">{nextMultiplier.toFixed(2)}x</div>
                </div>
              </div>

              {/* Profit */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Profit on Cash Out</span>
                <div className="bg-surface border border-border rounded-xl px-3 py-2.5 font-mono text-brand text-[13px] font-bold">
                  +${potentialProfit > 0 ? potentialProfit.toFixed(2) : '0.00'}
                </div>
              </div>
            </BetControls>

            {/* Game area */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #140a1e 0%, #10081a 40%, #0d0f1a 100%)' }}>
                <FloatingSteps active />

                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-purple-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(168,85,247,0.08) 100%)' }}>
                      <Footprints className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Stairs</h2>
                      <p className="text-purple-300/30 text-[10px] mt-0.5">{diff.label} • {diff.cols} columns</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {gameActive && (
                      <div className="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 ring-1 ring-purple-400/20 font-mono">
                        Row {currentRow}/{diff.rows} • {currentMultiplier.toFixed(2)}x
                      </div>
                    )}
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Stair Grid */}
                <div className="relative z-10 px-4 sm:px-8 py-4">
                  {!gameActive && grid.length === 0 ? (
                    <div className="h-72 sm:h-80 flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center ring-1 ring-white/[0.06]"
                        style={{ background: 'linear-gradient(145deg, rgba(168,85,247,0.12) 0%, rgba(168,85,247,0.04) 100%)' }}>
                        <Footprints className="w-10 h-10 text-purple-400/30" />
                      </div>
                      <div className="text-white/25 text-sm">Choose difficulty and start climbing</div>
                    </div>
                  ) : (
                    <div className="flex flex-col-reverse gap-1.5">
                      {grid.map((row, rowIdx) => {
                        const isActiveRow = rowIdx === currentRow && gameActive
                        const isPastRow = rowIdx < currentRow
                        const isFutureRow = rowIdx > currentRow

                        return (
                          <div key={rowIdx} className="flex items-center gap-2">
                            {/* Row label */}
                            <div className={`w-10 text-right text-[11px] font-mono font-bold shrink-0 ${
                              isActiveRow ? 'text-purple-400' : isPastRow ? 'text-brand/40' : 'text-white/15'
                            }`}>
                              {multTable[rowIdx + 1]?.toFixed(1)}x
                            </div>

                            {/* Tiles */}
                            <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${diff.cols}, 1fr)` }}>
                              {row.map((tile, colIdx) => {
                                const canClick = isActiveRow && tile === 'hidden' && !isPlaying

                                return (
                                  <motion.button
                                    key={colIdx}
                                    onClick={() => canClick && pickTile(colIdx)}
                                    disabled={!canClick}
                                    whileHover={canClick ? { scale: 1.05 } : {}}
                                    whileTap={canClick ? { scale: 0.95 } : {}}
                                    className={`relative h-10 sm:h-12 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                                      tile === 'safe' ? 'bg-brand/20 border-2 border-brand/50 shadow-[0_0_15px_rgba(0,232,123,0.2)]' :
                                      tile === 'trap' ? 'bg-accent-red/20 border-2 border-accent-red/50 shadow-[0_0_15px_rgba(255,71,87,0.2)]' :
                                      tile === 'skipped' ? 'bg-white/[0.03] border border-white/[0.04]' :
                                      canClick ? 'bg-purple-500/10 border-2 border-purple-400/30 hover:bg-purple-500/20 hover:border-purple-400/50 cursor-pointer' :
                                      'bg-white/[0.03] border border-white/[0.06]'
                                    }`}
                                  >
                                    {tile === 'hidden' && isActiveRow && (
                                      <ArrowUp className="w-4 h-4 text-purple-400/60" />
                                    )}
                                    {tileIcon(tile)}
                                  </motion.button>
                                )
                              })}
                            </div>

                            {/* Row indicator */}
                            <div className={`w-6 text-[10px] font-bold shrink-0 ${
                              isActiveRow ? 'text-purple-400' : isPastRow ? 'text-brand/40' : 'text-transparent'
                            }`}>
                              {isActiveRow ? '◀' : isPastRow ? '✓' : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Game over banner */}
                {!gameActive && lastWin !== null && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 px-5 pb-5 text-center">
                    <span className={`inline-flex items-center gap-2 text-sm font-bold px-5 py-2 rounded-full ${
                      lastWin ? 'bg-brand/15 text-brand ring-1 ring-brand/20' : 'bg-accent-red/15 text-accent-red ring-1 ring-accent-red/20'
                    }`}>
                      {lastWin ? `🏆 Won ${currentMultiplier}x!` : `💀 Hit trap at row ${currentRow + 1}`}
                    </span>
                  </motion.div>
                )}
              </div>

              <LiveBetsTable game="stairs" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="stairs"
            serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
            previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

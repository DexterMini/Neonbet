'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { Bomb, Shield, Sparkles, Diamond, RotateCcw } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'
import { toast } from 'sonner'

const GRID_SIZE = 25
const GRID_COLS = 5

const calcMultiplier = (mines: number, revealed: number): number => {
  if (revealed === 0) return 1
  const safe = GRID_SIZE - mines
  let mult = 1
  for (let i = 0; i < revealed; i++) {
    mult *= (safe - i) / (GRID_SIZE - mines - i)
  }
  return parseFloat((0.99 / mult).toFixed(2))
}

export default function MinesPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [numMines, setNumMines] = useState(3)
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [gameActive, setGameActive] = useState(false)
  const [minePositions, setMinePositions] = useState<number[]>([])
  const [revealed, setRevealed] = useState<number[]>([])
  const [hitMine, setHitMine] = useState<number | null>(null)
  const [cashoutAmount, setCashoutAmount] = useState(0)
  const [showFairness, setShowFairness] = useState(false)

  const maxMines = GRID_SIZE - 1
  const currentMult = calcMultiplier(numMines, revealed.length)
  const nextMult = calcMultiplier(numMines, revealed.length + 1)
  const potentialProfit = parseFloat(betAmount) * currentMult - parseFloat(betAmount)
  const minePresets = [1, 3, 5, 10, 24]

  const startGame = async () => {
    if (parseFloat(betAmount) <= 0 || !initialized || isPlacing) return
    try {
      let positions: number[]
      if (isAuthenticated) {
        const data = await placeBet('mines', betAmount, 'usdt', { mine_count: numMines, revealed_tiles: [], cashed_out: false })
        positions = data.result_data?.mine_positions ?? []
      } else {
        const { result } = await generateBet('mines', { gridSize: GRID_SIZE, mineCount: numMines })
        positions = result as number[]
      }
      setMinePositions(positions)
      setRevealed([])
      setHitMine(null)
      setGameActive(true)
      setCashoutAmount(parseFloat(betAmount))
    } catch (err: any) {
      toast.error(err?.message || 'Error starting game')
    }
  }

  const revealTile = (idx: number) => {
    if (!gameActive || revealed.includes(idx) || hitMine !== null) return
    if (minePositions.includes(idx)) {
      setHitMine(idx)
      setGameActive(false)
      sessionStats.recordBet(false, parseFloat(betAmount), -parseFloat(betAmount), 0)
    } else {
      const newRevealed = [...revealed, idx]
      setRevealed(newRevealed)
      setCashoutAmount(parseFloat(betAmount) * calcMultiplier(numMines, newRevealed.length))
    }
  }

  const cashout = () => {
    if (!gameActive || revealed.length === 0) return
    setGameActive(false)
    const cashProfit = cashoutAmount - parseFloat(betAmount)
    sessionStats.recordBet(true, parseFloat(betAmount), cashProfit, currentMult)
    toast.success(`Cashed out $${cashoutAmount.toFixed(2)}!`)
  }

  const resetGame = () => {
    setGameActive(false)
    setMinePositions([])
    setRevealed([])
    setHitMine(null)
    setCashoutAmount(0)
  }

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: Controls */}
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={gameActive}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              showAutoTab={false}
              actionButton={
                !gameActive ? (
                  <button onClick={startGame} disabled={parseFloat(betAmount) <= 0 || !initialized}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />Start Game
                  </button>
                ) : hitMine !== null ? (
                  <button onClick={resetGame}
                    className="w-full py-3.5 bg-accent-red text-white font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />Play Again
                  </button>
                ) : (
                  <button onClick={cashout} disabled={revealed.length === 0}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    Cash Out ${cashoutAmount.toFixed(2)}
                  </button>
                )
              }
            >
              {/* Mines Count */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Mines</span>
                  <span className="text-[13px] text-brand font-mono font-bold">{numMines}</span>
                </div>
                <input type="range" min="1" max={maxMines} value={numMines} onChange={e => setNumMines(parseInt(e.target.value))} disabled={gameActive}
                  className="w-full h-1.5 bg-surface rounded-full appearance-none cursor-pointer accent-brand disabled:opacity-50 mb-2" />
                <div className="flex gap-1.5">
                  {minePresets.map(p => (
                    <button key={p} onClick={() => !gameActive && setNumMines(p)} disabled={gameActive}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 ${numMines === p ? 'bg-brand/15 border border-brand/40 text-brand' : 'bg-surface border border-border text-muted hover:text-white'}`}>{p}</button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Next Tile</div>
                  <div className="text-base font-bold text-brand font-mono">{nextMult.toFixed(2)}x</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Profit</div>
                  <div className="text-base font-bold text-brand font-mono">${potentialProfit > 0 ? '+' : ''}{potentialProfit.toFixed(2)}</div>
                </div>
              </div>

              {/* Active game multiplier */}
              <AnimatePresence>
                {gameActive && revealed.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="bg-brand/[0.06] rounded-xl p-3.5 border border-brand/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-muted uppercase mb-0.5">Current</div>
                        <div className="text-xl text-brand font-bold font-mono">{currentMult.toFixed(2)}x</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted uppercase mb-0.5">Payout</div>
                        <div className="text-xl text-brand font-bold font-mono">${cashoutAmount.toFixed(2)}</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* Right: Game Board */}
            <div className="flex-1 min-w-0">
              <div className="bg-background-secondary rounded-2xl border border-border/60 overflow-hidden p-5">
                {/* Stats bar */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Diamond className="w-4 h-4 text-brand" />
                      <span className="text-brand font-bold font-mono">{revealed.length}</span>
                      <span className="text-muted text-sm">gems</span>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-2">
                      <Bomb className="w-4 h-4 text-accent-red" />
                      <span className="text-accent-red font-bold font-mono">{numMines}</span>
                      <span className="text-muted text-sm">mines</span>
                    </div>
                  </div>
                  <span className="text-muted text-sm">{GRID_SIZE - numMines - revealed.length} safe left</span>
                </div>

                {/* Grid */}
                <div className="grid gap-2 sm:gap-3 max-w-[420px] mx-auto"
                  style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
                  {Array.from({ length: GRID_SIZE }, (_, i) => {
                    const isRevealed = revealed.includes(i)
                    const isMine = minePositions.includes(i)
                    const isHit = hitMine === i
                    const showMine = hitMine !== null && isMine
                    const gameOver = hitMine !== null

                    return (
                      <motion.button key={i} onClick={() => revealTile(i)}
                        disabled={!gameActive || isRevealed || gameOver}
                        whileHover={gameActive && !isRevealed && !gameOver ? { scale: 1.06, y: -2 } : {}}
                        whileTap={gameActive && !isRevealed && !gameOver ? { scale: 0.94 } : {}}
                        className={`aspect-square rounded-xl sm:rounded-2xl transition-all duration-200 flex items-center justify-center
                          ${isHit ? 'bg-accent-red/80 shadow-lg shadow-accent-red/40 animate-pulse'
                            : showMine ? 'bg-surface border border-accent-red/30'
                            : isRevealed ? 'bg-brand/20 border border-brand/40 shadow-lg shadow-brand/20'
                            : gameOver ? 'bg-surface border border-border/40 cursor-not-allowed opacity-50'
                            : 'bg-surface border border-border hover:border-brand/40 hover:bg-surface-lighter cursor-pointer'}`}>
                        <AnimatePresence mode="wait">
                          {showMine ? (
                            <motion.div key="mine" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                              <Bomb className="w-6 h-6 sm:w-7 sm:h-7 text-accent-red" />
                            </motion.div>
                          ) : isRevealed ? (
                            <motion.div key="gem" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                              <Diamond className="w-6 h-6 sm:w-7 sm:h-7 text-brand" />
                            </motion.div>
                          ) : (
                            <div key="hidden" className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-surface-lighter/50" />
                          )}
                        </AnimatePresence>
                      </motion.button>
                    )
                  })}
                </div>

                {/* Game Over / Win Messages */}
                <AnimatePresence>
                  {hitMine !== null && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="mt-5 text-center">
                      <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-accent-red/10 border border-accent-red/30 rounded-xl">
                        <Bomb className="w-5 h-5 text-accent-red" />
                        <div className="text-left">
                          <div className="text-accent-red font-bold text-sm">Mine hit!</div>
                          <div className="text-muted text-xs">Better luck next time</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {!gameActive && revealed.length > 0 && hitMine === null && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="mt-5 text-center">
                      <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-brand/10 border border-brand/30 rounded-xl">
                        <Diamond className="w-5 h-5 text-brand" />
                        <div className="text-left">
                          <div className="text-brand font-bold text-sm">Cashed out ${cashoutAmount.toFixed(2)}!</div>
                          <div className="text-muted text-xs">Multiplier: {currentMult.toFixed(2)}x</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <LiveBetsTable game="mines" />
            </div>
          </div>
        </div>
      </div>

      <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="mines" serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce} previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
    </GameLayout>
  )
}

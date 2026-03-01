'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { Bomb, Diamond, Sparkles, RotateCcw } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'

const GRID_SIZE = 25
const GRID_COLS = 5
const minePresets = [1, 3, 5, 10, 24]

const calcMultiplier = (numMines: number, revealed: number): number => {
  if (revealed === 0) return 1
  let prob = 1
  for (let i = 0; i < revealed; i++) prob *= (GRID_SIZE - numMines - i) / (GRID_SIZE - i)
  return parseFloat((0.97 / prob).toFixed(4))
}

/* ── Floating sparkle particles ───────────────────── */
const GEM_COLORS = ['#22d3ee', '#06b6d4', '#67e8f9', '#a5f3fc', '#0891b2', '#0e7490']
function FloatingGems({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {GEM_COLORS.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${8 + i * 15}%`, rotate: 0 }}
          animate={{ opacity: [0, 0.3, 0], y: '-10%', x: `${8 + i * 15 + (Math.random() - 0.5) * 12}%`, rotate: [0, 120, 240] }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

export default function MinesPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [numMines, setNumMines] = useState(3)
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

  const startGame = async () => {
    if (parseFloat(betAmount) <= 0 || !initialized) return
    try {
      let positions: number[]
      if (isAuthenticated) {
        const data = await placeBet('mines', betAmount, 'usdt', { mines: numMines })
        positions = data.result_data?.mine_positions ?? []
      } else {
        const { result } = await generateBet('mines', { mines: numMines, gridSize: GRID_SIZE })
        positions = result as number[]
      }
      setMinePositions(positions); setRevealed([]); setHitMine(null); setCashoutAmount(0); setGameActive(true)
    } catch (err: any) { toast.error(err?.message || 'Error starting game') }
  }

  const revealTile = (index: number) => {
    if (!gameActive || revealed.includes(index) || hitMine !== null) return
    if (minePositions.includes(index)) {
      setHitMine(index)
      setGameActive(false)
      sessionStats.recordBet(false, parseFloat(betAmount), -parseFloat(betAmount), 0)
      toast.error('Mine hit! Game over')
    } else {
      const newRevealed = [...revealed, index]
      setRevealed(newRevealed)
      const mult = calcMultiplier(numMines, newRevealed.length)
      setCashoutAmount(parseFloat(betAmount) * mult)
      if (newRevealed.length === GRID_SIZE - numMines) {
        setGameActive(false)
        const profit = parseFloat(betAmount) * mult - parseFloat(betAmount)
        sessionStats.recordBet(true, parseFloat(betAmount), profit, mult)
        toast.success(`All gems found! Won $${(parseFloat(betAmount) * mult).toFixed(2)}`)
      }
    }
  }

  const cashout = () => {
    if (!gameActive || revealed.length === 0) return
    setGameActive(false)
    const profit = cashoutAmount - parseFloat(betAmount)
    sessionStats.recordBet(true, parseFloat(betAmount), profit, currentMult)
    toast.success(`Cashed out $${cashoutAmount.toFixed(2)}!`)
  }

  const resetGame = () => {
    setGameActive(false); setMinePositions([]); setRevealed([]); setHitMine(null); setCashoutAmount(0)
  }

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          <div className="flex flex-col lg:flex-row gap-4">
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
                    className="w-full py-3.5 bg-gradient-to-r from-brand to-emerald-400 text-background-deep font-bold text-[14px] rounded-xl shadow-lg shadow-brand/30 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />Start Game
                  </button>
                ) : hitMine !== null ? (
                  <button onClick={resetGame}
                    className="w-full py-3.5 bg-gradient-to-r from-red-500 to-red-400 text-white font-bold text-[14px] rounded-xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />Play Again
                  </button>
                ) : (
                  <button onClick={cashout} disabled={revealed.length === 0}
                    className="w-full py-3.5 bg-gradient-to-r from-brand to-emerald-400 text-background-deep font-bold text-[14px] rounded-xl shadow-lg shadow-brand/30 hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
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

            {/* Right: Game Board — Premium Scene */}
            <div className="flex-1 min-w-0">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #0a1a18 0%, #0b1414 40%, #0d0f1a 100%)' }}>
                <FloatingGems active />

                {/* ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(0,232,123,0.06) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-brand/20"
                      style={{ background: 'linear-gradient(135deg, rgba(0,232,123,0.2) 0%, rgba(0,232,123,0.06) 100%)' }}>
                      <Diamond className="w-4 h-4 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Mines</h2>
                      <p className="text-brand/30 text-[10px] mt-0.5">Find the gems</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Diamond className="w-3.5 h-3.5 text-brand" />
                      <span className="text-brand font-bold font-mono">{revealed.length}</span>
                    </div>
                    <div className="w-px h-4 bg-white/[0.06]" />
                    <div className="flex items-center gap-2">
                      <Bomb className="w-3.5 h-3.5 text-accent-red" />
                      <span className="text-accent-red font-bold font-mono">{numMines}</span>
                    </div>
                    <div className="w-px h-4 bg-white/[0.06]" />
                    <span className="text-white/25 text-[11px]">{GRID_SIZE - numMines - revealed.length} left</span>
                    <div className="w-px h-4 bg-white/[0.06]" />
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Grid */}
                <div className="relative z-10 px-5 pb-5">
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
                          whileHover={gameActive && !isRevealed && !gameOver ? { scale: 1.08, y: -3 } : {}}
                          whileTap={gameActive && !isRevealed && !gameOver ? { scale: 0.92 } : {}}
                          className="aspect-square rounded-xl sm:rounded-2xl transition-all duration-200 flex items-center justify-center ring-1"
                          style={{
                            background: isHit ? 'linear-gradient(135deg, rgba(255,71,87,0.5) 0%, rgba(255,71,87,0.25) 100%)'
                              : showMine ? 'linear-gradient(135deg, rgba(255,71,87,0.12) 0%, rgba(255,71,87,0.04) 100%)'
                              : isRevealed ? 'linear-gradient(135deg, rgba(0,232,123,0.2) 0%, rgba(0,232,123,0.06) 100%)'
                              : gameOver ? 'rgba(15,18,25,0.4)' : 'linear-gradient(145deg, rgba(20,25,35,0.8) 0%, rgba(15,18,25,0.6) 100%)',
                            boxShadow: isHit ? '0 0 25px rgba(255,71,87,0.4)' : isRevealed ? '0 4px 15px rgba(0,232,123,0.15)' : undefined,
                            ...(isHit ? { borderColor: 'rgba(255,71,87,0.4)' } : isRevealed ? { borderColor: 'rgba(0,232,123,0.25)' } : {}),
                          }}
                          {...({
                            className: `aspect-square rounded-xl sm:rounded-2xl transition-all duration-200 flex items-center justify-center ring-1 ${
                              isHit ? 'ring-accent-red/40 animate-pulse'
                                : showMine ? 'ring-accent-red/20'
                                : isRevealed ? 'ring-brand/25'
                                : gameOver ? 'ring-white/[0.03] cursor-not-allowed opacity-40'
                                : 'ring-white/[0.06] hover:ring-brand/30 cursor-pointer'
                            }`,
                          } as any)}>
                          <AnimatePresence mode="wait">
                            {showMine ? (
                              <motion.div key="mine" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                <Bomb className="w-6 h-6 sm:w-7 sm:h-7 text-accent-red drop-shadow-[0_0_8px_rgba(255,71,87,0.5)]" />
                              </motion.div>
                            ) : isRevealed ? (
                              <motion.div key="gem" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                <Diamond className="w-6 h-6 sm:w-7 sm:h-7 text-brand drop-shadow-[0_0_8px_rgba(0,232,123,0.5)]" />
                              </motion.div>
                            ) : (
                              <div key="hidden" className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }} />
                            )}
                          </AnimatePresence>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                {/* Premium Result Overlays */}
                <AnimatePresence>
                  {hitMine !== null && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                      className="relative z-10 mx-5 mb-5">
                      <div className="flex items-center justify-center gap-3 px-5 py-3 rounded-xl ring-1 ring-accent-red/20"
                        style={{ background: 'linear-gradient(135deg, rgba(255,71,87,0.12) 0%, rgba(255,71,87,0.04) 100%)' }}>
                        <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: 2, duration: 0.3 }}>
                          <Bomb className="w-5 h-5 text-accent-red" />
                        </motion.div>
                        <div className="text-left">
                          <div className="text-accent-red font-bold text-sm">Mine hit!</div>
                          <div className="text-white/25 text-xs">Better luck next time</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {!gameActive && revealed.length > 0 && hitMine === null && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                      className="relative z-10 mx-5 mb-5">
                      <div className="flex items-center justify-center gap-3 px-5 py-3 rounded-xl ring-1 ring-brand/20"
                        style={{ background: 'linear-gradient(135deg, rgba(0,232,123,0.12) 0%, rgba(0,232,123,0.04) 100%)' }}>
                        <Diamond className="w-5 h-5 text-brand" />
                        <div className="text-left">
                          <div className="text-brand font-bold text-sm">Cashed out ${cashoutAmount.toFixed(2)}!</div>
                          <div className="text-white/25 text-xs">Multiplier: {currentMult.toFixed(2)}x</div>
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

      <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="mines"
        serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
        previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
    </GameLayout>
  )
}

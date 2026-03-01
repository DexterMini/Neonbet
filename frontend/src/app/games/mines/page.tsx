'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { useDemoBalance } from '@/stores/demoBalanceStore'
import { toast } from 'sonner'
import { Bomb, Diamond, Sparkles, RotateCcw, RefreshCw, Shuffle } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'

const GRID_OPTIONS = [
  { size: 25, cols: 5 },
  { size: 36, cols: 6 },
  { size: 49, cols: 7 },
  { size: 64, cols: 8 },
]

const minePresets = [1, 3, 5, 10, 24]

const calcMultiplier = (gridSize: number, numMines: number, revealed: number): number => {
  if (revealed === 0) return 1
  let prob = 1
  for (let i = 0; i < revealed; i++) prob *= (gridSize - numMines - i) / (gridSize - i)
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
  const { balance: demoBalance, deduct, credit, refill } = useDemoBalance()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [gridSize, setGridSize] = useState(25)
  const [numMines, setNumMines] = useState(3)
  const [gameActive, setGameActive] = useState(false)
  const [minePositions, setMinePositions] = useState<number[]>([])
  const [revealed, setRevealed] = useState<number[]>([])
  const [hitMine, setHitMine] = useState<number | null>(null)
  const [cashoutAmount, setCashoutAmount] = useState(0)
  const [showFairness, setShowFairness] = useState(false)

  const gridCols = GRID_OPTIONS.find(g => g.size === gridSize)?.cols ?? 5
  const maxMines = gridSize - 1
  const safeGems = gridSize - numMines

  const currentMult = calcMultiplier(gridSize, numMines, revealed.length)
  const nextMult = calcMultiplier(gridSize, numMines, revealed.length + 1)
  const bet = parseFloat(betAmount) || 0
  const currentProfit = bet * currentMult - bet
  const nextProfit = bet * nextMult - bet
  const nextGemValue = bet * nextMult

  // Payout table: multiplier for each gem count 0..N
  const payoutRow = useMemo(() => {
    const maxShow = Math.min(safeGems, 10)
    return Array.from({ length: maxShow + 1 }, (_, k) => ({
      gems: k,
      mult: calcMultiplier(gridSize, numMines, k),
    }))
  }, [gridSize, numMines, safeGems])

  const startGame = async () => {
    if (bet <= 0 || !initialized) return
    if (!isAuthenticated && demoBalance < bet) {
      toast.error('Insufficient balance! Click refill to get more funds.')
      return
    }
    try {
      let positions: number[]
      if (isAuthenticated) {
        const data = await placeBet('mines', betAmount, 'usdt', { mines: numMines })
        positions = data.result_data?.mine_positions ?? []
      } else {
        deduct(bet)
        const { result } = await generateBet('mines', { mines: numMines, gridSize })
        positions = result as number[]
      }
      setMinePositions(positions); setRevealed([]); setHitMine(null); setCashoutAmount(0); setGameActive(true)
    } catch (err: any) {
      toast.error(err?.message || 'Error starting game')
    }
  }

  const revealTile = (index: number) => {
    if (!gameActive || revealed.includes(index) || hitMine !== null) return
    if (minePositions.includes(index)) {
      setHitMine(index)
      setGameActive(false)
      sessionStats.recordBet(false, bet, -bet, 0)
      toast.error('Mine hit! Game over')
    } else {
      const newRevealed = [...revealed, index]
      setRevealed(newRevealed)
      const mult = calcMultiplier(gridSize, numMines, newRevealed.length)
      setCashoutAmount(bet * mult)
      if (newRevealed.length === gridSize - numMines) {
        setGameActive(false)
        const profit = bet * mult - bet
        if (!isAuthenticated) credit(bet * mult)
        sessionStats.recordBet(true, bet, profit, mult)
        toast.success(`All gems found! Won $${(bet * mult).toFixed(2)}`)
      }
    }
  }

  const cashout = () => {
    if (!gameActive || revealed.length === 0) return
    setGameActive(false)
    const profit = cashoutAmount - bet
    if (!isAuthenticated) credit(cashoutAmount)
    sessionStats.recordBet(true, bet, profit, currentMult)
    toast.success(`Cashed out $${cashoutAmount.toFixed(2)}!`)
  }

  const randomPick = () => {
    if (!gameActive || hitMine !== null) return
    // Find all unrevealed safe tiles
    const safeTiles = Array.from({ length: gridSize }, (_, i) => i)
      .filter(i => !revealed.includes(i) && !minePositions.includes(i))
    if (safeTiles.length === 0) return
    const pick = safeTiles[Math.floor(Math.random() * safeTiles.length)]
    revealTile(pick)
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
                  <button onClick={startGame} disabled={bet <= 0 || !initialized}
                    className="w-full py-3.5 bg-gradient-to-r from-brand to-emerald-400 text-background-deep font-bold text-[14px] rounded-xl shadow-lg shadow-brand/30 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />Start Game
                  </button>
                ) : hitMine !== null ? (
                  <button onClick={resetGame}
                    className="w-full py-3.5 bg-gradient-to-r from-red-500 to-red-400 text-white font-bold text-[14px] rounded-xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />Play Again
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button onClick={cashout} disabled={revealed.length === 0}
                      className="w-full py-3.5 bg-gradient-to-r from-brand to-emerald-400 text-background-deep font-bold text-[14px] rounded-xl shadow-lg shadow-brand/30 hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                      Cash Out ${cashoutAmount.toFixed(2)}
                    </button>
                    <button onClick={randomPick}
                      className="w-full py-2.5 bg-surface border border-border rounded-xl text-muted-light font-bold text-[13px] hover:text-white hover:border-brand/30 transition-all flex items-center justify-center gap-2">
                      <Shuffle className="w-4 h-4" />Pick Random Tile
                    </button>
                  </div>
                )
              }
            >
              {/* Demo Balance */}
              {!isAuthenticated && (
                <div className="flex items-center justify-between bg-surface rounded-xl p-2.5 border border-border">
                  <div>
                    <div className="text-[10px] text-muted uppercase tracking-wider">Demo Balance</div>
                    <div className="text-base font-bold text-white font-mono">${demoBalance.toFixed(2)}</div>
                  </div>
                  {demoBalance < 1 && (
                    <button onClick={refill}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 border border-brand/30 rounded-lg text-brand text-[11px] font-bold hover:bg-brand/20 transition-all">
                      <RefreshCw className="w-3 h-3" />Refill
                    </button>
                  )}
                </div>
              )}

              {/* Grid Size */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Grid Size</span>
                <div className="flex gap-1.5">
                  {GRID_OPTIONS.map(g => (
                    <button key={g.size} onClick={() => { if (!gameActive) { setGridSize(g.size); if (numMines >= g.size) setNumMines(Math.min(numMines, g.size - 1)) } }}
                      disabled={gameActive}
                      className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50
                        ${gridSize === g.size
                          ? 'bg-brand/15 border border-brand/40 text-brand shadow-sm shadow-brand/10'
                          : 'bg-surface border border-border text-muted hover:text-white'}`}>
                      {g.size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mines Count */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Mines</span>
                  <span className="text-[13px] text-brand font-mono font-bold">{numMines}</span>
                </div>
                <input type="range" min="1" max={Math.min(maxMines, 24)} value={numMines} onChange={e => setNumMines(parseInt(e.target.value))} disabled={gameActive}
                  className="w-full h-1.5 bg-surface rounded-full appearance-none cursor-pointer accent-brand disabled:opacity-50 mb-2" />
                <div className="flex gap-1.5">
                  {minePresets.filter(p => p < gridSize).map(p => (
                    <button key={p} onClick={() => !gameActive && setNumMines(p)} disabled={gameActive}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 ${numMines === p ? 'bg-brand/15 border border-brand/40 text-brand' : 'bg-surface border border-border text-muted hover:text-white'}`}>{p}</button>
                  ))}
                </div>
              </div>

              {/* Current / Next Profit */}
              <div className="space-y-2">
                <div className="bg-surface rounded-xl p-3 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">Current Profit</span>
                    <span className="text-[10px] text-muted font-mono">{currentMult.toFixed(2)}x</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-brand font-mono">${currentProfit > 0 ? '+' : ''}{currentProfit.toFixed(2)}</span>
                    <span className="text-sm text-white/50 font-mono">{(bet * currentMult).toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-surface rounded-xl p-3 border border-brand/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-brand/60 uppercase tracking-wider font-semibold">Next Profit</span>
                    <span className="text-[10px] text-brand/40 font-mono">{nextMult.toFixed(2)}x</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-brand font-mono">${nextProfit > 0 ? '+' : ''}{nextProfit.toFixed(2)}</span>
                    <span className="text-sm text-brand/50 font-mono">{(bet * nextMult).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </BetControls>

            {/* Right: Game Board */}
            <div className="flex-1 min-w-0">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #0a1a18 0%, #0b1414 40%, #0d0f1a 100%)' }}>
                <FloatingGems active />

                {/* ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(0,232,123,0.06) 0%, transparent 70%)' }} />

                {/* Header — NEXT GEM */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-brand/20"
                      style={{ background: 'linear-gradient(135deg, rgba(0,232,123,0.2) 0%, rgba(0,232,123,0.06) 100%)' }}>
                      <Diamond className="w-4 h-4 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Mines</h2>
                      <p className="text-brand/30 text-[10px] mt-0.5">{gridCols}×{gridCols} grid</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-[10px] text-muted uppercase tracking-wider font-bold">Next Gem</div>
                      <div className="text-brand font-bold font-mono text-sm">${gameActive ? nextGemValue.toFixed(2) : '0.00'}</div>
                    </div>
                    <div className="w-px h-8 bg-white/[0.06]" />
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Diamond className="w-3.5 h-3.5 text-brand" />
                        <span className="text-brand font-bold font-mono">{revealed.length}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Bomb className="w-3.5 h-3.5 text-accent-red" />
                        <span className="text-accent-red font-bold font-mono">{numMines}</span>
                      </div>
                      <span className="text-white/25 text-[11px]">{gridSize - numMines - revealed.length} left</span>
                    </div>
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Grid */}
                <div className="relative z-10 px-5 pb-3">
                  <div className="grid gap-1.5 sm:gap-2 mx-auto"
                    style={{
                      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                      maxWidth: gridCols <= 5 ? '420px' : gridCols <= 6 ? '500px' : gridCols <= 7 ? '560px' : '620px',
                    }}>
                    {Array.from({ length: gridSize }, (_, i) => {
                      const isRevealed = revealed.includes(i)
                      const isMine = minePositions.includes(i)
                      const isHit = hitMine === i
                      const showMine = hitMine !== null && isMine
                      const gameOver = hitMine !== null

                      return (
                        <motion.button key={i} onClick={() => revealTile(i)}
                          disabled={!gameActive || isRevealed || gameOver}
                          whileHover={gameActive && !isRevealed && !gameOver ? { scale: 1.08, y: -2 } : {}}
                          whileTap={gameActive && !isRevealed && !gameOver ? { scale: 0.92 } : {}}
                          className={`aspect-square rounded-xl transition-all duration-200 flex items-center justify-center ring-1
                            ${isHit ? 'ring-accent-red/40 animate-pulse'
                              : showMine ? 'ring-accent-red/20'
                              : isRevealed ? 'ring-brand/25'
                              : gameOver ? 'ring-white/[0.03] cursor-not-allowed opacity-40'
                              : 'ring-white/[0.06] hover:ring-brand/30 cursor-pointer'
                            }`}
                          style={{
                            background: isHit ? 'linear-gradient(135deg, rgba(255,71,87,0.5) 0%, rgba(255,71,87,0.25) 100%)'
                              : showMine ? 'linear-gradient(135deg, rgba(255,71,87,0.12) 0%, rgba(255,71,87,0.04) 100%)'
                              : isRevealed ? 'linear-gradient(135deg, rgba(0,232,123,0.2) 0%, rgba(0,232,123,0.06) 100%)'
                              : gameOver ? 'rgba(15,18,25,0.4)' : 'linear-gradient(145deg, rgba(20,25,35,0.8) 0%, rgba(15,18,25,0.6) 100%)',
                            boxShadow: isHit ? '0 0 25px rgba(255,71,87,0.4)' : isRevealed ? '0 4px 15px rgba(0,232,123,0.15)' : undefined,
                          }}>
                          <AnimatePresence mode="wait">
                            {showMine ? (
                              <motion.div key="mine" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                <Bomb className={`text-accent-red drop-shadow-[0_0_8px_rgba(255,71,87,0.5)] ${gridCols >= 7 ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'}`} />
                              </motion.div>
                            ) : isRevealed ? (
                              <motion.div key="gem" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                <Diamond className={`text-brand drop-shadow-[0_0_8px_rgba(0,232,123,0.5)] ${gridCols >= 7 ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'}`} />
                              </motion.div>
                            ) : (
                              <div key="hidden" className={`rounded-lg ${gridCols >= 7 ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'}`} style={{ background: 'rgba(255,255,255,0.04)' }} />
                            )}
                          </AnimatePresence>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                {/* Payout Row — multiplier for each gem count */}
                <div className="relative z-10 px-5 pb-4">
                  <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1">
                    {payoutRow.map(({ gems, mult }) => {
                      const isActive = revealed.length === gems && gameActive
                      const isPassed = revealed.length > gems
                      return (
                        <div key={gems}
                          className={`flex-1 min-w-[60px] flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all
                            ${isActive ? 'bg-brand/10 border-brand/30' : isPassed ? 'bg-brand/5 border-brand/15' : 'bg-surface/50 border-border/40'}`}>
                          <span className={`text-[11px] font-bold font-mono ${
                            isActive ? 'text-brand' : isPassed ? 'text-brand/60' : mult > 0 ? 'text-white/60' : 'text-muted/40'
                          }`}>
                            {mult >= 1000 ? `${(mult / 1000).toFixed(0)}kx` : mult.toFixed(2) + 'x'}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted">{gems}x</span>
                            <Diamond className={`w-3 h-3 ${isPassed ? 'text-brand' : 'text-brand/40'}`} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Result Overlays */}
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

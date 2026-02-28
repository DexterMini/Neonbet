'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'
import { toast } from 'sonner'
import { Dice1, RefreshCw, ArrowLeftRight, TrendingUp, TrendingDown, Percent, Zap } from 'lucide-react'

export default function DicePage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [target, setTarget] = useState(50)
  const [rollOver, setRollOver] = useState(false)
  const [isRolling, setIsRolling] = useState(false)
  const [rollResult, setRollResult] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isWin, setIsWin] = useState(false)
  const [showFairness, setShowFairness] = useState(false)
  const [history, setHistory] = useState<{ value: number; won: boolean }[]>([])

  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)

  const houseEdge = 0.01
  const winChance = rollOver ? 99 - target : target
  const multiplier = ((100 - houseEdge * 100) / winChance)
  const potentialProfit = parseFloat(betAmount) * multiplier - parseFloat(betAmount)

  const doRoll = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet) || !initialized) return { won: false, profit: -bet }
    setIsRolling(true)
    setShowResult(false)
    try {
      let rollValue: number
      if (isAuthenticated) {
        const data = await placeBet('dice', String(bet), 'usdt', { target, direction: rollOver ? 'over' : 'under' })
        rollValue = data.result_data?.roll ?? 0
      } else {
        const { result } = await generateBet('dice')
        rollValue = result as number
      }
      for (let i = 0; i < 10; i++) {
        setRollResult(Math.random() * 100)
        await new Promise(r => setTimeout(r, 30 + i * 8))
      }
      setRollResult(rollValue)
      setShowResult(true)
      const won = rollOver ? rollValue > target : rollValue < target
      setIsWin(won)
      const profit = won ? bet * multiplier - bet : -bet
      setHistory(prev => [{ value: rollValue, won }, ...prev.slice(0, 19)])
      sessionStats.recordBet(won, bet, profit, won ? multiplier : 0)
      if (won) toast.success(`Won $${(bet * multiplier - bet).toFixed(2)}!`)
      else toast.error(`Roll: ${rollValue.toFixed(2)} — Try again!`)
      return { won, profit }
    } catch (err: any) {
      toast.error(err?.message || 'Error placing bet')
      return { won: false, profit: -(amount ?? parseFloat(betAmount)) }
    } finally {
      setIsRolling(false)
    }
  }, [betAmount, target, rollOver, initialized, isAuthenticated, placeBet, generateBet, multiplier, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => doRoll(amount), [doRoll])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)

  useHotkeys(
    () => { if (!isRolling && !autoBetState.running) doRoll() },
    () => autoBetStop(),
    !isRolling
  )

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          {history.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider shrink-0">History</span>
              {history.map((h, i) => (
                <motion.span key={i} initial={i === 0 ? { scale: 0, opacity: 0 } : {}} animate={{ scale: 1, opacity: 1 }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold whitespace-nowrap ${h.won ? 'bg-brand/15 text-brand' : 'bg-accent-red/15 text-accent-red'}`}>
                  {h.value.toFixed(2)}
                </motion.span>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={isRolling}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig}
              onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState}
              onAutoBetStart={autoBetStart}
              onAutoBetStop={autoBetStop}
              actionButton={
                <button onClick={() => doRoll()} disabled={isRolling || isPlacing || !initialized}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                    isRolling || isPlacing ? 'bg-surface text-muted cursor-not-allowed' : 'bg-brand text-background-deep shadow-glow-brand-sm hover:brightness-110'
                  }`}>
                  {isRolling ? <><RefreshCw className="w-4 h-4 animate-spin" />Rolling...</> : <><Dice1 className="w-4 h-4" />Roll Dice</>}
                </button>
              }
            >
              {/* Profit on Win */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Profit on Win</span>
                <div className="bg-surface border border-border rounded-xl px-3 py-2.5 font-mono text-brand text-[13px] font-bold">+${potentialProfit.toFixed(2)}</div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                    <button onClick={() => setRollOver(!rollOver)} className="text-brand hover:text-brand-light transition-colors">{rollOver ? 'Over' : 'Under'}</button>
                    <ArrowLeftRight className="w-2.5 h-2.5 text-muted" />
                  </div>
                  <div className="text-base font-bold text-white font-mono">{target}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1"><TrendingUp className="w-2.5 h-2.5" />Multi</div>
                  <div className="text-base font-bold text-brand font-mono">{multiplier.toFixed(2)}×</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1"><Percent className="w-2.5 h-2.5" />Win</div>
                  <div className="text-base font-bold text-white font-mono">{winChance.toFixed(1)}%</div>
                </div>
              </div>
            </BetControls>

            <div className="flex-1 min-w-0 space-y-4">
              <div className="bg-background-secondary rounded-2xl border border-border/60 overflow-hidden">
                <div className="h-56 sm:h-64 flex items-center justify-center relative">
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-brand/[0.03] rounded-full blur-3xl" />
                    {showResult && isWin && <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.08 }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand rounded-full blur-3xl" />}
                    {showResult && !isWin && <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.08 }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent-red rounded-full blur-3xl" />}
                  </div>
                  <AnimatePresence mode="wait">
                    {rollResult !== null ? (
                      <motion.div key={rollResult} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center z-10">
                        <div className={`text-6xl sm:text-7xl font-black font-mono tabular-nums ${showResult ? (isWin ? 'text-brand' : 'text-accent-red') : 'text-white'}`}
                          style={{ textShadow: showResult ? (isWin ? '0 0 50px rgba(0,232,123,0.5)' : '0 0 50px rgba(255,71,87,0.5)') : 'none' }}>
                          {rollResult.toFixed(2)}
                        </div>
                        {showResult && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                            className={`mt-3 flex items-center justify-center gap-2 text-sm font-bold ${isWin ? 'text-brand' : 'text-accent-red'}`}>
                            {isWin ? <><TrendingUp className="w-4 h-4" />WIN +${potentialProfit.toFixed(2)}</> : <><TrendingDown className="w-4 h-4" />LOSS</>}
                          </motion.div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="text-center z-10">
                        <Dice1 className="w-16 h-16 text-muted/30 mx-auto mb-2" />
                        <div className="text-muted text-sm">Press <kbd className="bg-surface px-1.5 py-0.5 rounded text-[11px] font-mono border border-border">Space</kbd> to roll</div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="px-5 pb-5">
                  <div className="relative mb-2">
                    <div className="h-2.5 bg-surface rounded-full overflow-hidden relative">
                      <div className={`absolute inset-y-0 left-0 transition-all ${rollOver ? 'bg-surface-lighter' : 'bg-accent-red/60'}`} style={{ width: `${target}%` }} />
                      <div className={`absolute inset-y-0 right-0 transition-all ${rollOver ? 'bg-brand/60' : 'bg-surface-lighter'}`} style={{ width: `${100 - target}%` }} />
                      <div className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-full shadow-lg" style={{ left: `${target}%`, transform: 'translate(-50%, -50%)' }} />
                    </div>
                    <input type="range" min={1} max={98} value={target} onChange={e => setTarget(parseInt(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                    {rollResult !== null && showResult && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className={`absolute top-1/2 w-3.5 h-3.5 -translate-y-1/2 rounded-full border-2 border-white shadow-lg ${isWin ? 'bg-brand' : 'bg-accent-red'}`}
                        style={{ left: `${rollResult}%`, transform: 'translate(-50%, -50%)' }} />
                    )}
                    <div className="flex justify-between mt-2 text-[10px] text-muted font-mono"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
                  </div>
                </div>
              </div>

              <LiveBetsTable game="dice" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="dice" serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce} previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

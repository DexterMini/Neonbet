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
import { Target, RefreshCw, TrendingUp, TrendingDown, Shield, Zap, Percent } from 'lucide-react'
import Decimal from 'decimal.js'

export default function LimboPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [limboTarget, setLimboTarget] = useState(2)
  const [isPlaying, setIsPlaying] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [lastWin, setLastWin] = useState<boolean | null>(null)
  const [showFairness, setShowFairness] = useState(false)
  const [history, setHistory] = useState<{ value: number; won: boolean }[]>([])
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)

  const winChance = new Decimal(99).div(limboTarget).toDecimalPlaces(2).toNumber()
  const multiplier = new Decimal(99).div(100).mul(limboTarget).toDecimalPlaces(4).toNumber()
  const potentialProfit = parseFloat(betAmount) * multiplier - parseFloat(betAmount)

  const handlePlay = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet) || !initialized) return { won: false, profit: -bet }
    setIsPlaying(true)
    setShowResult(false)
    try {
      let generatedMultiplier: number
      if (isAuthenticated) {
        const data = await placeBet('limbo', String(bet), 'usdt', { target_multiplier: limboTarget })
        generatedMultiplier = data.result_data?.generated_multiplier ?? 1
      } else {
        const { result: gameResult } = await generateBet('limbo')
        generatedMultiplier = gameResult as number
      }
      for (let i = 0; i < 15; i++) {
        setResult(Math.random() * limboTarget * 2)
        await new Promise(r => setTimeout(r, 30))
      }
      setResult(generatedMultiplier)
      setShowResult(true)
      const isWin = generatedMultiplier >= limboTarget
      setLastWin(isWin)
      const profit = isWin ? bet * multiplier - bet : -bet
      setHistory(prev => [{ value: generatedMultiplier, won: isWin }, ...prev.slice(0, 19)])
      sessionStats.recordBet(isWin, bet, profit, isWin ? generatedMultiplier : 0)
      if (isWin) toast.success(`${generatedMultiplier.toFixed(2)}x! Won $${(bet * multiplier - bet).toFixed(2)}`)
      else toast.error(`${generatedMultiplier.toFixed(2)}x — Try again!`)
      return { won: isWin, profit }
    } catch (err: any) {
      toast.error(err?.message || 'Error placing bet')
      return { won: false, profit: -(amount ?? parseFloat(betAmount)) }
    } finally {
      setIsPlaying(false)
    }
  }, [betAmount, limboTarget, initialized, isAuthenticated, placeBet, generateBet, multiplier, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => handlePlay(amount), [handlePlay])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)

  useHotkeys(
    () => { if (!isPlaying && !autoBetState.running) handlePlay() },
    () => autoBetStop(),
    !isPlaying
  )

  const handleTargetChange = (value: number) => setLimboTarget(Math.max(1.01, Math.min(1000000, value)))
  const quickTargets = [1.5, 2, 3, 5, 10, 100]

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
                  {h.value.toFixed(2)}x
                </motion.span>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={isPlaying}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig}
              onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState}
              onAutoBetStart={autoBetStart}
              onAutoBetStop={autoBetStop}
              actionButton={
                <button onClick={() => handlePlay()} disabled={isPlaying || isPlacing || !initialized}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                    isPlaying || isPlacing ? 'bg-surface text-muted cursor-not-allowed' : 'bg-brand text-background-deep shadow-glow-brand-sm hover:brightness-110'
                  }`}>
                  {isPlaying ? <><RefreshCw className="w-4 h-4 animate-spin" />Playing...</> : <><Zap className="w-4 h-4" />Play</>}
                </button>
              }
            >
              {/* Target Multiplier */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Target Multiplier</span>
                <div className="relative">
                  <input type="number" value={limboTarget} onChange={e => handleTargetChange(parseFloat(e.target.value))} min={1.01} step={0.01}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 pr-8 font-mono tabular-nums text-[13px] text-white focus:outline-none focus:border-brand/40 transition-all" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">x</span>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {quickTargets.map(t => (
                    <button key={t} onClick={() => setLimboTarget(t)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold font-mono transition-all ${Math.abs(limboTarget - t) < 0.01 ? 'bg-brand/15 border border-brand/40 text-brand' : 'bg-surface border border-border text-muted hover:text-white'}`}>{t}x</button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5 flex items-center gap-1"><Percent className="w-2.5 h-2.5" />Win %</div>
                  <div className="text-base font-bold text-white font-mono">{winChance.toFixed(2)}%</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />Multi</div>
                  <div className="text-base font-bold text-brand font-mono">{multiplier.toFixed(4)}x</div>
                </div>
              </div>

              {/* Profit */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Profit on Win</span>
                <div className="bg-surface border border-border rounded-xl px-3 py-2.5 font-mono text-brand text-[13px] font-bold">+${potentialProfit.toFixed(2)}</div>
              </div>
            </BetControls>

            <div className="flex-1 min-w-0 space-y-4">
              <div className="bg-background-secondary rounded-2xl border border-border/60 overflow-hidden">
                <div className="relative h-64 sm:h-72 flex items-center justify-center">
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-brand/[0.03] rounded-full blur-3xl" />
                    {showResult && lastWin && <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.08 }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand rounded-full blur-3xl" />}
                    {showResult && lastWin === false && <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.08 }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent-red rounded-full blur-3xl" />}
                  </div>

                  <div className="absolute top-4 right-4 bg-surface/80 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-border">
                    <div className="text-[10px] text-muted">Target</div>
                    <div className="text-sm font-mono text-brand font-bold">{limboTarget.toFixed(2)}x</div>
                  </div>

                  <AnimatePresence mode="wait">
                    {result !== null ? (
                      <motion.div key={result} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center z-10">
                        <div className={`text-6xl sm:text-7xl font-black font-mono tabular-nums ${showResult ? (lastWin ? 'text-brand' : 'text-accent-red') : 'text-white'}`}
                          style={{ textShadow: showResult ? (lastWin ? '0 0 50px rgba(0,232,123,0.5)' : '0 0 50px rgba(255,71,87,0.5)') : 'none' }}>
                          {result.toFixed(2)}x
                        </div>
                        {showResult && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                            className={`mt-3 flex items-center justify-center gap-2 text-sm font-bold ${lastWin ? 'text-brand' : 'text-accent-red'}`}>
                            {lastWin ? <><TrendingUp className="w-4 h-4" />Target reached!</> : <><TrendingDown className="w-4 h-4" />Below target</>}
                          </motion.div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="text-center z-10">
                        <Target className="w-16 h-16 text-muted/30 mx-auto mb-2" />
                        <div className="text-muted text-sm">Press <kbd className="bg-surface px-1.5 py-0.5 rounded text-[11px] font-mono border border-border">Space</kbd> to play</div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="p-5 border-t border-border/60">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted text-[11px] uppercase tracking-wider font-semibold">Target Slider</span>
                    <span className="text-brand font-mono font-bold text-sm">{limboTarget.toFixed(2)}x</span>
                  </div>
                  <div className="relative">
                    <input type="range" min={1.01} max={100} step={0.01} value={Math.min(limboTarget, 100)}
                      onChange={e => handleTargetChange(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-surface rounded-full appearance-none cursor-pointer accent-brand"
                      style={{ background: `linear-gradient(to right, #00E87B 0%, #00E87B ${((Math.min(limboTarget, 100) - 1.01) / 98.99) * 100}%, #1A1D28 ${((Math.min(limboTarget, 100) - 1.01) / 98.99) * 100}%, #1A1D28 100%)` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted mt-1.5 font-mono"><span>1.01x</span><span>50x</span><span>100x</span></div>
                </div>
              </div>

              <LiveBetsTable game="limbo" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="limbo" serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce} previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

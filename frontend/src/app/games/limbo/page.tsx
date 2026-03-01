'use client'

import { useState, useCallback } from 'react'
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
import { Target, RefreshCw, TrendingUp, TrendingDown, Zap, Percent } from 'lucide-react'
import Decimal from 'decimal.js'

/* ── Floating particles ───────────────────────────── */
const LIMBO_PARTICLE_COLORS = ['#f43f5e', '#fb7185', '#fda4af', '#e11d48', '#be123c', '#fecdd3']
function FloatingStars({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {LIMBO_PARTICLE_COLORS.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${8 + i * 15}%` }}
          animate={{ opacity: [0, 0.35, 0], y: '-10%', x: `${8 + i * 15 + (Math.random() - 0.5) * 12}%` }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

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
    setIsPlaying(true); setShowResult(false)
    try {
      let generatedMultiplier: number
      if (isAuthenticated) {
        const data = await placeBet('limbo', String(bet), 'usdt', { target_multiplier: limboTarget })
        generatedMultiplier = data.result_data?.generated_multiplier ?? 1
      } else {
        const { result: gameResult } = await generateBet('limbo')
        generatedMultiplier = gameResult as number
      }
      for (let i = 0; i < 15; i++) { setResult(Math.random() * limboTarget * 2); await new Promise(r => setTimeout(r, 30)) }
      setResult(generatedMultiplier); setShowResult(true)
      const isWin = generatedMultiplier >= limboTarget
      setLastWin(isWin)
      const profit = isWin ? bet * multiplier - bet : -bet
      setHistory(prev => [{ value: generatedMultiplier, won: isWin }, ...prev.slice(0, 19)])
      sessionStats.recordBet(isWin, bet, profit, isWin ? generatedMultiplier : 0)
      if (isWin) toast.success(`${generatedMultiplier.toFixed(2)}x! Won $${(bet * multiplier - bet).toFixed(2)}`)
      else toast.error(`${generatedMultiplier.toFixed(2)}x — Try again!`)
      return { won: isWin, profit }
    } catch (err: any) { toast.error(err?.message || 'Error placing bet'); return { won: false, profit: -(amount ?? parseFloat(betAmount)) } }
    finally { setIsPlaying(false) }
  }, [betAmount, limboTarget, initialized, isAuthenticated, placeBet, generateBet, multiplier, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => handlePlay(amount), [handlePlay])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (!isPlaying && !autoBetState.running) handlePlay() }, () => autoBetStop(), !isPlaying)

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
            <BetControls betAmount={betAmount} onBetAmountChange={setBetAmount} disabled={isPlaying}
              serverSeedHash={serverSeedHash} nonce={nonce} onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig} onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState} onAutoBetStart={autoBetStart} onAutoBetStop={autoBetStop}
              actionButton={
                <button onClick={() => handlePlay()} disabled={isPlaying || isPlacing || !initialized}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                    isPlaying || isPlacing ? 'bg-surface text-muted cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-amber-400 text-background-deep shadow-lg shadow-orange-500/30 hover:brightness-110'
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
              {/* ── Premium Scene Container ────────── */}
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #1a1008 0%, #14100a 40%, #0d0f1a 100%)' }}>
                <FloatingStars active />

                {/* ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-orange-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(249,115,22,0.08) 100%)' }}>
                      <Target className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Limbo</h2>
                      <p className="text-orange-300/30 text-[10px] mt-0.5">Target {limboTarget.toFixed(2)}x</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-400 ring-1 ring-orange-400/20 font-mono">
                      {limboTarget.toFixed(2)}x
                    </div>
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Result display */}
                <div className="relative z-10 h-64 sm:h-72 flex items-center justify-center">
                  {showResult && lastWin && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.12 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-brand rounded-full blur-[100px]" />
                  )}
                  {showResult && lastWin === false && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.12 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-accent-red rounded-full blur-[100px]" />
                  )}

                  <AnimatePresence mode="wait">
                    {result !== null ? (
                      <motion.div key={result} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="text-center z-10">
                        <motion.div
                          animate={showResult ? { scale: [1, 1.08, 1] } : {}}
                          transition={{ duration: 0.4 }}
                          className={`text-7xl sm:text-8xl font-black font-mono tabular-nums ${showResult ? (lastWin ? 'text-brand' : 'text-accent-red') : 'text-white'}`}
                          style={{ textShadow: showResult ? (lastWin ? '0 0 60px rgba(0,232,123,0.6), 0 0 120px rgba(0,232,123,0.2)' : '0 0 60px rgba(255,71,87,0.6), 0 0 120px rgba(255,71,87,0.2)') : '0 0 30px rgba(255,255,255,0.1)' }}>
                          {result.toFixed(2)}x
                        </motion.div>
                        {showResult && (
                          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: 'spring' }}
                            className="mt-4">
                            <span className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-full ${
                              lastWin ? 'bg-brand/15 text-brand ring-1 ring-brand/20' : 'bg-accent-red/15 text-accent-red ring-1 ring-accent-red/20'
                            }`}>
                              {lastWin ? <><TrendingUp className="w-4 h-4" />Target reached!</> : <><TrendingDown className="w-4 h-4" />Below target</>}
                            </span>
                          </motion.div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="text-center z-10">
                        <div className="w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center ring-1 ring-white/[0.06]"
                          style={{ background: 'linear-gradient(145deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.04) 100%)' }}>
                          <Target className="w-10 h-10 text-orange-400/30" />
                        </div>
                        <div className="text-white/25 text-sm">Press <kbd className="bg-white/[0.06] px-2 py-0.5 rounded-md text-[11px] font-mono border border-white/[0.08]">Space</kbd> to play</div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Slider */}
                <div className="relative z-10 p-5 border-t border-white/[0.04]">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/25 text-[11px] uppercase tracking-wider font-semibold">Target Slider</span>
                    <span className="text-orange-400 font-mono font-bold text-sm">{limboTarget.toFixed(2)}x</span>
                  </div>
                  <div className="relative">
                    <input type="range" min={1.01} max={100} step={0.01} value={Math.min(limboTarget, 100)}
                      onChange={e => handleTargetChange(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #f97316 0%, #f97316 ${((Math.min(limboTarget, 100) - 1.01) / 98.99) * 100}%, rgba(255,255,255,0.06) ${((Math.min(limboTarget, 100) - 1.01) / 98.99) * 100}%, rgba(255,255,255,0.06) 100%)` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/15 mt-1.5 font-mono"><span>1.01x</span><span>50x</span><span>100x</span></div>
                </div>
              </div>

              <LiveBetsTable game="limbo" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="limbo"
            serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
            previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

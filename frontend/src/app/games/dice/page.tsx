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
import { Dice1, ArrowLeftRight, TrendingUp, TrendingDown, RefreshCw, Percent } from 'lucide-react'

/* ── Floating dice particles ──────────────────────── */
const DICE_PARTICLE_COLORS = ['#a78bfa', '#8b5cf6', '#c4b5fd', '#7c3aed', '#6d28d9', '#ddd6fe']
function FloatingDice({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {DICE_PARTICLE_COLORS.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: '110%', x: `${10 + i * 14}%`, rotate: 0 }}
          animate={{
            opacity: [0, 0.4, 0],
            y: '-10%',
            x: `${10 + i * 14 + (Math.random() - 0.5) * 12}%`,
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-sm"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

export default function DicePage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [target, setTarget] = useState(50)
  const [rollOver, setRollOver] = useState(true)
  const [isRolling, setIsRolling] = useState(false)
  const [rollResult, setRollResult] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showFairness, setShowFairness] = useState(false)
  const [history, setHistory] = useState<{ value: number; won: boolean }[]>([])
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)

  const winChance = rollOver ? 100 - target : target
  const multiplier = parseFloat((99 / winChance).toFixed(4))
  const potentialProfit = parseFloat(betAmount) * multiplier - parseFloat(betAmount)
  const isWin = rollResult !== null && showResult && (rollOver ? rollResult > target : rollResult < target)

  const doRoll = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet) || !initialized) return { won: false, profit: -bet }
    setIsRolling(true)
    setShowResult(false)
    try {
      let generatedValue: number
      if (isAuthenticated) {
        const data = await placeBet('dice', String(bet), 'usdt', { target, roll_over: rollOver })
        generatedValue = data.result_data?.roll_value ?? 50
      } else {
        const { result } = await generateBet('dice')
        generatedValue = result as number
      }
      for (let i = 0; i < 12; i++) {
        setRollResult(parseFloat((Math.random() * 100).toFixed(2)))
        await new Promise(r => setTimeout(r, 35))
      }
      setRollResult(generatedValue)
      setShowResult(true)
      const won = rollOver ? generatedValue > target : generatedValue < target
      const profit = won ? bet * multiplier - bet : -bet
      setHistory(prev => [{ value: generatedValue, won }, ...prev.slice(0, 19)])
      sessionStats.recordBet(won, bet, profit, won ? multiplier : 0)
      if (won) toast.success(`Rolled ${generatedValue.toFixed(2)}! Won $${(bet * multiplier - bet).toFixed(2)}`)
      else toast.error(`Rolled ${generatedValue.toFixed(2)} — Better luck next time!`)
      return { won, profit }
    } catch (err: any) {
      toast.error(err?.message || 'Error placing bet')
      return { won: false, profit: -(amount ?? parseFloat(betAmount)) }
    } finally { setIsRolling(false) }
  }, [betAmount, target, rollOver, initialized, isAuthenticated, placeBet, generateBet, multiplier, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => doRoll(amount), [doRoll])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (!isRolling && !autoBetState.running) doRoll() }, () => autoBetStop(), !isRolling)

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
                    isRolling || isPlacing ? 'bg-surface text-muted cursor-not-allowed' : 'bg-gradient-to-r from-brand to-emerald-400 text-background-deep shadow-lg shadow-brand/30 hover:brightness-110'
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
              {/* ── Premium Scene Container ────────── */}
              <div
                className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #0e1628 0%, #0b1020 40%, #0d0f1a 100%)' }}
              >
                <FloatingDice active />

                {/* ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(56,100,220,0.08) 0%, transparent 70%)' }} />

                {/* Header bar */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-blue-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(56,100,220,0.25) 0%, rgba(56,100,220,0.08) 100%)' }}>
                      <Dice1 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Dice</h2>
                      <p className="text-blue-300/40 text-[10px] mt-0.5">Roll {rollOver ? 'Over' : 'Under'} {target}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted font-mono">
                    <span className={`px-2 py-0.5 rounded-md font-bold ${rollOver ? 'bg-brand/10 text-brand' : 'bg-blue-400/10 text-blue-400'}`}>
                      {rollOver ? '▲ Over' : '▼ Under'}
                    </span>
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Result display */}
                <div className="relative z-10 h-56 sm:h-64 flex items-center justify-center">
                  {showResult && isWin && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.12 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-brand rounded-full blur-[100px]" />
                  )}
                  {showResult && !isWin && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.12 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-accent-red rounded-full blur-[100px]" />
                  )}

                  <AnimatePresence mode="wait">
                    {rollResult !== null ? (
                      <motion.div key={rollResult} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="text-center z-10">
                        <motion.div
                          animate={showResult ? { scale: [1, 1.06, 1] } : {}}
                          transition={{ duration: 0.4 }}
                          className={`text-7xl sm:text-8xl font-black font-mono tabular-nums ${showResult ? (isWin ? 'text-brand' : 'text-accent-red') : 'text-white'}`}
                          style={{ textShadow: showResult ? (isWin ? '0 0 60px rgba(0,232,123,0.6), 0 0 120px rgba(0,232,123,0.2)' : '0 0 60px rgba(255,71,87,0.6), 0 0 120px rgba(255,71,87,0.2)') : '0 0 40px rgba(255,255,255,0.15)' }}>
                          {rollResult.toFixed(2)}
                        </motion.div>
                        {showResult && (
                          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: 'spring' }}
                            className="mt-4">
                            <span className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-full ${
                              isWin ? 'bg-brand/15 text-brand ring-1 ring-brand/20' : 'bg-accent-red/15 text-accent-red ring-1 ring-accent-red/20'
                            }`}>
                              {isWin ? <><TrendingUp className="w-4 h-4" />WIN +${potentialProfit.toFixed(2)}</> : <><TrendingDown className="w-4 h-4" />LOSS</>}
                            </span>
                          </motion.div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="text-center z-10">
                        <div className="w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center ring-1 ring-white/[0.06]"
                          style={{ background: 'linear-gradient(145deg, rgba(56,100,220,0.12) 0%, rgba(56,100,220,0.04) 100%)' }}>
                          <Dice1 className="w-10 h-10 text-blue-400/30" />
                        </div>
                        <div className="text-muted text-sm">Press <kbd className="bg-white/[0.06] px-2 py-0.5 rounded-md text-[11px] font-mono border border-white/[0.08]">Space</kbd> to roll</div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Slider section */}
                <div className="relative z-10 px-5 pb-5">
                  <div className="relative mb-2">
                    <div className="h-3 rounded-full overflow-hidden relative ring-1 ring-white/[0.06]"
                      style={{ background: 'linear-gradient(90deg, rgba(15,15,25,0.8) 0%, rgba(15,15,25,0.8) 100%)' }}>
                      <div className={`absolute inset-y-0 left-0 transition-all ${rollOver ? '' : 'bg-gradient-to-r from-accent-red/50 to-accent-red/30'}`} style={{ width: `${target}%`, background: rollOver ? 'rgba(30,35,50,0.6)' : undefined }} />
                      <div className={`absolute inset-y-0 right-0 transition-all ${rollOver ? 'bg-gradient-to-r from-brand/30 to-brand/50' : ''}`} style={{ width: `${100 - target}%`, background: !rollOver ? 'rgba(30,35,50,0.6)' : undefined }} />
                      <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-5 bg-white rounded-full shadow-lg shadow-white/30" style={{ left: `${target}%`, transform: 'translate(-50%, -50%)' }} />
                    </div>
                    <input type="range" min={1} max={98} value={target} onChange={e => setTarget(parseInt(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                    {rollResult !== null && showResult && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
                        className={`absolute top-1/2 w-4 h-4 -translate-y-1/2 rounded-full border-2 border-white shadow-lg ${isWin ? 'bg-brand shadow-brand/40' : 'bg-accent-red shadow-accent-red/40'}`}
                        style={{ left: `${rollResult}%`, transform: 'translate(-50%, -50%)' }} />
                    )}
                    <div className="flex justify-between mt-2.5 text-[10px] text-white/20 font-mono"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
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

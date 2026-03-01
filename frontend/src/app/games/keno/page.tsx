'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { Grid3X3, Shield, Sparkles, Zap, Trophy, X, RotateCcw, Play } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'

type RiskLevel = 'low' | 'classic' | 'medium' | 'high'

/* ── Floating particles ───────────────────────────── */
function FloatingNumbers() {
  const items = ['🎱', '✨', '🔢', '💫', '🎯', '⭐']
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((e, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${6 + i * 15}%` }}
          animate={{ opacity: [0, 0.3, 0], y: '-10%', x: `${6 + i * 15 + (Math.random() - 0.5) * 10}%` }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          className="absolute text-sm select-none"
        >{e}</motion.div>
      ))}
    </div>
  )
}

const payoutTables: Record<RiskLevel, Record<number, number[]>> = {
  low: {
    1: [0, 2.85],
    2: [0, 1.4, 5.1],
    3: [0, 1.1, 1.4, 10],
    4: [0, 0.5, 1.5, 3, 15],
    5: [0, 0.5, 1, 2, 6, 20],
    6: [0, 0, 1, 1.5, 3, 10, 25],
    7: [0, 0, 0.5, 1.5, 3, 5, 15, 40],
    8: [0, 0, 0.5, 1, 2, 4, 8, 25, 50],
    9: [0, 0, 0, 1, 1.5, 3, 5, 15, 35, 75],
    10: [0, 0, 0, 0.5, 1.5, 2, 4, 8, 25, 50, 100],
  },
  classic: {
    1: [0, 3.68],
    2: [0, 1.6, 8],
    3: [0, 1.2, 1.8, 25],
    4: [0, 0, 2, 5, 50],
    5: [0, 0, 1.5, 3, 12, 90],
    6: [0, 0, 1, 2, 5, 20, 150],
    7: [0, 0, 0.5, 1.5, 4, 10, 50, 250],
    8: [0, 0, 0, 1, 3, 6, 20, 80, 400],
    9: [0, 0, 0, 0.5, 2, 4, 10, 40, 120, 600],
    10: [0, 0, 0, 0, 1.5, 3, 8, 20, 60, 200, 1000],
  },
  medium: {
    1: [0, 4.5],
    2: [0, 1.8, 12],
    3: [0, 0.8, 3, 45],
    4: [0, 0, 2.5, 10, 100],
    5: [0, 0, 1.5, 5, 25, 200],
    6: [0, 0, 0, 3, 10, 50, 400],
    7: [0, 0, 0, 1.5, 6, 20, 120, 700],
    8: [0, 0, 0, 1, 4, 12, 50, 200, 1200],
    9: [0, 0, 0, 0, 3, 8, 25, 100, 400, 2000],
    10: [0, 0, 0, 0, 2, 5, 15, 50, 200, 800, 3500],
  },
  high: {
    1: [0, 5.85],
    2: [0, 2, 18],
    3: [0, 0, 5, 80],
    4: [0, 0, 3, 20, 200],
    5: [0, 0, 1.5, 10, 80, 500],
    6: [0, 0, 0, 5, 30, 200, 1000],
    7: [0, 0, 0, 2, 15, 80, 400, 2000],
    8: [0, 0, 0, 1, 10, 40, 200, 800, 4000],
    9: [0, 0, 0, 0, 5, 20, 100, 500, 2000, 8000],
    10: [0, 0, 0, 0, 3, 10, 50, 250, 1000, 5000, 15000],
  },
}

const TOTAL_NUMBERS = 40
const DRAW_COUNT = 10
const MAX_PICKS = 10

export default function KenoPage() {
  const {
    initialized, serverSeedHash, clientSeed, nonce, previousServerSeed,
    generateBet, rotateSeed, setClientSeed,
  } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [gameEnded, setGameEnded] = useState(false)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('classic')
  const [showFairness, setShowFairness] = useState(false)
  const [lastBetInfo, setLastBetInfo] = useState<{ nonce: number; clientSeed: string; serverSeedHash: string } | null>(null)

  const matches = useMemo(() => selectedNumbers.filter(n => drawnNumbers.includes(n)).length, [selectedNumbers, drawnNumbers])

  const currentPayoutTable = useMemo(() => {
    const picks = selectedNumbers.length || 1
    return payoutTables[riskLevel][Math.min(picks, MAX_PICKS)] || []
  }, [riskLevel, selectedNumbers.length])

  const potentialPayouts = useMemo(() => {
    const picks = selectedNumbers.length
    if (picks === 0) return []
    const table = payoutTables[riskLevel][picks] || []
    return table.map((mult, hits) => ({ hits, multiplier: mult, payout: mult * parseFloat(betAmount || '0') }))
  }, [riskLevel, selectedNumbers.length, betAmount])

  const handleNumberClick = (num: number) => {
    if (isPlaying) return
    if (selectedNumbers.includes(num)) { setSelectedNumbers(prev => prev.filter(n => n !== num)) }
    else if (selectedNumbers.length < MAX_PICKS) { setSelectedNumbers(prev => [...prev, num]) }
    else { toast.error(`Maximum ${MAX_PICKS} numbers allowed`) }
    if (gameEnded) { setDrawnNumbers([]); setGameEnded(false) }
  }

  const handleQuickPick = () => {
    if (isPlaying) return
    const count = selectedNumbers.length || 5
    const available = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1)
    const picks: number[] = []
    while (picks.length < count) { const idx = Math.floor(Math.random() * available.length); picks.push(available.splice(idx, 1)[0]) }
    setSelectedNumbers(picks.sort((a, b) => a - b))
    setDrawnNumbers([]); setGameEnded(false)
  }

  const handleClearSelection = () => {
    if (isPlaying) return
    setSelectedNumbers([]); setDrawnNumbers([]); setGameEnded(false)
  }

  const handlePlay = async () => {
    if (isPlaying || isPlacing || !initialized) return
    if (selectedNumbers.length === 0) { toast.error('Select at least 1 number'); return }
    const bet = parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet)) { toast.error('Invalid bet amount'); return }

    setIsPlaying(true); setDrawnNumbers([]); setGameEnded(false)

    try {
      let drawnResult: number[]
      let hits: number
      let multiplier: number

      if (isAuthenticated) {
        const data = await placeBet('keno', betAmount, 'usdt', { picks: selectedNumbers, risk: riskLevel })
        drawnResult = data.result_data?.drawn ?? []
        hits = data.result_data?.hits ?? 0
        multiplier = data.result_data?.multiplier ?? 0
      } else {
        const { result, nonce: betNonce, clientSeed: betClientSeed, serverSeedHash: betHash } =
          await generateBet('keno', { totalNumbers: TOTAL_NUMBERS, drawCount: DRAW_COUNT, picks: selectedNumbers.length })
        setLastBetInfo({ nonce: betNonce, clientSeed: betClientSeed, serverSeedHash: betHash })
        drawnResult = result as number[]
        hits = selectedNumbers.filter(n => drawnResult.includes(n)).length
        const payoutTable = payoutTables[riskLevel][selectedNumbers.length] || []
        multiplier = payoutTable[hits] || 0
      }

      for (let i = 0; i < drawnResult.length; i++) {
        await new Promise(r => setTimeout(r, 150))
        setDrawnNumbers(prev => [...prev, drawnResult[i]])
      }

      setGameEnded(true)
      const winnings = bet * multiplier
      if (multiplier > 0) {
        sessionStats.recordBet(true, bet, winnings - bet, multiplier)
        toast.success(`${hits} hits! Won $${winnings.toFixed(2)} (${multiplier}x)`)
      } else {
        sessionStats.recordBet(false, bet, -bet, 0)
        toast.error(`${hits} hits - Better luck next time!`)
      }
    } catch (error: any) {
      toast.error(error?.message || 'Error generating result')
    } finally { setIsPlaying(false) }
  }

  const getNumberState = (num: number) => {
    const isSelected = selectedNumbers.includes(num)
    const isDrawn = drawnNumbers.includes(num)
    const isHit = isSelected && isDrawn
    const isMiss = isSelected && gameEnded && !isDrawn
    return { isSelected, isDrawn, isHit, isMiss }
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
              disabled={isPlaying}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              showAutoTab={false}
              actionButton={
                <button onClick={handlePlay} disabled={isPlaying || selectedNumbers.length === 0 || !initialized}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2
                    ${isPlaying || selectedNumbers.length === 0
                      ? 'bg-surface cursor-not-allowed text-muted'
                      : 'bg-gradient-to-r from-cyan-500 to-teal-400 text-background-deep shadow-lg shadow-cyan-500/30 hover:brightness-110'}`}>
                  {isPlaying ? <><RotateCcw className="w-4 h-4 animate-spin" />Drawing...</> : <><Play className="w-4 h-4" />Play Keno</>}
                </button>
              }
            >
              {/* Risk Level */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Risk Level</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['low', 'classic', 'medium', 'high'] as RiskLevel[]).map(risk => (
                    <button key={risk} onClick={() => setRiskLevel(risk)} disabled={isPlaying}
                      className={`py-2 rounded-xl text-[12px] font-bold capitalize transition-all border disabled:opacity-50
                        ${riskLevel === risk
                          ? risk === 'low' ? 'bg-brand/15 border-brand/40 text-brand'
                            : risk === 'classic' ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                            : risk === 'medium' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                            : 'bg-red-500/15 border-red-500/40 text-red-400'
                          : 'bg-surface border-border text-muted hover:text-white'}`}>
                      {risk}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1.5">
                <button onClick={handleQuickPick} disabled={isPlaying}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-surface border border-border rounded-xl text-[11px] font-semibold text-muted hover:text-white hover:border-cyan-400/40 transition-all disabled:opacity-50">
                  <Sparkles className="w-3 h-3" />Quick Pick
                </button>
                <button onClick={handleClearSelection} disabled={isPlaying || selectedNumbers.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-surface border border-border rounded-xl text-[11px] font-semibold text-muted hover:text-white hover:border-red-400/40 transition-all disabled:opacity-50">
                  <X className="w-3 h-3" />Clear
                </button>
              </div>

              {/* Picks info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Picks</div>
                  <div className="text-base font-bold text-cyan-400 font-mono">{selectedNumbers.length}/{MAX_PICKS}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Hits</div>
                  <div className="text-base font-bold text-amber-400 font-mono">{gameEnded ? matches : '-'}</div>
                </div>
              </div>

              {/* Payout Table */}
              {selectedNumbers.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Payouts ({selectedNumbers.length} picks)</span>
                  <div className="bg-surface rounded-xl border border-border p-2 max-h-32 overflow-y-auto scrollbar-thin">
                    <div className="space-y-0.5">
                      {potentialPayouts.map(({ hits, multiplier, payout }) => (
                        <div key={hits} className={`flex items-center justify-between px-2 py-1 rounded-lg text-[11px]
                          ${gameEnded && matches === hits ? 'bg-cyan-400/15 text-cyan-400' : ''}`}>
                          <span className="text-muted">{hits} hit{hits !== 1 ? 's' : ''}</span>
                          <span className={`font-mono font-bold ${multiplier > 0 ? 'text-cyan-400' : 'text-muted/50'}`}>{multiplier}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </BetControls>

            {/* Right: Game Area — Premium Scene */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #081418 0%, #0a1014 40%, #0c0e18 100%)' }}>
                <FloatingNumbers />

                {/* Ambient glow */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-cyan-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.25) 0%, rgba(34,211,238,0.08) 100%)' }}>
                      <Grid3X3 className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Keno</h2>
                      <p className="text-cyan-300/30 text-[10px] mt-0.5">Pick up to 10 numbers</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted text-[11px]">Selected: <span className="text-cyan-400 font-mono font-bold">{selectedNumbers.length}/{MAX_PICKS}</span></span>
                    <button onClick={() => setShowFairness(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/[0.04] text-muted hover:text-white ring-1 ring-white/[0.06] transition-all">
                      <Shield className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Number Grid — 8×5 */}
                <div className="relative z-10 px-5 pb-3">
                  <div className="grid grid-cols-8 gap-2">
                    {Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1).map(num => {
                      const { isSelected, isDrawn, isHit, isMiss } = getNumberState(num)
                      return (
                        <motion.button key={num} onClick={() => handleNumberClick(num)} disabled={isPlaying}
                          whileHover={!isPlaying ? { scale: 1.08 } : {}}
                          whileTap={!isPlaying ? { scale: 0.92 } : {}}
                          className="relative aspect-square rounded-xl font-bold font-mono tabular-nums text-lg transition-all duration-200 ring-1 disabled:cursor-default"
                          style={{
                            background: isHit
                              ? 'linear-gradient(145deg, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0.1) 100%)'
                              : isDrawn && !isSelected
                              ? 'linear-gradient(145deg, rgba(34,211,238,0.15) 0%, rgba(34,211,238,0.05) 100%)'
                              : isSelected
                              ? 'linear-gradient(145deg, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.08) 100%)'
                              : 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                            boxShadow: isHit
                              ? '0 0 20px rgba(34,211,238,0.3)'
                              : isSelected
                              ? '0 0 15px rgba(251,191,36,0.2)'
                              : 'none',
                          }}
                        >
                          <span className={
                            isHit ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                            : isDrawn && !isSelected ? 'text-cyan-400/70'
                            : isSelected ? 'text-amber-300'
                            : 'text-white/40 hover:text-white/70'
                          }>{num}</span>
                          {isHit && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 rounded-xl ring-2 ring-cyan-400/50" />}
                          {isSelected && !isHit && <div className="absolute inset-0 rounded-xl ring-2 ring-amber-400/50" />}
                          {isDrawn && !isSelected && <div className="absolute inset-0 rounded-xl ring-1 ring-cyan-400/30" />}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="relative z-10 flex items-center justify-center gap-6 px-5 py-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-md ring-2 ring-amber-400/50" style={{ background: 'linear-gradient(145deg, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.08) 100%)' }} />
                    <span className="text-white/30 text-[11px]">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-md ring-1 ring-cyan-400/30" style={{ background: 'linear-gradient(145deg, rgba(34,211,238,0.15) 0%, rgba(34,211,238,0.05) 100%)' }} />
                    <span className="text-white/30 text-[11px]">Drawn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-md ring-2 ring-cyan-400/50" style={{ background: 'linear-gradient(145deg, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0.1) 100%)' }} />
                    <span className="text-white/30 text-[11px]">Hit</span>
                  </div>
                </div>

                {/* Result Display */}
                <AnimatePresence>
                  {gameEnded && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="relative z-10 mx-5 mb-5">
                      <div className={`rounded-2xl p-5 text-center ring-1 backdrop-blur-sm ${
                        matches > 0 && payoutTables[riskLevel][selectedNumbers.length]?.[matches] > 0
                          ? 'bg-cyan-400/[0.06] ring-cyan-400/20' : 'bg-accent-red/[0.06] ring-accent-red/20'
                      }`}>
                        {matches > 0 && payoutTables[riskLevel][selectedNumbers.length]?.[matches] > 0 && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[200px] rounded-full pointer-events-none"
                            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)' }} />
                        )}
                        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                          className={`text-3xl sm:text-4xl font-black font-mono relative z-10 ${
                            matches > 0 && payoutTables[riskLevel][selectedNumbers.length]?.[matches] > 0 ? 'text-cyan-400' : 'text-accent-red'
                          }`}
                          style={{ textShadow: matches > 0 && payoutTables[riskLevel][selectedNumbers.length]?.[matches] > 0
                            ? '0 0 40px rgba(34,211,238,0.5)' : '0 0 30px rgba(255,71,87,0.4)' }}>
                          {matches} / {selectedNumbers.length} hits — {(payoutTables[riskLevel][selectedNumbers.length]?.[matches] || 0)}x
                        </motion.div>
                        <div className="text-sm text-muted mt-2 relative z-10">
                          {payoutTables[riskLevel][selectedNumbers.length]?.[matches] > 0
                            ? <span className="text-cyan-400 font-bold">Won ${(parseFloat(betAmount) * (payoutTables[riskLevel][selectedNumbers.length]?.[matches] || 0)).toFixed(2)}</span>
                            : `Lost $${parseFloat(betAmount).toFixed(2)}`}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <LiveBetsTable game="keno" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="keno"
            serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
            previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

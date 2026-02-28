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

// Payout tables based on risk and number of picks
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
    initialized, 
    serverSeedHash, 
    clientSeed, 
    nonce, 
    previousServerSeed,
    generateBet,
    rotateSeed,
    setClientSeed 
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
  const [lastBetInfo, setLastBetInfo] = useState<{
    nonce: number
    clientSeed: string
    serverSeedHash: string
  } | null>(null)

  // Calculate matches
  const matches = useMemo(() => {
    return selectedNumbers.filter(n => drawnNumbers.includes(n)).length
  }, [selectedNumbers, drawnNumbers])

  // Get current payout table
  const currentPayoutTable = useMemo(() => {
    const picks = selectedNumbers.length || 1
    return payoutTables[riskLevel][Math.min(picks, MAX_PICKS)] || []
  }, [riskLevel, selectedNumbers.length])

  // Calculate potential payout
  const potentialPayouts = useMemo(() => {
    const picks = selectedNumbers.length
    if (picks === 0) return []
    const table = payoutTables[riskLevel][picks] || []
    return table.map((mult, hits) => ({
      hits,
      multiplier: mult,
      payout: mult * parseFloat(betAmount || '0')
    }))
  }, [riskLevel, selectedNumbers.length, betAmount])

  const handleNumberClick = (num: number) => {
    if (isPlaying) return
    
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num))
    } else if (selectedNumbers.length < MAX_PICKS) {
      setSelectedNumbers(prev => [...prev, num])
    } else {
      toast.error(`Maximum ${MAX_PICKS} numbers allowed`)
    }
    
    // Reset game state when changing selection
    if (gameEnded) {
      setDrawnNumbers([])
      setGameEnded(false)
    }
  }

  const handleQuickPick = () => {
    if (isPlaying) return
    
    const count = selectedNumbers.length || 5
    const available = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1)
    const picks: number[] = []
    
    while (picks.length < count) {
      const idx = Math.floor(Math.random() * available.length)
      picks.push(available.splice(idx, 1)[0])
    }
    
    setSelectedNumbers(picks.sort((a, b) => a - b))
    setDrawnNumbers([])
    setGameEnded(false)
  }

  const handleClearSelection = () => {
    if (isPlaying) return
    setSelectedNumbers([])
    setDrawnNumbers([])
    setGameEnded(false)
  }

  const handlePlay = async () => {
    if (isPlaying || isPlacing || !initialized) return
    
    if (selectedNumbers.length === 0) {
      toast.error('Select at least 1 number')
      return
    }

    const bet = parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet)) {
      toast.error('Invalid bet amount')
      return
    }

    setIsPlaying(true)
    setDrawnNumbers([])
    setGameEnded(false)

    try {
      let drawnResult: number[]
      let hits: number
      let multiplier: number

      if (isAuthenticated) {
        // Real bet via backend
        const data = await placeBet('keno', betAmount, 'usdt', {
          picks: selectedNumbers,
          risk: riskLevel,
        })
        drawnResult = data.result_data?.drawn ?? []
        hits = data.result_data?.hits ?? 0
        multiplier = data.result_data?.multiplier ?? 0
      } else {
        // Demo mode — local provably fair
        const { result, nonce: betNonce, clientSeed: betClientSeed, serverSeedHash: betHash } = 
          await generateBet('keno', { 
            totalNumbers: TOTAL_NUMBERS, 
            drawCount: DRAW_COUNT,
            picks: selectedNumbers.length 
          })

        setLastBetInfo({
          nonce: betNonce,
          clientSeed: betClientSeed,
          serverSeedHash: betHash
        })

        drawnResult = result as number[]
        hits = selectedNumbers.filter(n => drawnResult.includes(n)).length
        const payoutTable = payoutTables[riskLevel][selectedNumbers.length] || []
        multiplier = payoutTable[hits] || 0
      }

      // Animate drawing numbers one by one
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
    } finally {
      setIsPlaying(false)
    }
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
                <motion.button
                  onClick={handlePlay}
                  disabled={isPlaying || selectedNumbers.length === 0 || !initialized}
                  whileHover={!isPlaying && selectedNumbers.length > 0 ? { scale: 1.02 } : {}}
                  whileTap={!isPlaying && selectedNumbers.length > 0 ? { scale: 0.98 } : {}}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2
                    ${isPlaying || selectedNumbers.length === 0
                      ? 'bg-surface cursor-not-allowed text-muted'
                      : 'bg-brand text-background-deep shadow-glow-brand-sm hover:brightness-110'}`}
                >
                  {isPlaying ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RotateCcw className="w-4 h-4" /></motion.div>Drawing...</>
                  ) : (
                    <><Play className="w-4 h-4" />Play Keno</>
                  )}
                </motion.button>
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
                            : risk === 'classic' ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                            : risk === 'medium' ? 'bg-accent-amber/15 border-accent-amber/40 text-accent-amber'
                            : 'bg-accent-red/15 border-accent-red/40 text-accent-red'
                          : 'bg-surface border-border text-muted hover:text-white'}`}>
                      {risk}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1.5">
                <button onClick={handleQuickPick} disabled={isPlaying}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-surface border border-border rounded-xl text-[11px] font-semibold text-muted hover:text-white hover:border-brand/40 transition-all disabled:opacity-50">
                  <Sparkles className="w-3 h-3" />Quick Pick
                </button>
                <button onClick={handleClearSelection} disabled={isPlaying || selectedNumbers.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-surface border border-border rounded-xl text-[11px] font-semibold text-muted hover:text-white hover:border-accent-red/40 transition-all disabled:opacity-50">
                  <X className="w-3 h-3" />Clear
                </button>
              </div>

              {/* Picks info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Picks</div>
                  <div className="text-base font-bold text-brand font-mono">{selectedNumbers.length}/{MAX_PICKS}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Hits</div>
                  <div className="text-base font-bold text-accent-amber font-mono">{gameEnded ? matches : '-'}</div>
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
                          ${gameEnded && matches === hits ? 'bg-brand/15 text-brand' : ''}`}>
                          <span className="text-muted">{hits} hit{hits !== 1 ? 's' : ''}</span>
                          <span className={`font-mono font-bold ${multiplier > 0 ? 'text-brand' : 'text-muted/50'}`}>{multiplier}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </BetControls>

            {/* Right: Game Area */}
            <div className="flex-1 min-w-0">
              <div className="bg-background-secondary rounded-2xl border border-border/60 overflow-hidden p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5 text-brand" />
                    <span className="text-white font-bold text-lg">Keno</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted">Selected: <span className="text-brand font-mono font-bold">{selectedNumbers.length}/{MAX_PICKS}</span></span>
                  </div>
                </div>

                {/* Number Grid - 8x5 */}
                <div className="grid grid-cols-8 gap-2">
                  {Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1).map(num => {
                    const { isSelected, isDrawn, isHit, isMiss } = getNumberState(num)
                    return (
                      <motion.button key={num} onClick={() => handleNumberClick(num)} disabled={isPlaying}
                        whileHover={!isPlaying ? { scale: 1.05 } : {}}
                        whileTap={!isPlaying ? { scale: 0.95 } : {}}
                        className={`relative aspect-square rounded-xl font-bold font-mono tabular-nums text-lg transition-all duration-200 border-2 disabled:cursor-default
                          ${isHit ? 'bg-brand/20 border-brand text-brand shadow-lg shadow-brand/25'
                            : isDrawn && !isSelected ? 'bg-brand/20 border-brand/50 text-brand'
                            : isSelected ? 'bg-amber-500/20 border-amber-500 text-accent-amber shadow-lg shadow-amber-500/25'
                            : 'bg-surface-light/50 border-border-light text-text-secondary hover:border-border-light hover:bg-surface-light'}`}>
                        {num}
                        {isHit && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 rounded-xl bg-accent-green/10" />}
                        {isDrawn && !isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 rounded-xl bg-brand/10" />}
                      </motion.button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-500/20 border-2 border-amber-500" />
                    <span className="text-text-secondary">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-brand/20 border-2 border-brand/50" />
                    <span className="text-muted-light">Drawn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-brand/20 border-2 border-brand" />
                    <span className="text-muted-light">Hit</span>
                  </div>
                </div>

                {/* Result Display */}
                <AnimatePresence>
                  {gameEnded && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={`mt-4 rounded-xl p-4 border text-center
                        ${matches > 0 && payoutTables[riskLevel][selectedNumbers.length]?.[matches] > 0
                          ? 'bg-brand/10 border-brand/30' : 'bg-accent-red/10 border-accent-red/30'}`}>
                      <div className={`text-2xl font-black font-mono ${matches > 0 && payoutTables[riskLevel][selectedNumbers.length]?.[matches] > 0 ? 'text-brand' : 'text-accent-red'}`}>
                        {matches} / {selectedNumbers.length} hits — {(payoutTables[riskLevel][selectedNumbers.length]?.[matches] || 0)}x
                      </div>
                      <div className="text-sm text-muted mt-1">
                        {payoutTables[riskLevel][selectedNumbers.length]?.[matches] > 0
                          ? `Won $${(parseFloat(betAmount) * (payoutTables[riskLevel][selectedNumbers.length]?.[matches] || 0)).toFixed(2)}`
                          : `Lost $${parseFloat(betAmount).toFixed(2)}`}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <LiveBetsTable game="keno" />
            </div>
          </div>

          <FairnessModal
            isOpen={showFairness}
            onClose={() => setShowFairness(false)}
            game="keno"
            serverSeedHash={serverSeedHash}
            clientSeed={clientSeed}
            nonce={nonce}
            previousServerSeed={previousServerSeed}
            onClientSeedChange={setClientSeed}
            onRotateSeed={rotateSeed}
          />
        </div>
      </div>
    </GameLayout>
  )
}

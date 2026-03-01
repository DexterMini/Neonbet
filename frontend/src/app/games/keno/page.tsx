'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { Grid3X3, Shield, Sparkles, Zap, Trophy, X, RotateCcw, Play } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'

type RiskLevel = 'low' | 'classic' | 'medium' | 'high'

/* ── Floating particles ───────────────────────────── */
const KENO_PARTICLE_COLORS = ['#00E87B', '#34d399', '#6ee7b7', '#059669', '#047857', '#a7f3d0']
function FloatingNumbers() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {KENO_PARTICLE_COLORS.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${6 + i * 15}%` }}
          animate={{ opacity: [0, 0.3, 0], y: '-10%', x: `${6 + i * 15 + (Math.random() - 0.5) * 10}%` }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

const payoutTables: Record<RiskLevel, Record<number, number[]>> = {
  low: {
    1: [0, 3.96],
    2: [0, 1.61, 6.43],
    3: [0, 1.29, 1.94, 12.91],
    4: [0, 0.66, 1.99, 5.3, 26.51],
    5: [0, 0.43, 1.44, 3.59, 11.49, 43.11],
    6: [0, 0, 1.24, 3.1, 6.2, 23.26, 77.54],
    7: [0, 0, 0.76, 2.28, 5.31, 12.14, 37.92, 121.35],
    8: [0, 0, 0.63, 1.57, 3.92, 7.84, 18.82, 62.74, 156.86],
    9: [0, 0, 0, 1.66, 3.32, 5.8, 13.27, 33.17, 99.51, 248.77],
    10: [0, 0, 0, 0.91, 2.74, 5.48, 10.96, 27.39, 73.04, 182.6, 456.5],
  },
  classic: {
    1: [0, 3.96],
    2: [0, 1.35, 8.13],
    3: [0, 0.85, 2.13, 26.64],
    4: [0, 0, 2.47, 7.4, 74.01],
    5: [0, 0, 1.42, 4.26, 21.29, 141.92],
    6: [0, 0, 0.73, 2.93, 11.73, 44, 293.37],
    7: [0, 0, 0.42, 2.1, 7, 21.01, 84.04, 420.18],
    8: [0, 0, 0, 1.67, 5, 13.34, 50.01, 166.69, 833.47],
    9: [0, 0, 0, 0.93, 3.72, 9.29, 27.88, 92.95, 278.85, 1487.2],
    10: [0, 0, 0, 0, 3.11, 8.3, 20.75, 62.24, 165.97, 518.66, 3111.98],
  },
  medium: {
    1: [0, 3.96],
    2: [0, 1.03, 10.3],
    3: [0, 0.4, 2.4, 40],
    4: [0, 0, 1.68, 10.09, 100.95],
    5: [0, 0, 0.54, 5.39, 32.34, 269.47],
    6: [0, 0, 0, 3.66, 14.63, 73.16, 609.68],
    7: [0, 0, 0, 1.72, 9.17, 34.4, 172.01, 1032.07],
    8: [0, 0, 0, 1.13, 5.63, 16.88, 67.5, 281.27, 1687.62],
    9: [0, 0, 0, 0, 4.24, 14.14, 42.43, 169.73, 707.22, 4243.32],
    10: [0, 0, 0, 0, 2.73, 8.2, 27.32, 81.95, 341.47, 1365.89, 6829.45],
  },
  high: {
    1: [0, 3.96],
    2: [0, 0.79, 11.88],
    3: [0, 0, 2.61, 52.17],
    4: [0, 0, 1.11, 11.06, 138.22],
    5: [0, 0, 0.26, 5.14, 41.08, 308.11],
    6: [0, 0, 0, 2.74, 16.43, 109.5, 657.01],
    7: [0, 0, 0, 1.17, 8.75, 46.66, 291.62, 1749.72],
    8: [0, 0, 0, 0.55, 5.53, 22.12, 110.61, 553.03, 2765.13],
    9: [0, 0, 0, 0, 3.36, 13.45, 67.24, 336.19, 1680.95, 8068.54],
    10: [0, 0, 0, 0, 2.16, 7.18, 35.92, 179.61, 862.13, 4310.67, 14368.9],
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
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)

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

  const handlePlay = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (isPlaying || isPlacing || !initialized) return { won: false, profit: 0 }
    if (selectedNumbers.length === 0) { toast.error('Select at least 1 number'); return { won: false, profit: 0 } }
    if (bet <= 0 || isNaN(bet)) { toast.error('Invalid bet amount'); return { won: false, profit: 0 } }

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
        multiplier = parseFloat(((payoutTable[hits] || 0) * 0.98).toFixed(2)) // 3% house edge
      }

      for (let i = 0; i < drawnResult.length; i++) {
        await new Promise(r => setTimeout(r, 150))
        setDrawnNumbers(prev => [...prev, drawnResult[i]])
      }

      setGameEnded(true)
      const winnings = bet * multiplier
      const won = multiplier > 0
      const profit = won ? winnings - bet : -bet
      if (won) {
        sessionStats.recordBet(true, bet, winnings - bet, multiplier)
        toast.success(`${hits} hits! Won $${winnings.toFixed(2)} (${multiplier}x)`)
      } else {
        sessionStats.recordBet(false, bet, -bet, 0)
        toast.error(`${hits} hits - Better luck next time!`)
      }
      return { won, profit }
    } catch (error: any) {
      toast.error(error?.message || 'Error generating result')
      return { won: false, profit: -bet }
    } finally { setIsPlaying(false) }
  }, [betAmount, isPlaying, isPlacing, initialized, selectedNumbers, isAuthenticated, riskLevel, placeBet, generateBet, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => handlePlay(amount), [handlePlay])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (!isPlaying && !autoBetState.running) handlePlay() }, () => autoBetStop(), !isPlaying)

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
              autoBetConfig={autoBetConfig}
              onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState}
              onAutoBetStart={autoBetStart}
              onAutoBetStop={autoBetStop}
              actionButton={
                <button onClick={() => handlePlay()} disabled={isPlaying || selectedNumbers.length === 0 || !initialized}
                  className="w-full py-3.5 rounded-xl font-bold text-[14px] transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                  style={isPlaying || selectedNumbers.length === 0 ? {
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.3)',
                  } : {
                    background: 'linear-gradient(135deg, rgb(0,210,190) 0%, rgb(0,180,160) 100%)',
                    color: '#0A0B0F',
                    boxShadow: '0 4px 20px rgba(0,210,190,0.3), 0 0 0 1px rgba(0,210,190,0.1)',
                  }}>
                  {isPlaying ? <><RotateCcw className="w-4 h-4 animate-spin" />Drawing...</> : <><Play className="w-4 h-4" />Play Keno</>}
                </button>
              }
            >
              {/* Risk Level */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">Risk Level</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['low', 'classic', 'medium', 'high'] as RiskLevel[]).map(risk => {
                    const isActive = riskLevel === risk
                    return (
                      <button key={risk} onClick={() => setRiskLevel(risk)} disabled={isPlaying}
                        className={`relative py-2.5 rounded-xl text-[13px] font-bold capitalize transition-all duration-200 disabled:opacity-40
                          ${isActive
                            ? 'text-white shadow-lg'
                            : 'bg-surface/80 text-muted-light hover:text-white border border-border hover:border-white/15'
                          }`}
                        style={isActive ? {
                          background: 'linear-gradient(135deg, rgba(0,210,190,0.25) 0%, rgba(0,180,160,0.15) 100%)',
                          border: '1.5px solid rgba(0,210,190,0.5)',
                          boxShadow: '0 0 20px rgba(0,210,190,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
                        } : {}}>
                        {risk}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <button onClick={handleQuickPick} disabled={isPlaying}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface/80 border border-border rounded-xl text-[12px] font-semibold text-muted-light hover:text-white hover:border-white/15 transition-all duration-200 disabled:opacity-40 group">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400/70 group-hover:text-cyan-400 transition-colors" />Quick Pick
                </button>
                <button onClick={handleClearSelection} disabled={isPlaying || selectedNumbers.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface/80 border border-border rounded-xl text-[12px] font-semibold text-muted-light hover:text-white hover:border-red-400/30 transition-all duration-200 disabled:opacity-40 group">
                  <X className="w-3.5 h-3.5 text-muted group-hover:text-red-400 transition-colors" />Clear
                </button>
              </div>

              {/* Picks / Hits */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface/80 rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">Picks</div>
                  <div className="text-xl font-black font-mono tracking-tight" style={{ color: 'rgb(0,210,190)' }}>
                    {selectedNumbers.length}<span className="text-muted text-sm font-semibold">/{MAX_PICKS}</span>
                  </div>
                </div>
                <div className="bg-surface/80 rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">Hits</div>
                  <div className="text-xl font-black font-mono tracking-tight text-amber-400">
                    {gameEnded ? matches : <span className="text-muted">-</span>}
                  </div>
                </div>
              </div>

              {/* Payout Table */}
              {selectedNumbers.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">Payouts ({selectedNumbers.length} picks)</span>
                  <div className="bg-surface/80 rounded-xl border border-border overflow-hidden">
                    <div className="max-h-36 overflow-y-auto scrollbar-thin">
                      {potentialPayouts.map(({ hits, multiplier, payout }) => (
                        <div key={hits} className={`flex items-center justify-between px-3 py-1.5 text-[12px] border-b border-border/30 last:border-0 transition-colors
                          ${gameEnded && matches === hits ? 'bg-[rgba(0,210,190,0.1)]' : 'hover:bg-white/[0.02]'}`}>
                          <span className={`${gameEnded && matches === hits ? 'text-white font-semibold' : 'text-muted-light'}`}>
                            {hits} hit{hits !== 1 ? 's' : ''}
                          </span>
                          <span className={`font-mono font-bold ${
                            gameEnded && matches === hits ? 'text-white' :
                            multiplier > 0 ? 'text-[rgb(0,210,190)]' : 'text-muted/40'
                          }`}>
                            {multiplier > 0 ? `${multiplier}×` : '—'}
                          </span>
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
                    <GameSettingsDropdown />
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

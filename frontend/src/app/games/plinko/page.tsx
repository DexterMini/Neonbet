'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { Circle, RotateCcw, TrendingUp, ChevronDown, Sparkles } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'

interface Ball { id: number; x: number; y: number; path: number[]; finalSlot: number; multiplier: number }
interface BetHistory { id: number; multiplier: number; payout: number; bet: number; risk: string; rows: number; timestamp: Date }

const PLINKO_MULTIPLIERS: Record<string, Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    9: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    10: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    11: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    9: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    10: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    11: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    13: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    9: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    10: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
}

const ROW_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16]

/* ── Floating particles ───────────────────────────── */
function FloatingBalls({ active }: { active: boolean }) {
  if (!active) return null
  const items = ['⚪', '🟢', '⭕', '✨', '🔵', '💚']
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((e, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${8 + i * 15}%` }}
          animate={{ opacity: [0, 0.3, 0], y: '-10%', x: `${8 + i * 15 + (Math.random() - 0.5) * 12}%` }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          className="absolute text-xs select-none"
        >{e}</motion.div>
      ))}
    </div>
  )
}

export default function PlinkoPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [plinkoRows, setPlinkoRows] = useState<number>(12)
  const [plinkoRisk, setPlinkoRisk] = useState<'low' | 'medium' | 'high'>('medium')
  const [balls, setBalls] = useState<Ball[]>([])
  const [isDropping, setIsDropping] = useState(false)
  const [lastResult, setLastResult] = useState<{ multiplier: number; payout: number } | null>(null)
  const [showFairness, setShowFairness] = useState(false)
  const [betHistory, setBetHistory] = useState<BetHistory[]>([])
  const [showRowsDropdown, setShowRowsDropdown] = useState(false)
  const [totalProfit, setTotalProfit] = useState(0)
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)

  const multipliers = PLINKO_MULTIPLIERS[plinkoRisk][plinkoRows] || PLINKO_MULTIPLIERS.medium[12]

  // Draw Plinko board
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
    bgGradient.addColorStop(0, '#0c1118')
    bgGradient.addColorStop(0.5, '#0a0f16')
    bgGradient.addColorStop(1, '#0d1120')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, width, height)

    // Subtle radial glow
    const glowGrad = ctx.createRadialGradient(width / 2, height / 3, 0, width / 2, height / 3, 300)
    glowGrad.addColorStop(0, 'rgba(0, 232, 123, 0.04)')
    glowGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = glowGrad
    ctx.fillRect(0, 0, width, height)

    // Draw pegs
    const pegRadius = 5
    const startY = 50
    const endY = height - 80
    const rowHeight = (endY - startY) / plinkoRows

    for (let row = 0; row < plinkoRows; row++) {
      const pegsInRow = row + 3
      const y = startY + row * rowHeight
      const pegSpacing = Math.min(35, (width - 60) / (pegsInRow - 1))
      const startX = (width - (pegsInRow - 1) * pegSpacing) / 2

      for (let col = 0; col < pegsInRow; col++) {
        const x = startX + col * pegSpacing

        // Glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, pegRadius * 3.5)
        gradient.addColorStop(0, 'rgba(0, 232, 123, 0.12)')
        gradient.addColorStop(1, 'rgba(0, 232, 123, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, pegRadius * 3.5, 0, Math.PI * 2)
        ctx.fill()

        // Peg body
        const pegGrad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, pegRadius)
        pegGrad.addColorStop(0, '#3A3F50')
        pegGrad.addColorStop(1, '#22252F')
        ctx.beginPath()
        ctx.arc(x, y, pegRadius, 0, Math.PI * 2)
        ctx.fillStyle = pegGrad
        ctx.fill()

        // Highlight
        ctx.beginPath()
        ctx.arc(x - 1.5, y - 1.5, pegRadius * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
        ctx.fill()
      }
    }

    // Draw multiplier slots
    const slotCount = multipliers.length
    const slotWidth = (width - 20) / slotCount
    const slotHeight = 45
    const slotY = height - slotHeight - 10

    multipliers.forEach((mult, i) => {
      const x = 10 + i * slotWidth
      let color: string, bgColor: string
      if (mult >= 100) { color = '#fbbf24'; bgColor = 'rgba(251,191,36,0.18)' }
      else if (mult >= 10) { color = '#f97316'; bgColor = 'rgba(249,115,22,0.14)' }
      else if (mult >= 2) { color = '#a78bfa'; bgColor = 'rgba(167,139,250,0.14)' }
      else if (mult >= 1) { color = '#34d399'; bgColor = 'rgba(52,211,153,0.14)' }
      else { color = '#f87171'; bgColor = 'rgba(248,113,113,0.10)' }

      ctx.fillStyle = bgColor
      ctx.beginPath()
      ctx.roundRect(x + 2, slotY, slotWidth - 4, slotHeight - 5, 8)
      ctx.fill()
      ctx.strokeStyle = color + '30'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = color
      ctx.font = 'bold 11px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${mult}×`, x + slotWidth / 2, slotY + slotHeight / 2 - 2)
    })

    // Draw balls
    balls.forEach(ball => {
      const ballGradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 22)
      ballGradient.addColorStop(0, 'rgba(0, 232, 123, 0.45)')
      ballGradient.addColorStop(1, 'rgba(0, 232, 123, 0)')
      ctx.fillStyle = ballGradient
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, 22, 0, Math.PI * 2)
      ctx.fill()

      const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, 10)
      gradient.addColorStop(0, '#7DFBB3')
      gradient.addColorStop(0.5, '#00E87B')
      gradient.addColorStop(1, '#00C466')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [plinkoRows, multipliers, balls])

  useEffect(() => { drawBoard() }, [drawBoard])

  // Drop ball
  const dropBall = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (!initialized || isPlacing || bet <= 0 || isNaN(bet)) return { won: false, profit: -bet }
    setIsDropping(true); setLastResult(null)

    const canvas = canvasRef.current
    if (!canvas) return { won: false, profit: -bet }
    const { width, height } = canvas
    const startY = 35; const endY = height - 80; const rowHeight = (endY - startY) / plinkoRows

    let path: number[]
    try {
      if (isAuthenticated) {
        const data = await placeBet('plinko', betAmount, 'usdt', { rows: plinkoRows, risk: plinkoRisk })
        const rawPath: string[] = data.result_data?.path ?? []
        path = rawPath.map(d => (d === 'R' ? 1 : 0))
      } else {
        const { result: pathResult } = await generateBet('plinko', { rows: plinkoRows })
        path = pathResult as number[]
      }
    } catch (err: any) { toast.error(err?.message || 'Error placing bet'); setIsDropping(false); return { won: false, profit: -bet } }

    let position = 0
    path.forEach(dir => { position += dir === 0 ? -1 : 1 })
    const finalSlot = Math.round((position + plinkoRows) / 2)
    const clampedSlot = Math.max(0, Math.min(finalSlot, multipliers.length - 1))
    const multiplier = multipliers[clampedSlot]

    const ballId = Date.now()
    let currentX = width / 2
    let currentY = startY

    for (let row = 0; row < plinkoRows; row++) {
      const pegsInRow = row + 3
      const pegSpacing = Math.min(35, (width - 60) / (pegsInRow - 1))
      const moveAmount = pegSpacing / 2
      const targetX = currentX + (path[row] === 0 ? -moveAmount : moveAmount)
      const targetY = startY + (row + 1) * rowHeight
      for (let frame = 0; frame < 8; frame++) {
        currentX += (targetX - currentX) * 0.35
        currentY += (targetY - currentY) * 0.35
        setBalls([{ id: ballId, x: currentX, y: currentY, path, finalSlot: clampedSlot, multiplier }])
        await new Promise(r => setTimeout(r, 25))
      }
    }

    const slotWidth = (width - 20) / multipliers.length
    const finalX = 10 + clampedSlot * slotWidth + slotWidth / 2
    for (let frame = 0; frame < 12; frame++) {
      currentX += (finalX - currentX) * 0.25
      currentY += (height - 45 - currentY) * 0.25
      setBalls([{ id: ballId, x: currentX, y: currentY, path, finalSlot: clampedSlot, multiplier }])
      await new Promise(r => setTimeout(r, 25))
    }

    const payout = bet * multiplier
    const profit = payout - bet
    setLastResult({ multiplier, payout })
    setTotalProfit(prev => prev + profit)
    sessionStats.recordBet(multiplier >= 1, bet, profit, multiplier)
    setBetHistory(prev => [{ id: ballId, multiplier, payout, bet, risk: plinkoRisk, rows: plinkoRows, timestamp: new Date() }, ...prev].slice(0, 20))
    const won = multiplier >= 1
    if (won) toast.success(`${multiplier}x multiplier! Won $${payout.toFixed(2)}`)
    else toast.error(`${multiplier}x - Lost $${(bet - payout).toFixed(2)}`)
    await new Promise(r => setTimeout(r, 800))
    setBalls([]); setIsDropping(false)
    return { won, profit }
  }, [betAmount, initialized, isPlacing, isAuthenticated, plinkoRows, plinkoRisk, multipliers, placeBet, generateBet, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => dropBall(amount), [dropBall])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (!isDropping && !autoBetState.running) dropBall() }, () => autoBetStop(), !isDropping)

  const getMultiplierColor = (mult: number) => {
    if (mult >= 100) return 'text-amber-400'
    if (mult >= 10) return 'text-orange-400'
    if (mult >= 2) return 'text-brand'
    if (mult >= 1) return 'text-emerald-400'
    return 'text-accent-red'
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
              disabled={isDropping}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig}
              onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState}
              onAutoBetStart={autoBetStart}
              onAutoBetStop={autoBetStop}
              actionButton={
                <button onClick={() => dropBall()} disabled={isDropping || !initialized}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2
                    ${isDropping || !initialized ? 'bg-surface cursor-not-allowed text-muted' : 'bg-gradient-to-r from-brand to-emerald-400 text-background-deep shadow-lg shadow-brand/30 hover:brightness-110'}`}>
                  {isDropping ? <><RotateCcw className="w-4 h-4 animate-spin" />Dropping...</> : <><Sparkles className="w-4 h-4" />Drop Ball</>}
                </button>
              }
            >
              {/* Risk */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Risk Level</span>
                <div className="flex gap-1.5">
                  {(['low', 'medium', 'high'] as const).map(risk => (
                    <button key={risk} onClick={() => setPlinkoRisk(risk)} disabled={isDropping}
                      className={`flex-1 py-2 rounded-xl text-[12px] font-bold capitalize transition-all border disabled:opacity-50
                        ${plinkoRisk === risk
                          ? risk === 'low' ? 'bg-brand/15 border-brand/40 text-brand'
                            : risk === 'medium' ? 'bg-accent-amber/15 border-accent-amber/40 text-accent-amber'
                            : 'bg-accent-red/15 border-accent-red/40 text-accent-red'
                          : 'bg-surface border-border text-muted hover:text-white'}`}>
                      {risk}
                    </button>
                  ))}
                </div>
              </div>
              {/* Rows */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Rows</span>
                <div className="relative">
                  <button onClick={() => setShowRowsDropdown(!showRowsDropdown)} disabled={isDropping}
                    className="w-full flex items-center justify-between bg-surface border border-border rounded-xl px-3 py-2.5 text-[13px] text-white font-mono disabled:opacity-50 transition-colors">
                    <span>{plinkoRows} Rows</span>
                    <ChevronDown className={`w-4 h-4 text-muted transition-transform ${showRowsDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showRowsDropdown && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-background-secondary border border-border rounded-xl overflow-hidden z-20 shadow-xl max-h-48 overflow-y-auto">
                        {ROW_OPTIONS.map(rows => (
                          <button key={rows} onClick={() => { setPlinkoRows(rows); setShowRowsDropdown(false) }}
                            className={`w-full px-3 py-2 text-left font-mono text-[12px] transition-colors
                              ${plinkoRows === rows ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-surface hover:text-white'}`}>
                            {rows} Rows
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              {/* Last result */}
              <AnimatePresence>
                {lastResult && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className={`rounded-xl p-3.5 text-center border ${lastResult.multiplier >= 1 ? 'bg-brand/[0.06] border-brand/20' : 'bg-accent-red/10 border-accent-red/30'}`}>
                    <div className={`text-2xl font-black font-mono ${lastResult.multiplier >= 1 ? 'text-brand' : 'text-accent-red'}`}>{lastResult.multiplier}×</div>
                    <div className="text-[11px] text-muted mt-0.5">${lastResult.payout.toFixed(2)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* Right: Game Board — Premium Scene */}
            <div className="flex-1 min-w-0">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #0c1225 0%, #0a0f1a 40%, #0e1028 100%)' }}>
                <FloatingBalls active />

                {/* ambient glow */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-violet-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(167,139,250,0.06) 100%)' }}>
                      <Circle className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Plinko</h2>
                      <p className="text-violet-300/30 text-[10px] mt-0.5">{plinkoRows} rows • {plinkoRisk} risk</p>
                    </div>
                  </div>
                  {betHistory.length > 0 && (
                    <div className="flex gap-1.5">
                      {betHistory.slice(0, 6).map(h => (
                        <span key={h.id} className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ring-1 ring-white/[0.06]
                          ${h.multiplier >= 2 ? 'bg-brand/10 text-brand' : h.multiplier >= 1 ? 'bg-amber-400/10 text-amber-400' : 'bg-accent-red/10 text-accent-red'}`}>
                          {h.multiplier}×
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative z-10 px-4 pb-4">
                  <canvas ref={canvasRef} width={600} height={500} className="w-full rounded-xl" style={{ maxHeight: '500px' }} />
                </div>

                {/* Legend */}
                <div className="relative z-10 flex items-center justify-center gap-4 px-5 pb-4 text-[10px] text-white/25">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />100×+</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />10×+</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" />2×+</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />1×+</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />&lt;1×</div>
                </div>
              </div>

              <LiveBetsTable game="plinko" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="plinko"
            serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
            previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

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
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useRouter } from 'next/navigation'

interface Ball { id: number; x: number; y: number; path: number[]; finalSlot: number; multiplier: number; done?: boolean }
interface BetHistory { id: number; multiplier: number; payout: number; bet: number; risk: string; rows: number; timestamp: Date }

const PLINKO_MULTIPLIERS: Record<string, Record<number, number[]>> = {
  low: {
    8: [5.4, 2, 1.07, 0.97, 0.48, 0.97, 1.07, 2, 5.4],
    9: [5.4, 1.9, 1.55, 0.97, 0.68, 0.68, 0.97, 1.55, 1.9, 5.4],
    10: [8.6, 2.9, 1.36, 1.07, 0.97, 0.48, 0.97, 1.07, 1.36, 2.9, 8.6],
    11: [8.1, 2.9, 1.84, 1.26, 0.97, 0.68, 0.68, 0.97, 1.26, 1.84, 2.9, 8.1],
    12: [9.7, 2.9, 1.55, 1.36, 1.07, 0.97, 0.48, 0.97, 1.07, 1.36, 1.55, 2.9, 9.7],
    13: [7.8, 3.9, 2.9, 1.84, 1.16, 0.87, 0.68, 0.68, 0.87, 1.16, 1.84, 2.9, 3.9, 7.8],
    14: [6.9, 3.9, 1.84, 1.36, 1.26, 1.07, 0.97, 0.48, 0.97, 1.07, 1.26, 1.36, 1.84, 3.9, 6.9],
    15: [14.5, 7.8, 2.9, 1.94, 1.46, 1.07, 0.97, 0.68, 0.68, 0.97, 1.07, 1.46, 1.94, 2.9, 7.8, 14.5],
    16: [15.5, 8.7, 1.94, 1.36, 1.36, 1.16, 1.07, 0.97, 0.48, 0.97, 1.07, 1.16, 1.36, 1.36, 1.94, 8.7, 15.5],
  },
  medium: {
    8: [12.6, 2.9, 1.26, 0.68, 0.39, 0.68, 1.26, 2.9, 12.6],
    9: [17.5, 3.9, 1.65, 0.87, 0.48, 0.48, 0.87, 1.65, 3.9, 17.5],
    10: [21.3, 4.8, 1.94, 1.36, 0.58, 0.39, 0.58, 1.36, 1.94, 4.8, 21.3],
    11: [23.3, 5.8, 2.9, 1.75, 0.68, 0.48, 0.48, 0.68, 1.75, 2.9, 5.8, 23.3],
    12: [32, 10.7, 3.9, 1.94, 1.07, 0.58, 0.29, 0.58, 1.07, 1.94, 3.9, 10.7, 32],
    13: [41.7, 12.6, 5.8, 2.9, 1.26, 0.68, 0.39, 0.39, 0.68, 1.26, 2.9, 5.8, 12.6, 41.7],
    14: [56.3, 14.5, 6.8, 3.9, 1.84, 0.97, 0.48, 0.19, 0.48, 0.97, 1.84, 3.9, 6.8, 14.5, 56.3],
    15: [85.4, 17.5, 10.7, 4.8, 2.9, 1.26, 0.48, 0.29, 0.29, 0.48, 1.26, 2.9, 4.8, 10.7, 17.5, 85.4],
    16: [107, 39.8, 9.7, 4.8, 2.9, 1.46, 0.97, 0.48, 0.29, 0.48, 0.97, 1.46, 2.9, 4.8, 9.7, 39.8, 107],
  },
  high: {
    8: [28.1, 3.9, 1.46, 0.29, 0.19, 0.29, 1.46, 3.9, 28.1],
    9: [41.7, 6.8, 1.94, 0.58, 0.19, 0.19, 0.58, 1.94, 6.8, 41.7],
    10: [73.8, 9.7, 2.9, 0.87, 0.29, 0.19, 0.29, 0.87, 2.9, 9.7, 73.8],
    11: [116.4, 13.6, 5, 1.36, 0.39, 0.19, 0.19, 0.39, 1.36, 5, 13.6, 116.4],
    12: [165, 23.3, 7.8, 1.94, 0.68, 0.19, 0.19, 0.19, 0.68, 1.94, 7.8, 23.3, 165],
    13: [252.2, 35.9, 10.7, 3.9, 0.97, 0.19, 0.19, 0.19, 0.19, 0.97, 3.9, 10.7, 35.9, 252.2],
    14: [407.4, 54.3, 17.5, 4.8, 1.84, 0.29, 0.19, 0.19, 0.19, 0.29, 1.84, 4.8, 17.5, 54.3, 407.4],
    15: [601.4, 80.5, 26.2, 7.8, 2.9, 0.48, 0.19, 0.19, 0.19, 0.19, 0.48, 2.9, 7.8, 26.2, 80.5, 601.4],
    16: [970, 126.1, 25.2, 8.7, 3.9, 1.94, 0.19, 0.19, 0.19, 0.19, 0.19, 1.94, 3.9, 8.7, 25.2, 126.1, 970],
  },
}

const ROW_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16]

/* ── Floating particles ───────────────────────────── */
const PLINKO_PARTICLE_COLORS = ['#f97316', '#fb923c', '#fdba74', '#ea580c', '#c2410c', '#fed7aa']
function FloatingBalls({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {PLINKO_PARTICLE_COLORS.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${8 + i * 15}%` }}
          animate={{ opacity: [0, 0.3, 0], y: '-10%', x: `${8 + i * 15 + (Math.random() - 0.5) * 12}%` }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          className="absolute w-2 h-2 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

export default function PlinkoPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()
  const router = useRouter()

  const [betAmount, setBetAmount] = useState('10.00')
  const [plinkoRows, setPlinkoRows] = useState<number>(12)
  const [plinkoRisk, setPlinkoRisk] = useState<'low' | 'medium' | 'high'>('medium')
  const [balls, setBalls] = useState<Ball[]>([])
  const [isDropping, setIsDropping] = useState(false)
  const activeBallsRef = useRef(0)
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

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  // Drop ball — runs concurrently, multiple balls can fly at once
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
      const data = await placeBet('plinko', betAmount, 'usdt', { rows: plinkoRows, risk: plinkoRisk })
      const rawPath: string[] = data.result_data?.path ?? []
      path = rawPath.map(d => (d === 'R' ? 1 : 0))
    } catch (err: any) { toast.error(err?.message || 'Error placing bet'); setIsDropping(false); return { won: false, profit: -bet } }

    let position = 0
    path.forEach(dir => { position += dir === 0 ? -1 : 1 })
    const finalSlot = Math.round((position + plinkoRows) / 2)
    const clampedSlot = Math.max(0, Math.min(finalSlot, multipliers.length - 1))
    const multiplier = multipliers[clampedSlot]

    const ballId = Date.now() + Math.random()
    activeBallsRef.current++
    let currentX = width / 2 + (Math.random() - 0.5) * 8 // slight offset for multi-ball
    let currentY = startY

    // Animate through pegs — much faster: 4 frames per row, 10ms per frame
    for (let row = 0; row < plinkoRows; row++) {
      const pegsInRow = row + 3
      const pegSpacing = Math.min(35, (width - 60) / (pegsInRow - 1))
      const moveAmount = pegSpacing / 2
      const targetX = currentX + (path[row] === 0 ? -moveAmount : moveAmount)
      const targetY = startY + (row + 1) * rowHeight
      for (let frame = 0; frame < 4; frame++) {
        currentX += (targetX - currentX) * 0.55
        currentY += (targetY - currentY) * 0.55
        const bx = currentX, by = currentY
        setBalls(prev => {
          const others = prev.filter(b => b.id !== ballId)
          return [...others, { id: ballId, x: bx, y: by, path, finalSlot: clampedSlot, multiplier }]
        })
        await new Promise(r => setTimeout(r, 10))
      }
    }

    // Settle into slot — 6 frames
    const slotWidth = (width - 20) / multipliers.length
    const finalX = 10 + clampedSlot * slotWidth + slotWidth / 2
    for (let frame = 0; frame < 6; frame++) {
      currentX += (finalX - currentX) * 0.4
      currentY += (height - 45 - currentY) * 0.4
      const bx = currentX, by = currentY
      setBalls(prev => {
        const others = prev.filter(b => b.id !== ballId)
        return [...others, { id: ballId, x: bx, y: by, path, finalSlot: clampedSlot, multiplier }]
      })
      await new Promise(r => setTimeout(r, 10))
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

    // Remove this ball after brief pause
    await new Promise(r => setTimeout(r, 400))
    setBalls(prev => prev.filter(b => b.id !== ballId))
    activeBallsRef.current--
    if (activeBallsRef.current <= 0) { activeBallsRef.current = 0; setIsDropping(false) }
    return { won, profit }
  }, [betAmount, initialized, isPlacing, plinkoRows, plinkoRisk, multipliers, placeBet, sessionStats])

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
                <button onClick={() => dropBall()} disabled={!initialized}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2
                    ${!initialized ? 'bg-surface cursor-not-allowed text-muted' : 'bg-gradient-to-r from-brand to-emerald-400 text-background-deep shadow-lg shadow-brand/30 hover:brightness-110'}`}>
                  {isDropping ? <><Sparkles className="w-4 h-4 animate-bounce" />Drop Ball</> : <><Sparkles className="w-4 h-4" />Drop Ball</>}
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
                  <div className="flex items-center gap-2">
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
                    <GameSettingsDropdown />
                  </div>
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

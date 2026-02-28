'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { CircleDot, RefreshCw, Shield, Zap, TrendingUp, Sparkles } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'

interface WheelSegment {
  value: number
  color: string
  probability: number
}

type RiskLevel = 'low' | 'medium' | 'high'

const WHEEL_CONFIGS: Record<number, Record<RiskLevel, WheelSegment[]>> = {
  10: {
    low: [
      { value: 0, color: '#27272a', probability: 0.10 },
      { value: 1.2, color: '#3f3f46', probability: 0.35 },
      { value: 1.5, color: '#52525b', probability: 0.30 },
      { value: 2, color: '#34d399', probability: 0.15 },
      { value: 3, color: '#22d3ee', probability: 0.06 },
      { value: 5, color: '#a78bfa', probability: 0.03 },
      { value: 10, color: '#fbbf24', probability: 0.009 },
      { value: 20, color: '#f87171', probability: 0.001 },
    ],
    medium: [
      { value: 0, color: '#27272a', probability: 0.20 },
      { value: 1.2, color: '#3f3f46', probability: 0.25 },
      { value: 1.5, color: '#52525b', probability: 0.20 },
      { value: 2, color: '#34d399', probability: 0.15 },
      { value: 3, color: '#22d3ee', probability: 0.10 },
      { value: 5, color: '#a78bfa', probability: 0.06 },
      { value: 15, color: '#fbbf24', probability: 0.03 },
      { value: 50, color: '#f87171', probability: 0.01 },
    ],
    high: [
      { value: 0, color: '#27272a', probability: 0.35 },
      { value: 1.5, color: '#3f3f46', probability: 0.20 },
      { value: 2, color: '#52525b', probability: 0.15 },
      { value: 3, color: '#34d399', probability: 0.12 },
      { value: 5, color: '#22d3ee', probability: 0.08 },
      { value: 10, color: '#a78bfa', probability: 0.05 },
      { value: 25, color: '#fbbf24', probability: 0.04 },
      { value: 100, color: '#f87171', probability: 0.01 },
    ],
  },
  20: {
    low: [
      { value: 0, color: '#27272a', probability: 0.08 },
      { value: 1.1, color: '#3f3f46', probability: 0.20 },
      { value: 1.2, color: '#52525b', probability: 0.22 },
      { value: 1.3, color: '#71717a', probability: 0.18 },
      { value: 1.5, color: '#34d399', probability: 0.15 },
      { value: 2, color: '#22d3ee', probability: 0.10 },
      { value: 3, color: '#a78bfa', probability: 0.04 },
      { value: 5, color: '#c084fc', probability: 0.02 },
      { value: 10, color: '#fbbf24', probability: 0.009 },
      { value: 25, color: '#f87171', probability: 0.001 },
    ],
    medium: [
      { value: 0, color: '#27272a', probability: 0.15 },
      { value: 1.1, color: '#3f3f46', probability: 0.18 },
      { value: 1.2, color: '#52525b', probability: 0.18 },
      { value: 1.5, color: '#71717a', probability: 0.15 },
      { value: 2, color: '#34d399', probability: 0.12 },
      { value: 3, color: '#22d3ee', probability: 0.10 },
      { value: 5, color: '#a78bfa', probability: 0.06 },
      { value: 10, color: '#c084fc', probability: 0.04 },
      { value: 25, color: '#fbbf24', probability: 0.015 },
      { value: 50, color: '#f87171', probability: 0.005 },
    ],
    high: [
      { value: 0, color: '#27272a', probability: 0.30 },
      { value: 1.2, color: '#3f3f46', probability: 0.15 },
      { value: 1.5, color: '#52525b', probability: 0.15 },
      { value: 2, color: '#71717a', probability: 0.12 },
      { value: 3, color: '#34d399', probability: 0.10 },
      { value: 5, color: '#22d3ee', probability: 0.08 },
      { value: 10, color: '#a78bfa', probability: 0.05 },
      { value: 25, color: '#c084fc', probability: 0.03 },
      { value: 50, color: '#fbbf24', probability: 0.015 },
      { value: 100, color: '#f87171', probability: 0.005 },
    ],
  },
  30: {
    low: [
      { value: 0, color: '#27272a', probability: 0.05 },
      { value: 1.05, color: '#3f3f46', probability: 0.15 },
      { value: 1.1, color: '#52525b', probability: 0.18 },
      { value: 1.2, color: '#71717a', probability: 0.18 },
      { value: 1.3, color: '#a1a1aa', probability: 0.15 },
      { value: 1.5, color: '#34d399', probability: 0.12 },
      { value: 1.8, color: '#22d3ee', probability: 0.08 },
      { value: 2, color: '#a78bfa', probability: 0.05 },
      { value: 2.5, color: '#c084fc', probability: 0.025 },
      { value: 3, color: '#fbbf24', probability: 0.01 },
      { value: 5, color: '#fb923c', probability: 0.004 },
      { value: 10, color: '#f87171', probability: 0.001 },
    ],
    medium: [
      { value: 0, color: '#27272a', probability: 0.12 },
      { value: 1.1, color: '#3f3f46', probability: 0.15 },
      { value: 1.2, color: '#52525b', probability: 0.15 },
      { value: 1.3, color: '#71717a', probability: 0.12 },
      { value: 1.5, color: '#a1a1aa', probability: 0.12 },
      { value: 1.8, color: '#34d399', probability: 0.10 },
      { value: 2, color: '#22d3ee', probability: 0.08 },
      { value: 2.5, color: '#a78bfa', probability: 0.06 },
      { value: 3, color: '#c084fc', probability: 0.04 },
      { value: 5, color: '#fbbf24', probability: 0.03 },
      { value: 10, color: '#fb923c', probability: 0.02 },
      { value: 25, color: '#f87171', probability: 0.01 },
    ],
    high: [
      { value: 0, color: '#27272a', probability: 0.25 },
      { value: 1.2, color: '#3f3f46', probability: 0.12 },
      { value: 1.5, color: '#52525b', probability: 0.12 },
      { value: 2, color: '#71717a', probability: 0.12 },
      { value: 2.5, color: '#a1a1aa', probability: 0.10 },
      { value: 3, color: '#34d399', probability: 0.08 },
      { value: 5, color: '#22d3ee', probability: 0.08 },
      { value: 10, color: '#a78bfa', probability: 0.05 },
      { value: 15, color: '#c084fc', probability: 0.04 },
      { value: 25, color: '#fbbf24', probability: 0.025 },
      { value: 50, color: '#fb923c', probability: 0.01 },
      { value: 100, color: '#f87171', probability: 0.005 },
    ],
  },
  40: {
    low: [
      { value: 0, color: '#27272a', probability: 0.03 },
      { value: 1.02, color: '#3f3f46', probability: 0.12 },
      { value: 1.05, color: '#52525b', probability: 0.15 },
      { value: 1.1, color: '#71717a', probability: 0.18 },
      { value: 1.15, color: '#a1a1aa', probability: 0.15 },
      { value: 1.2, color: '#34d399', probability: 0.12 },
      { value: 1.3, color: '#22d3ee', probability: 0.10 },
      { value: 1.5, color: '#a78bfa', probability: 0.06 },
      { value: 1.8, color: '#c084fc', probability: 0.04 },
      { value: 2, color: '#fbbf24', probability: 0.03 },
      { value: 3, color: '#fb923c', probability: 0.015 },
      { value: 5, color: '#f87171', probability: 0.005 },
    ],
    medium: [
      { value: 0, color: '#27272a', probability: 0.10 },
      { value: 1.05, color: '#3f3f46', probability: 0.12 },
      { value: 1.1, color: '#52525b', probability: 0.14 },
      { value: 1.2, color: '#71717a', probability: 0.14 },
      { value: 1.3, color: '#a1a1aa', probability: 0.12 },
      { value: 1.5, color: '#34d399', probability: 0.10 },
      { value: 1.8, color: '#22d3ee', probability: 0.08 },
      { value: 2, color: '#a78bfa', probability: 0.06 },
      { value: 2.5, color: '#c084fc', probability: 0.05 },
      { value: 3, color: '#fbbf24', probability: 0.04 },
      { value: 5, color: '#fb923c', probability: 0.03 },
      { value: 15, color: '#f87171', probability: 0.02 },
    ],
    high: [
      { value: 0, color: '#27272a', probability: 0.22 },
      { value: 1.2, color: '#3f3f46', probability: 0.12 },
      { value: 1.5, color: '#52525b', probability: 0.12 },
      { value: 2, color: '#71717a', probability: 0.12 },
      { value: 2.5, color: '#a1a1aa', probability: 0.10 },
      { value: 3, color: '#34d399', probability: 0.08 },
      { value: 4, color: '#22d3ee', probability: 0.08 },
      { value: 6, color: '#a78bfa', probability: 0.06 },
      { value: 10, color: '#c084fc', probability: 0.04 },
      { value: 20, color: '#fbbf24', probability: 0.03 },
      { value: 40, color: '#fb923c', probability: 0.02 },
      { value: 100, color: '#f87171', probability: 0.01 },
    ],
  },
  50: {
    low: [
      { value: 0, color: '#27272a', probability: 0.02 },
      { value: 1.01, color: '#3f3f46', probability: 0.10 },
      { value: 1.02, color: '#52525b', probability: 0.12 },
      { value: 1.05, color: '#71717a', probability: 0.15 },
      { value: 1.1, color: '#a1a1aa', probability: 0.18 },
      { value: 1.15, color: '#34d399', probability: 0.15 },
      { value: 1.2, color: '#22d3ee', probability: 0.10 },
      { value: 1.3, color: '#a78bfa', probability: 0.06 },
      { value: 1.5, color: '#c084fc', probability: 0.05 },
      { value: 1.8, color: '#fbbf24', probability: 0.04 },
      { value: 2, color: '#fb923c', probability: 0.02 },
      { value: 3, color: '#f87171', probability: 0.01 },
    ],
    medium: [
      { value: 0, color: '#27272a', probability: 0.08 },
      { value: 1.02, color: '#3f3f46', probability: 0.10 },
      { value: 1.05, color: '#52525b', probability: 0.12 },
      { value: 1.1, color: '#71717a', probability: 0.14 },
      { value: 1.2, color: '#a1a1aa', probability: 0.14 },
      { value: 1.3, color: '#34d399', probability: 0.12 },
      { value: 1.5, color: '#22d3ee', probability: 0.10 },
      { value: 1.8, color: '#a78bfa', probability: 0.06 },
      { value: 2, color: '#c084fc', probability: 0.05 },
      { value: 2.5, color: '#fbbf24', probability: 0.04 },
      { value: 4, color: '#fb923c', probability: 0.03 },
      { value: 10, color: '#f87171', probability: 0.02 },
    ],
    high: [
      { value: 0, color: '#27272a', probability: 0.20 },
      { value: 1.1, color: '#3f3f46', probability: 0.10 },
      { value: 1.3, color: '#52525b', probability: 0.12 },
      { value: 1.5, color: '#71717a', probability: 0.12 },
      { value: 2, color: '#a1a1aa', probability: 0.12 },
      { value: 2.5, color: '#34d399', probability: 0.10 },
      { value: 3, color: '#22d3ee', probability: 0.08 },
      { value: 5, color: '#a78bfa', probability: 0.06 },
      { value: 8, color: '#c084fc', probability: 0.04 },
      { value: 15, color: '#fbbf24', probability: 0.03 },
      { value: 30, color: '#fb923c', probability: 0.02 },
      { value: 100, color: '#f87171', probability: 0.01 },
    ],
  },
}

export default function WheelPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {
    initialized,
    serverSeedHash,
    clientSeed,
    nonce,
    previousServerSeed,
    generateBet,
    rotateSeed,
    setClientSeed,
  } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing, fetchBalances, balances, balancesLoaded } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [wheelSegments, setWheelSegments] = useState(10)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium')
  const [demoBalance, setDemoBalance] = useState(1000.00)
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<WheelSegment | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showFairness, setShowFairness] = useState(false)

  const segments = WHEEL_CONFIGS[wheelSegments]?.[riskLevel] || WHEEL_CONFIGS[10].medium

  // Fetch real balances when authenticated
  useEffect(() => {
    if (isAuthenticated) fetchBalances()
  }, [isAuthenticated, fetchBalances])

  // Derive display balance
  const displayBalance = isAuthenticated
    ? (balances['btc']?.available ?? 0)
    : demoBalance

  // Draw wheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 20

    ctx.clearRect(0, 0, width, height)

    // Save state for rotation
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-centerX, -centerY)

    // Draw outer glow
    const gradient = ctx.createRadialGradient(centerX, centerY, radius - 10, centerX, centerY, radius + 30)
    gradient.addColorStop(0, 'rgba(0, 232, 123, 0.2)')
    gradient.addColorStop(1, 'rgba(0, 232, 123, 0)')
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius + 30, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw segments
    const segmentAngle = (2 * Math.PI) / segments.length
    
    segments.forEach((segment, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2
      const endAngle = startAngle + segmentAngle

      // Draw segment
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = segment.color
      ctx.fill()
      ctx.strokeStyle = '#0A0B0F'
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw text
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(startAngle + segmentAngle / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = segment.value >= 5 ? '#000' : '#fff'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(`${segment.value}x`, radius - 15, 4)
      ctx.restore()
    })

    // Draw center circle with gradient
    const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 35)
    centerGradient.addColorStop(0, '#12141A')
    centerGradient.addColorStop(1, '#0A0B0F')
    ctx.beginPath()
    ctx.arc(centerX, centerY, 35, 0, Math.PI * 2)
    ctx.fillStyle = centerGradient
    ctx.fill()
    ctx.strokeStyle = '#00E87B'
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw inner logo/icon
    ctx.fillStyle = '#00E87B'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('◎', centerX, centerY)

    ctx.restore()

    // Draw pointer (fixed, not rotating)
    ctx.beginPath()
    ctx.moveTo(centerX + radius + 15, centerY)
    ctx.lineTo(centerX + radius - 15, centerY - 18)
    ctx.lineTo(centerX + radius - 15, centerY + 18)
    ctx.closePath()
    
    const pointerGradient = ctx.createLinearGradient(centerX + radius - 15, centerY, centerX + radius + 15, centerY)
    pointerGradient.addColorStop(0, '#00E87B')
    pointerGradient.addColorStop(1, '#00C466')
    ctx.fillStyle = pointerGradient
    ctx.fill()
    
    // Pointer glow
    ctx.shadowColor = '#00E87B'
    ctx.shadowBlur = 15
    ctx.fill()
    ctx.shadowBlur = 0

  }, [rotation, segments])

  // Spin the wheel
  const handleSpin = async () => {
    if (isSpinning || isPlacing) return
    if (!initialized) {
      toast.error('Initializing provably fair system...')
      return
    }

    const bet = parseFloat(betAmount)
    if (bet <= 0 || bet > displayBalance) {
      toast.error('Invalid bet amount')
      return
    }

    setIsSpinning(true)
    setShowResult(false)
    if (!isAuthenticated) setDemoBalance(prev => prev - bet)

    let resultSegment: WheelSegment
    let resultIdx: number

    try {
      if (isAuthenticated) {
        const data = await placeBet('wheel', betAmount, 'usdt', {})
        resultIdx = data.result_data?.segment_index ?? 0
        // Map backend segment to local segment — use the multiplier from result_data if available
        resultSegment = segments[resultIdx % segments.length]
      } else {
        const { result: ri } = await generateBet('wheel', { segments: segments.length })
        resultIdx = (ri as number) % segments.length
        resultSegment = segments[resultIdx]
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error placing bet')
      if (!isAuthenticated) setDemoBalance(prev => prev + bet)
      setIsSpinning(false)
      return
    }

    // Calculate final rotation
    const segmentAngle = 360 / segments.length
    const targetAngle = 360 - (resultIdx * segmentAngle + segmentAngle / 2)
    const spins = 5 + Math.floor(Math.random() * 3) // 5-7 full spins
    const finalRotation = spins * 360 + targetAngle

    // Animate spin
    const duration = 5000 // 5 seconds
    const startTime = Date.now()
    const startRotation = rotation

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      
      const currentRotation = startRotation + (finalRotation * eased)
      setRotation(currentRotation % 360)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        // Spin complete
        setResult(resultSegment)
        setShowResult(true)
        setIsSpinning(false)

        const payout = bet * resultSegment.value
        if (resultSegment.value > 0) {
          if (!isAuthenticated) setDemoBalance(prev => prev + payout)
          sessionStats.recordBet(true, bet, payout - bet, resultSegment.value)
          toast.success(`${resultSegment.value}x! Won $${payout.toFixed(2)}`)
        } else {
          sessionStats.recordBet(false, bet, -bet, 0)
          toast.error(`0x - Lost $${bet.toFixed(2)}`)
        }
      }
    }

    requestAnimationFrame(animate)
  }

  return (
    <GameLayout>
      <div className="p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <SessionStatsBar />

          {/* Game Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Wheel</h1>
                <p className="text-sm text-muted">Spin to win up to 100x</p>
              </div>
            </div>
            <button
              onClick={() => setShowFairness(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface/50 border border-border rounded-xl text-text-secondary hover:text-text-primary hover:border-brand/50 transition-all duration-200"
            >
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">Fairness</span>
            </button>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Bet Controls */}
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={isSpinning}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              actionButton={
                <motion.button
                  onClick={handleSpin}
                  disabled={isSpinning}
                  whileHover={{ scale: isSpinning ? 1 : 1.02 }}
                  whileTap={{ scale: isSpinning ? 1 : 0.98 }}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 ${
                    isSpinning
                      ? 'bg-surface-light text-text-muted cursor-not-allowed'
                      : 'bg-brand text-background-deep shadow-glow-brand-sm hover:brightness-110'
                  }`}
                >
                  {isSpinning ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Spinning...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Spin Wheel
                    </span>
                  )}
                </motion.button>
              }
            >
              {/* Segments */}
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
                  Segments
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[10, 20, 30, 40, 50].map((count) => (
                    <button
                      key={count}
                      onClick={() => setWheelSegments(count)}
                      disabled={isSpinning}
                      className={`py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                        wheelSegments === count
                          ? 'bg-brand text-background-deep shadow-glow-brand-sm'
                          : 'bg-surface border border-border text-muted-light hover:text-white hover:border-brand/40'
                      } disabled:opacity-50`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk Level */}
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-brand" />
                  Risk Level
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['low', 'medium', 'high'] as RiskLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setRiskLevel(level)}
                      disabled={isSpinning}
                      className={`py-2 rounded-lg font-semibold text-sm capitalize transition-all duration-200 ${
                        riskLevel === level
                          ? level === 'low'
                            ? 'bg-accent-green/20 border border-emerald-500/50 text-accent-green'
                            : level === 'medium'
                              ? 'bg-amber-500/20 border border-amber-500/50 text-accent-amber'
                              : 'bg-accent-red/20 border border-red-500/50 text-accent-red'
                          : 'bg-surface-light/50 border border-border-light text-text-secondary hover:bg-surface-lighter/50 hover:text-text-primary'
                      } disabled:opacity-50`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multipliers Preview */}
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-brand" />
                  Possible Wins
                </label>
                <div className="bg-surface-light/30 rounded-xl p-2 max-h-40 overflow-y-auto border border-border-light/50 custom-scrollbar">
                  {segments.map((seg, i) => (
                    <div key={i} className="flex justify-between items-center py-1 px-1 border-b border-border-light/20 last:border-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className={`font-mono tabular-nums text-xs ${
                          seg.value >= 10 ? 'text-accent-amber' :
                          seg.value >= 5 ? 'text-brand' :
                          seg.value > 0 ? 'text-text-primary' : 'text-text-muted'
                        }`}>
                          {seg.value}x
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted font-mono">
                        {(seg.probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Result */}
              <AnimatePresence>
                {showResult && result && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className={`p-3 rounded-xl text-center ${
                      result.value > 0
                        ? 'bg-accent-green/10 border border-emerald-500/30'
                        : 'bg-accent-red/10 border border-red-500/30'
                    }`}
                  >
                    <div className={`text-2xl font-bold font-mono ${
                      result.value >= 10 ? 'text-accent-amber' :
                      result.value > 0 ? 'text-accent-green' : 'text-accent-red'
                    }`}>
                      {result.value}x
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      {result.value > 0
                        ? <span className="text-accent-green">+${(parseFloat(betAmount) * result.value).toFixed(2)}</span>
                        : 'Better luck next time!'
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* Right: Game Area */}
            <div className="flex-1 min-w-0 space-y-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-surface/50 rounded-2xl p-6 border border-border"
              >
                <div className="flex justify-center relative">
                  {isSpinning && (
                    <motion.div
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-0 bg-gradient-radial from-brand/20 to-transparent rounded-full"
                    />
                  )}
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={400}
                    className="rounded-full max-w-full"
                  />
                </div>

                {/* Result Display */}
                <AnimatePresence>
                  {showResult && result && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`mt-6 p-6 rounded-2xl text-center backdrop-blur-sm ${
                        result.value > 0
                          ? 'bg-accent-green/10 border border-emerald-500/30'
                          : 'bg-accent-red/10 border border-red-500/30'
                      }`}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                        className={`text-6xl font-bold font-mono tabular-nums ${
                          result.value >= 10 ? 'text-accent-amber' :
                          result.value > 0 ? 'text-accent-green' : 'text-accent-red'
                        }`}
                      >
                        {result.value}x
                      </motion.div>
                      <div className="text-lg text-text-secondary mt-3 font-mono">
                        {result.value > 0
                          ? <span className="text-accent-green">+${(parseFloat(betAmount) * result.value).toFixed(2)}</span>
                          : 'Better luck next time!'
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <LiveBetsTable game="wheel" />
            </div>
          </div>

          <FairnessModal
            isOpen={showFairness}
            onClose={() => setShowFairness(false)}
            game="wheel"
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

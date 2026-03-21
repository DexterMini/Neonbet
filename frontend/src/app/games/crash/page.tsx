'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { TrendingUp, Users, Clock, Zap, Rocket } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { useRouter } from 'next/navigation'

interface GameRound {
  roundId: string
  status: 'waiting' | 'starting' | 'running' | 'crashed'
  multiplier: number
  crashPoint?: number
  hash?: string
  serverSeed?: string
}

interface CrashPlayer {
  username: string
  bet_amount: string
  cashed_out: boolean
  cashout_multiplier?: string
}

/* ── Floating particles ───────────────────────────── */
const PARTICLE_COLORS = ['#00E87B', '#34d399', '#6ee7b7', '#a7f3d0', '#059669', '#10b981']
function FloatingRockets({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {PARTICLE_COLORS.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${8 + i * 15}%`, rotate: 0 }}
          animate={{ opacity: [0, 0.35, 0], y: '-10%', x: `${8 + i * 15 + (Math.random() - 0.5) * 12}%`, rotate: [0, 90, 180] }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.9, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

export default function CrashPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const { serverSeedHash, clientSeed, nonce, previousServerSeed, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated, isHydrated, token } = useAuthStore()
  const { fetchBalances } = useGameStore()
  const sessionStats = useSessionStats()
  const router = useRouter()

  const [betAmount, setBetAmount] = useState('10.00')
  const [autoCashout, setAutoCashout] = useState(2.0)
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(true)
  const [showFairness, setShowFairness] = useState(false)
  const [connected, setConnected] = useState(false)

  const [gameRound, setGameRound] = useState<GameRound>({ roundId: '', status: 'waiting', multiplier: 1.0 })
  const [hasBet, setHasBet] = useState(false)
  const [hasCashedOut, setHasCashedOut] = useState(false)
  const [myBet, setMyBet] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [players, setPlayers] = useState<CrashPlayer[]>([])

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  // WebSocket connection
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws/crash?token=${encodeURIComponent(token)}`

    let ws: WebSocket
    let reconnectTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'connected':
            if (data.history) {
              setHistory(data.history.map((h: any) => parseFloat(h.crash_point)))
            }
            if (data.state) {
              setGameRound(prev => ({
                ...prev,
                status: data.state.state || 'waiting',
                roundId: data.state.round_id || '',
                multiplier: parseFloat(data.state.multiplier || '1.00'),
                hash: data.state.hash,
              }))
              if (data.state.players) setPlayers(data.state.players)
            }
            break

          case 'round_start':
            setGameRound({ roundId: data.round_id, status: 'waiting', multiplier: 1.0, hash: data.hash })
            setHasBet(false)
            setHasCashedOut(false)
            setMyBet(null)
            setPlayers([])
            setCountdown(null)
            break

          case 'countdown':
            setCountdown(data.countdown)
            setGameRound(prev => ({ ...prev, status: 'starting' }))
            break

          case 'game_running':
            setGameRound(prev => ({ ...prev, status: 'running' }))
            setCountdown(null)
            break

          case 'multiplier':
            setGameRound(prev => ({ ...prev, multiplier: parseFloat(data.multiplier), status: 'running' }))
            break

          case 'crashed':
            setGameRound(prev => ({
              ...prev,
              status: 'crashed',
              multiplier: parseFloat(data.crash_point),
              crashPoint: parseFloat(data.crash_point),
              serverSeed: data.server_seed,
            }))
            setHistory(prev => [parseFloat(data.crash_point), ...prev.slice(0, 19)])
            if (hasBet && !hasCashedOut && myBet) {
              toast.error(`Crashed at ${parseFloat(data.crash_point).toFixed(2)}x! You lost $${myBet.toFixed(2)}`)
              sessionStats.recordBet(false, myBet, -myBet, 0)
            }
            fetchBalances()
            break

          case 'new_bet':
            setPlayers(prev => [...prev, { username: data.username, bet_amount: data.bet_amount, cashed_out: false }])
            break

          case 'cashout':
            setPlayers(prev => prev.map(p =>
              p.username === data.username ? { ...p, cashed_out: true, cashout_multiplier: data.multiplier } : p
            ))
            break

          case 'bet_result':
            if (!data.success) {
              toast.error(data.error || 'Bet failed')
              setHasBet(false)
              setMyBet(null)
            }
            break

          case 'cashout_result':
            if (data.success) {
              setHasCashedOut(true)
              const mult = parseFloat(data.multiplier)
              const profit = parseFloat(data.profit)
              sessionStats.recordBet(true, myBet!, profit, mult)
              toast.success(`Cashed out at ${mult.toFixed(2)}x! Won $${parseFloat(data.payout).toFixed(2)}`)
              fetchBalances()
            }
            break
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      if (ws && ws.readyState <= 1) ws.close()
    }
  }, [isHydrated, isAuthenticated, token])

  // Draw crash graph
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let i = 0; i < 10; i++) { const y = (height / 10) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }
    for (let i = 0; i < 10; i++) { const x = (width / 10) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }

    if (gameRound.status === 'running' || gameRound.status === 'crashed') {
      const multiplier = gameRound.multiplier
      const maxMultiplier = Math.max(multiplier * 1.2, 2)
      const gradient = ctx.createLinearGradient(0, height, width, 0)
      if (gameRound.status === 'crashed') { gradient.addColorStop(0, '#FF4757'); gradient.addColorStop(1, '#ff6b81') }
      else { gradient.addColorStop(0, '#00C968'); gradient.addColorStop(1, '#00E87B') }

      ctx.shadowColor = gameRound.status === 'crashed' ? '#FF4757' : '#00E87B'
      ctx.shadowBlur = 25
      ctx.beginPath(); ctx.strokeStyle = gradient; ctx.lineWidth = 3
      const points = 100
      for (let i = 0; i <= points; i++) {
        const x = (width / points) * i
        const t = (i / points) * Math.log(multiplier)
        const y = height - (height * (Math.exp(t) - 1)) / (maxMultiplier - 1)
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()

      const lastX = width
      const lastY = height - (height * (multiplier - 1)) / (maxMultiplier - 1)
      ctx.lineTo(lastX, height); ctx.lineTo(0, height); ctx.closePath()
      const fillGrad = ctx.createLinearGradient(0, 0, 0, height)
      if (gameRound.status === 'crashed') { fillGrad.addColorStop(0, 'rgba(255,71,87,0.18)'); fillGrad.addColorStop(1, 'rgba(255,71,87,0)') }
      else { fillGrad.addColorStop(0, 'rgba(0,232,123,0.15)'); fillGrad.addColorStop(1, 'rgba(0,232,123,0)') }
      ctx.fillStyle = fillGrad; ctx.fill(); ctx.shadowBlur = 0

      ctx.shadowColor = gameRound.status === 'crashed' ? '#FF4757' : '#00E87B'
      ctx.shadowBlur = 30
      ctx.beginPath(); ctx.arc(lastX, lastY, 8, 0, Math.PI * 2)
      ctx.fillStyle = gameRound.status === 'crashed' ? '#FF4757' : '#00E87B'; ctx.fill(); ctx.shadowBlur = 0
    }
  }, [gameRound.multiplier, gameRound.status])

  const handleBet = useCallback(() => {
    if (gameRound.status !== 'waiting') { toast.error('Wait for next round'); return }
    const bet = parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet)) { toast.error('Invalid bet amount'); return }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { toast.error('Not connected to server'); return }

    wsRef.current.send(JSON.stringify({
      type: 'bet',
      amount: bet.toString(),
      auto_cashout: autoCashoutEnabled ? autoCashout.toString() : undefined,
    }))
    setHasBet(true)
    setMyBet(bet)
    toast.success(`Bet placed: $${bet.toFixed(2)}`)
  }, [gameRound.status, betAmount, autoCashout, autoCashoutEnabled])

  const handleCashout = useCallback(() => {
    if (!hasBet || hasCashedOut || gameRound.status !== 'running') return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({ type: 'cashout' }))
  }, [hasBet, hasCashedOut, gameRound.status])

  const getMultiplierColor = (mult: number) => { if (mult >= 10) return 'text-amber-400'; if (mult >= 2) return 'text-brand'; return 'text-accent-red' }
  const potentialProfit = parseFloat(betAmount) * autoCashout - parseFloat(betAmount)

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto">
          <SessionStatsBar />

          {/* History Bar */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-thin pb-1">
            <div className="flex items-center gap-1.5 text-muted shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">History</span>
            </div>
            {history.map((mult, i) => (
              <motion.span key={i} initial={i === 0 ? { scale: 0, opacity: 0 } : {}} animate={{ scale: 1, opacity: 1 }}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-mono font-bold tabular-nums ${getMultiplierColor(mult)} bg-white/[0.04] ring-1 ring-white/[0.06] whitespace-nowrap`}>
                {mult.toFixed(2)}×
              </motion.span>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: Betting Controls */}
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={hasBet}
              serverSeedHash={gameRound.hash || serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              showAutoTab={false}
              actionButton={
                !hasBet ? (
                  <motion.button onClick={handleBet} disabled={gameRound.status !== 'waiting' || !connected}
                    whileHover={{ scale: gameRound.status === 'waiting' && connected ? 1.02 : 1 }}
                    whileTap={{ scale: gameRound.status === 'waiting' && connected ? 0.98 : 1 }}
                    className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all ${
                      gameRound.status !== 'waiting' || !connected ? 'bg-surface cursor-not-allowed text-muted'
                        : 'bg-gradient-to-r from-brand to-emerald-400 text-background-deep shadow-lg shadow-brand/30 hover:brightness-110'
                    }`}>
                    <span className="flex items-center justify-center gap-2"><Rocket className="w-4 h-4" />{!connected ? 'Connecting...' : gameRound.status === 'waiting' ? 'Place Bet' : 'Wait for next round...'}</span>
                  </motion.button>
                ) : !hasCashedOut && gameRound.status === 'running' ? (
                  <motion.button onClick={handleCashout}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    animate={{ boxShadow: ['0 0 20px rgba(0,232,123,0.3)', '0 0 40px rgba(0,232,123,0.5)', '0 0 20px rgba(0,232,123,0.3)'] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-full py-3.5 rounded-xl font-bold text-[14px] bg-gradient-to-r from-brand to-emerald-400 text-background-deep">
                    <span className="flex items-center justify-center gap-2"><Zap className="w-4 h-4" />CASH OUT @ {gameRound.multiplier.toFixed(2)}×</span>
                  </motion.button>
                ) : (
                  <button disabled className="w-full py-3.5 rounded-xl font-bold text-[14px] bg-surface text-muted cursor-not-allowed">
                    {hasCashedOut ? 'Cashed Out' : 'Round Over'}
                  </button>
                )
              }
            >
              {/* Auto Cashout */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Auto Cashout</span>
                  <button onClick={() => setAutoCashoutEnabled(!autoCashoutEnabled)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${autoCashoutEnabled ? 'bg-brand' : 'bg-surface-lighter'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${autoCashoutEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="relative">
                  <input type="number" value={autoCashout} onChange={(e) => setAutoCashout(parseFloat(e.target.value))} disabled={!autoCashoutEnabled}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 font-mono tabular-nums text-[13px] text-white focus:outline-none focus:border-brand/40 transition-all disabled:opacity-40" min={1.01} step={0.01} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">×</span>
                </div>
              </div>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Profit</div>
                  <div className="text-sm font-mono tabular-nums font-bold text-brand">+${potentialProfit.toFixed(2)}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Return</div>
                  <div className="text-sm font-mono tabular-nums font-bold text-white">${(parseFloat(betAmount) * autoCashout).toFixed(2)}</div>
                </div>
              </div>
              {/* Current value during bet */}
              {hasBet && myBet && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-surface rounded-xl p-3 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Current Value</div>
                  <div className={`text-xl font-mono tabular-nums font-bold ${gameRound.status === 'crashed' && !hasCashedOut ? 'text-accent-red' : 'text-brand'}`}>
                    {hasCashedOut || gameRound.status === 'crashed'
                      ? (hasCashedOut ? '+$' : '-$') + (myBet * (hasCashedOut ? gameRound.multiplier - 1 : 1)).toFixed(2)
                      : '+$' + (myBet * (gameRound.multiplier - 1)).toFixed(2)}
                  </div>
                </motion.div>
              )}
            </BetControls>

            {/* Right: Game Canvas — Premium Scene */}
            <div className="flex-1 min-w-0">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #0f1a12 0%, #0a1210 40%, #0d0f1a 100%)' }}>
                <FloatingRockets active />

                {/* ambient crash glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
                  style={{ background: gameRound.status === 'crashed' ? 'radial-gradient(circle, rgba(255,71,87,0.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(0,232,123,0.06) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-brand/20"
                      style={{ background: 'linear-gradient(135deg, rgba(0,232,123,0.2) 0%, rgba(0,232,123,0.06) 100%)' }}>
                      <Rocket className="w-4 h-4 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Crash</h2>
                      <p className="text-brand/30 text-[10px] mt-0.5">Watch it fly</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-[11px] font-bold ring-1 ${
                      gameRound.status === 'crashed' ? 'bg-accent-red/10 text-accent-red ring-accent-red/20'
                        : gameRound.status === 'running' ? 'bg-brand/10 text-brand ring-brand/20'
                        : 'bg-white/[0.04] text-muted ring-white/[0.06]'
                    }`}>
                      {gameRound.status === 'crashed' ? 'Crashed' : gameRound.status === 'running' ? 'Live' : 'Waiting'}
                    </div>
                    <GameSettingsDropdown />
                  </div>
                </div>

                <div className="relative aspect-[16/9]">
                  <canvas ref={canvasRef} width={800} height={450} className="w-full h-full relative z-[1]" />

                  {/* Multiplier Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center z-[2]">
                    <AnimatePresence mode="wait">
                      {countdown !== null ? (
                        <motion.div key="countdown" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="text-center">
                          <div className="text-sm text-white/30 mb-2 font-medium uppercase tracking-[0.2em]">Starting in</div>
                          <motion.div key={countdown} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="text-7xl sm:text-8xl font-black font-mono tabular-nums text-white"
                            style={{ textShadow: '0 0 50px rgba(0,232,123,0.4), 0 0 100px rgba(0,232,123,0.15)' }}>
                            {countdown}
                          </motion.div>
                        </motion.div>
                      ) : gameRound.status === 'crashed' ? (
                        <motion.div key="crashed" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                            className="text-sm text-accent-red mb-2 font-bold uppercase tracking-[0.25em]">CRASHED</motion.div>
                          <div className="text-7xl sm:text-8xl font-black font-mono tabular-nums text-accent-red"
                            style={{ textShadow: '0 0 60px rgba(255,71,87,0.6), 0 0 120px rgba(255,71,87,0.2)' }}>
                            {gameRound.multiplier.toFixed(2)}×
                          </div>
                        </motion.div>
                      ) : gameRound.status === 'running' ? (
                        <motion.div key="running" className="text-center">
                          <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ repeat: Infinity, duration: 0.3 }}
                            className="text-7xl sm:text-8xl font-black font-mono tabular-nums text-brand"
                            style={{ textShadow: '0 0 60px rgba(0,232,123,0.6), 0 0 120px rgba(0,232,123,0.2)' }}>
                            {gameRound.multiplier.toFixed(2)}×
                          </motion.div>
                        </motion.div>
                      ) : (
                        <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                          <div className="text-5xl font-bold text-white/20 mb-2 font-mono">1.00×</div>
                          <p className="text-white/20 text-[12px]">Waiting for next round...</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Players bar */}
                <div className="relative z-10 px-4 py-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-white/20" />
                    <span className="text-[11px] text-white/30 font-medium">Players</span>
                    <div className="flex-1 flex gap-1.5 overflow-x-auto">
                      {players.length > 0 ? players.map((p, i) => (
                        <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold ring-1 ${
                            p.cashed_out ? 'bg-brand/10 text-brand ring-brand/20'
                              : gameRound.status === 'crashed' ? 'bg-accent-red/10 text-accent-red ring-accent-red/20'
                              : 'bg-white/[0.04] text-white ring-white/[0.06]'
                          }`}>
                          {p.username}: ${parseFloat(p.bet_amount).toFixed(2)}{p.cashed_out && p.cashout_multiplier && ` @ ${parseFloat(p.cashout_multiplier).toFixed(2)}×`}
                        </motion.div>
                      )) : (
                        <span className="text-[11px] text-white/20">Place a bet to join</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <LiveBetsTable game="crash" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="crash"
            serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
            previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

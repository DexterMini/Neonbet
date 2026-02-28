'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { Shield, Sparkles, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Gem, Skull } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'
import { toast } from 'sonner'

/* ── Grid config ──────────────────────────────────── */
const GRID_ROWS = 15
const GRID_COLS = 15
const CELL_SIZE = 28
const TICK_MS = 150

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Pos = { r: number; c: number }

const DIR_DELTA: Record<Dir, Pos> = {
  UP: { r: -1, c: 0 },
  DOWN: { r: 1, c: 0 },
  LEFT: { r: 0, c: -1 },
  RIGHT: { r: 0, c: 1 },
}

const OPPOSITE: Record<Dir, Dir> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
}

const MULTIPLIER_TABLE = [
  0, 0, 0, 1.05, 1.15, 1.3, 1.5, 1.8, 2.2, 2.8, 3.5,
  4.5, 6, 8, 11, 15, 20, 28, 40, 55, 75, 100,
]

const getSnakeMultiplier = (gems: number): number => {
  if (gems >= MULTIPLIER_TABLE.length) return MULTIPLIER_TABLE[MULTIPLIER_TABLE.length - 1] * (1 + (gems - MULTIPLIER_TABLE.length + 1) * 0.5)
  return MULTIPLIER_TABLE[gems]
}

/* ── Random gem placement (seeded from provably fair) ── */
const placeGem = (snake: Pos[], currentGem: Pos | null): Pos => {
  const occupied = new Set(snake.map(s => `${s.r},${s.c}`))
  if (currentGem) occupied.add(`${currentGem.r},${currentGem.c}`)
  let pos: Pos
  do {
    pos = { r: Math.floor(Math.random() * GRID_ROWS), c: Math.floor(Math.random() * GRID_COLS) }
  } while (occupied.has(`${pos.r},${pos.c}`))
  return pos
}

export default function SnakePage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [showFairness, setShowFairness] = useState(false)

  const [gameActive, setGameActive] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [cashedOut, setCashedOut] = useState(false)
  const [score, setScore] = useState(0)
  const [snake, setSnake] = useState<Pos[]>([{ r: 7, c: 7 }])
  const [dir, setDir] = useState<Dir>('RIGHT')
  const [gem, setGem] = useState<Pos>({ r: 3, c: 10 })
  const [history, setHistory] = useState<number[]>([])

  const dirRef = useRef<Dir>('RIGHT')
  const snakeRef = useRef<Pos[]>([{ r: 7, c: 7 }])
  const gemRef = useRef<Pos>({ r: 3, c: 10 })
  const scoreRef = useRef(0)
  const gameActiveRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const currentMult = getSnakeMultiplier(score)
  const profit = parseFloat(betAmount) * currentMult - parseFloat(betAmount)

  /* ── Drawing ───────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = GRID_COLS * CELL_SIZE
    const h = GRID_ROWS * CELL_SIZE

    // Background
    ctx.fillStyle = '#0A0B0F'
    ctx.fillRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = '#1A1D28'
    ctx.lineWidth = 0.5
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * CELL_SIZE)
      ctx.lineTo(w, r * CELL_SIZE)
      ctx.stroke()
    }
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath()
      ctx.moveTo(c * CELL_SIZE, 0)
      ctx.lineTo(c * CELL_SIZE, h)
      ctx.stroke()
    }

    // Gem
    const g = gemRef.current
    const gx = g.c * CELL_SIZE + CELL_SIZE / 2
    const gy = g.r * CELL_SIZE + CELL_SIZE / 2
    ctx.shadowColor = '#00E87B'
    ctx.shadowBlur = 12
    ctx.fillStyle = '#00E87B'
    ctx.beginPath()
    // Diamond shape
    ctx.moveTo(gx, gy - CELL_SIZE * 0.4)
    ctx.lineTo(gx + CELL_SIZE * 0.35, gy)
    ctx.lineTo(gx, gy + CELL_SIZE * 0.4)
    ctx.lineTo(gx - CELL_SIZE * 0.35, gy)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    // Snake
    const s = snakeRef.current
    s.forEach((seg, i) => {
      const x = seg.c * CELL_SIZE
      const y = seg.r * CELL_SIZE
      const isHead = i === 0
      const pad = 1

      if (isHead) {
        ctx.shadowColor = '#00E87B'
        ctx.shadowBlur = 8
        ctx.fillStyle = '#00E87B'
      } else {
        ctx.shadowBlur = 0
        const alpha = 0.8 - (i / s.length) * 0.5
        ctx.fillStyle = `rgba(0, 232, 123, ${alpha})`
      }

      const radius = isHead ? 6 : 4
      const rx = x + pad
      const ry = y + pad
      const rw = CELL_SIZE - pad * 2
      const rh = CELL_SIZE - pad * 2

      ctx.beginPath()
      ctx.moveTo(rx + radius, ry)
      ctx.lineTo(rx + rw - radius, ry)
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius)
      ctx.lineTo(rx + rw, ry + rh - radius)
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh)
      ctx.lineTo(rx + radius, ry + rh)
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius)
      ctx.lineTo(rx, ry + radius)
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry)
      ctx.closePath()
      ctx.fill()

      // Eyes on head
      if (isHead) {
        ctx.fillStyle = '#0A0B0F'
        ctx.shadowBlur = 0
        const d = dirRef.current
        const ex1 = d === 'LEFT' || d === 'RIGHT' ? 0 : -4
        const ey1 = d === 'UP' || d === 'DOWN' ? 0 : -4
        const ex2 = d === 'LEFT' || d === 'RIGHT' ? 0 : 4
        const ey2 = d === 'UP' || d === 'DOWN' ? 0 : 4
        ctx.beginPath()
        ctx.arc(x + CELL_SIZE / 2 + ex1, y + CELL_SIZE / 2 + ey1, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x + CELL_SIZE / 2 + ex2, y + CELL_SIZE / 2 + ey2, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    ctx.shadowBlur = 0
  }, [])

  /* ── Game tick ──────────────────────────────────── */
  const tick = useCallback(() => {
    if (!gameActiveRef.current) return

    const s = [...snakeRef.current]
    const head = s[0]
    const d = DIR_DELTA[dirRef.current]
    const newHead: Pos = { r: head.r + d.r, c: head.c + d.c }

    // Wall collision
    if (newHead.r < 0 || newHead.r >= GRID_ROWS || newHead.c < 0 || newHead.c >= GRID_COLS) {
      gameActiveRef.current = false
      setGameActive(false)
      setGameOver(true)
      draw()
      sessionStats.recordBet(false, parseFloat(betAmount), -parseFloat(betAmount), 0)
      toast.error('Hit the wall! Game over.')
      return
    }

    // Self collision
    if (s.some(seg => seg.r === newHead.r && seg.c === newHead.c)) {
      gameActiveRef.current = false
      setGameActive(false)
      setGameOver(true)
      draw()
      sessionStats.recordBet(false, parseFloat(betAmount), -parseFloat(betAmount), 0)
      toast.error('Hit yourself! Game over.')
      return
    }

    s.unshift(newHead)

    // Gem pickup
    const g = gemRef.current
    if (newHead.r === g.r && newHead.c === g.c) {
      scoreRef.current += 1
      setScore(scoreRef.current)
      const newGem = placeGem(s, null)
      gemRef.current = newGem
      setGem(newGem)
    } else {
      s.pop()
    }

    snakeRef.current = s
    setSnake([...s])
    draw()
  }, [draw])

  /* ── Start / Stop ──────────────────────────────── */
  useEffect(() => {
    if (gameActive && !intervalRef.current) {
      intervalRef.current = setInterval(tick, TICK_MS)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [gameActive, tick])

  /* ── Keyboard ──────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!gameActiveRef.current) return
      const keyMap: Record<string, Dir> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
        W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT',
      }
      const newDir = keyMap[e.key]
      if (newDir && newDir !== OPPOSITE[dirRef.current]) {
        dirRef.current = newDir
        setDir(newDir)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ── Initial draw ──────────────────────────────── */
  useEffect(() => { draw() }, [draw])

  const startGame = async () => {
    if (parseFloat(betAmount) <= 0 || !initialized || isPlacing) return
    try {
      // Reset
      const startSnake: Pos[] = [{ r: 7, c: 7 }]
      const startGem = placeGem(startSnake, null)
      snakeRef.current = startSnake
      gemRef.current = startGem
      dirRef.current = 'RIGHT'
      scoreRef.current = 0
      gameActiveRef.current = true

      setSnake(startSnake)
      setGem(startGem)
      setDir('RIGHT')
      setScore(0)
      setGameOver(false)
      setCashedOut(false)
      setGameActive(true)
      draw()
    } catch (err: any) {
      toast.error(err?.message || 'Error starting game')
    }
  }

  const cashout = () => {
    if (!gameActive || score < 3) return
    gameActiveRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setCashedOut(true)
    setGameActive(false)
    const mult = getSnakeMultiplier(score)
    const winAmount = (parseFloat(betAmount) * mult).toFixed(2)
    setHistory(prev => [mult, ...prev.slice(0, 9)])
    sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * mult - parseFloat(betAmount), mult)
    toast.success(`Cashed out $${winAmount}!`)
  }

  const resetGame = () => {
    gameActiveRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const startSnake: Pos[] = [{ r: 7, c: 7 }]
    const startGem = placeGem(startSnake, null)
    snakeRef.current = startSnake
    gemRef.current = startGem
    dirRef.current = 'RIGHT'
    scoreRef.current = 0

    setSnake(startSnake)
    setGem(startGem)
    setDir('RIGHT')
    setScore(0)
    setGameActive(false)
    setGameOver(false)
    setCashedOut(false)
    draw()
  }

  const changeDir = (newDir: Dir) => {
    if (!gameActiveRef.current) return
    if (newDir !== OPPOSITE[dirRef.current]) {
      dirRef.current = newDir
      setDir(newDir)
    }
  }

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          <div className="flex flex-col lg:flex-row gap-4">

            {/* ── Left: Controls ───────────────────── */}
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={gameActive}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              showAutoTab={false}
              actionButton={
                !gameActive && !gameOver && !cashedOut ? (
                  <button onClick={startGame} disabled={parseFloat(betAmount) <= 0 || !initialized}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />Start Game
                  </button>
                ) : gameActive ? (
                  <button onClick={cashout} disabled={score < 3}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    {score < 3 ? `Collect ${3 - score} more gems` : `Cash Out $${(parseFloat(betAmount) * currentMult).toFixed(2)}`}
                  </button>
                ) : (
                  <button onClick={resetGame}
                    className={`w-full py-3.5 font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2
                      ${gameOver ? 'bg-accent-red text-white' : 'bg-brand text-background-deep shadow-glow-brand-sm'}`}>
                    <RotateCcw className="w-4 h-4" />Play Again
                  </button>
                )
              }
            >
              {/* Controls info */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">Controls</span>
                <div className="text-[11px] text-muted-light space-y-1">
                  <div className="flex items-center gap-2"><span className="text-brand font-mono">WASD</span> or Arrow keys to move</div>
                  <div className="flex items-center gap-2"><span className="text-brand">Collect 3+ gems</span> to cash out</div>
                </div>
              </div>

              {/* D-pad for mobile */}
              <div className="sm:hidden">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">Direction</span>
                <div className="grid grid-cols-3 gap-1.5 w-32 mx-auto">
                  <div />
                  <button onClick={() => changeDir('UP')} className="bg-surface border border-border rounded-lg p-2.5 flex items-center justify-center hover:border-brand/40 transition-colors">
                    <ArrowUp className="w-4 h-4 text-white" />
                  </button>
                  <div />
                  <button onClick={() => changeDir('LEFT')} className="bg-surface border border-border rounded-lg p-2.5 flex items-center justify-center hover:border-brand/40 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => changeDir('DOWN')} className="bg-surface border border-border rounded-lg p-2.5 flex items-center justify-center hover:border-brand/40 transition-colors">
                    <ArrowDown className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => changeDir('RIGHT')} className="bg-surface border border-border rounded-lg p-2.5 flex items-center justify-center hover:border-brand/40 transition-colors">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Gems</div>
                  <div className="text-base font-bold text-brand font-mono">{score}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Multiplier</div>
                  <div className="text-base font-bold text-accent-amber font-mono">{currentMult.toFixed(2)}x</div>
                </div>
              </div>

              {/* Active game payout */}
              <AnimatePresence>
                {gameActive && score >= 3 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="bg-brand/[0.06] rounded-xl p-3.5 border border-brand/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-muted uppercase mb-0.5">Current</div>
                        <div className="text-xl text-brand font-bold font-mono">{currentMult.toFixed(2)}x</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted uppercase mb-0.5">Payout</div>
                        <div className="text-xl text-brand font-bold font-mono">${(parseFloat(betAmount) * currentMult).toFixed(2)}</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Multiplier table */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Payout Table</span>
                <div className="bg-surface rounded-xl border border-border p-2 max-h-28 overflow-y-auto scrollbar-thin">
                  <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-[10px] font-mono">
                    {MULTIPLIER_TABLE.slice(3).map((m, i) => (
                      <div key={i} className={`flex justify-between px-1.5 py-0.5 rounded ${score === i + 3 ? 'bg-brand/15 text-brand' : 'text-muted'}`}>
                        <span>{i + 3}</span>
                        <span>{m}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </BetControls>

            {/* ── Right: Game Canvas ─────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="bg-background-secondary rounded-2xl border border-border/60 overflow-hidden p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-brand/20 flex items-center justify-center">
                      <span className="text-brand text-sm">🐍</span>
                    </div>
                    <span className="text-white font-bold text-lg">Snake</span>
                  </div>
                  {history.length > 0 && (
                    <div className="flex gap-1.5">
                      {history.slice(0, 6).map((h, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold
                          ${h >= 2 ? 'bg-brand/15 text-brand' : h >= 1 ? 'bg-accent-amber/15 text-accent-amber' : 'bg-accent-red/15 text-accent-red'}`}>
                          {h.toFixed(2)}x
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Canvas container */}
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      width={GRID_COLS * CELL_SIZE}
                      height={GRID_ROWS * CELL_SIZE}
                      className="rounded-xl border border-border/60"
                    />

                    {/* Overlay for game states */}
                    {!gameActive && !gameOver && !cashedOut && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <div className="text-center">
                          <div className="text-brand text-3xl mb-2">🐍</div>
                          <div className="text-white text-lg font-bold">Snake</div>
                          <div className="text-muted text-sm mt-1">Collect gems to win!</div>
                        </div>
                      </div>
                    )}

                    {gameOver && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl"
                      >
                        <div className="text-center">
                          <Skull className="w-10 h-10 text-accent-red mx-auto mb-2" />
                          <div className="text-accent-red text-2xl font-black font-mono">GAME OVER</div>
                          <div className="text-muted text-sm mt-1">
                            Collected {score} gems — Lost ${parseFloat(betAmount).toFixed(2)}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {cashedOut && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl"
                      >
                        <div className="text-center">
                          <Gem className="w-10 h-10 text-brand mx-auto mb-2" />
                          <div className="text-brand text-3xl font-black font-mono">{currentMult.toFixed(2)}x</div>
                          <div className="text-brand/70 text-sm mt-1">
                            Won ${(parseFloat(betAmount) * currentMult).toFixed(2)}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Mobile D-pad — visible only on small screens */}
                <div className="sm:hidden mt-4">
                  <div className="grid grid-cols-3 gap-2 w-40 mx-auto">
                    <div />
                    <button onTouchStart={() => changeDir('UP')} onClick={() => changeDir('UP')}
                      className="bg-surface border border-border rounded-lg p-3 flex items-center justify-center active:bg-brand/20 transition-colors">
                      <ArrowUp className="w-5 h-5 text-white" />
                    </button>
                    <div />
                    <button onTouchStart={() => changeDir('LEFT')} onClick={() => changeDir('LEFT')}
                      className="bg-surface border border-border rounded-lg p-3 flex items-center justify-center active:bg-brand/20 transition-colors">
                      <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <button onTouchStart={() => changeDir('DOWN')} onClick={() => changeDir('DOWN')}
                      className="bg-surface border border-border rounded-lg p-3 flex items-center justify-center active:bg-brand/20 transition-colors">
                      <ArrowDown className="w-5 h-5 text-white" />
                    </button>
                    <button onTouchStart={() => changeDir('RIGHT')} onClick={() => changeDir('RIGHT')}
                      className="bg-surface border border-border rounded-lg p-3 flex items-center justify-center active:bg-brand/20 transition-colors">
                      <ArrowRight className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              <LiveBetsTable game="snake" />
            </div>
          </div>
        </div>
      </div>

      <FairnessModal
        isOpen={showFairness}
        onClose={() => setShowFairness(false)}
        game="snake"
        serverSeedHash={serverSeedHash}
        clientSeed={clientSeed}
        nonce={nonce}
        previousServerSeed={previousServerSeed}
        onClientSeedChange={setClientSeed}
        onRotateSeed={rotateSeed}
      />
    </GameLayout>
  )
}

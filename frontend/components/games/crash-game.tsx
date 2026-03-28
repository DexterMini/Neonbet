"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCasinoStore, CELORA_GAMES } from "@/lib/store"
import { generateBetHash, calculateCrashPoint, generateSecureRandom } from "@/lib/provably-fair"
import { ArrowLeft, TrendingUp, Shield, Info, Users, History, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

type GameState = 'waiting' | 'running' | 'crashed' | 'cashed_out'

interface CrashBet {
  id: string
  username: string
  avatar: string
  betAmount: number
  cashoutMultiplier?: number
  profit?: number
  timestamp: Date
}

export function CrashGame() {
  const { 
    user, 
    gameSession, 
    setSelectedGame, 
    placeBet, 
    addWinnings, 
    updateWagered,
    incrementGameNonce,
    addBetToHistory
  } = useCasinoStore()
  
  const game = CELORA_GAMES.find(g => g.id === 'crash')!
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('waiting')
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00)
  const [crashPoint, setCrashPoint] = useState<number | null>(null)
  const [betAmount, setBetAmount] = useState("10.00")
  const [autoCashout, setAutoCashout] = useState("2.00")
  const [isAutoCashoutEnabled, setIsAutoCashoutEnabled] = useState(false)
  const [hasBet, setHasBet] = useState(false)
  const [hasCashedOut, setHasCashedOut] = useState(false)
  const [profit, setProfit] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [history, setHistory] = useState<number[]>([])
  const [liveBets, setLiveBets] = useState<CrashBet[]>([])
  const [currentBetHash, setCurrentBetHash] = useState<string>("")
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>(0)
  const graphPoints = useRef<{x: number, y: number}[]>([])
  
  // Generate crash point using provably fair algorithm
  const generateCrashPoint = useCallback(async () => {
    if (!gameSession) return 1.00
    
    const betHash = await generateBetHash(
      gameSession.serverSeed,
      gameSession.clientSeed,
      gameSession.nonce
    )
    
    setCurrentBetHash(betHash)
    return calculateCrashPoint(betHash, game.houseEdge / 100)
  }, [gameSession, game.houseEdge])
  
  // Start new round
  const startNewRound = useCallback(async () => {
    // Countdown phase
    setGameState('waiting')
    setCurrentMultiplier(1.00)
    setHasCashedOut(false)
    setProfit(0)
    graphPoints.current = []
    
    // Generate crash point
    const newCrashPoint = await generateCrashPoint()
    setCrashPoint(newCrashPoint)
    
    // Countdown
    for (let i = 5; i > 0; i--) {
      setCountdown(i)
      await new Promise(r => setTimeout(r, 1000))
    }
    setCountdown(0)
    
    // Start game
    setGameState('running')
    startTimeRef.current = Date.now()
    
    // Animation loop
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      // Exponential growth: 1.0 * e^(0.06t)
      const mult = Math.pow(Math.E, 0.06 * elapsed)
      const roundedMult = Math.floor(mult * 100) / 100
      
      setCurrentMultiplier(roundedMult)
      graphPoints.current.push({ x: elapsed, y: roundedMult })
      
      // Check auto cashout
      if (hasBet && !hasCashedOut && isAutoCashoutEnabled) {
        const targetMult = parseFloat(autoCashout)
        if (roundedMult >= targetMult && roundedMult < newCrashPoint) {
          handleCashout(roundedMult)
        }
      }
      
      // Check crash
      if (roundedMult >= newCrashPoint) {
        setGameState('crashed')
        setCurrentMultiplier(newCrashPoint)
        
        // Process losses for those who didn't cash out
        if (hasBet && !hasCashedOut) {
          setProfit(-parseFloat(betAmount))
        }
        
        // Add to history
        setHistory(prev => [newCrashPoint, ...prev].slice(0, 20))
        
        // Reset for next round
        setTimeout(() => {
          setHasBet(false)
          incrementGameNonce()
          startNewRound()
        }, 3000)
        
        return
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animationRef.current = requestAnimationFrame(animate)
  }, [generateCrashPoint, hasBet, hasCashedOut, isAutoCashoutEnabled, autoCashout, betAmount, incrementGameNonce])
  
  // Handle cashout
  const handleCashout = (mult?: number) => {
    if (!hasBet || hasCashedOut) return
    
    const cashoutMult = mult || currentMultiplier
    const betAmt = parseFloat(betAmount)
    const winnings = betAmt * cashoutMult
    const profitAmt = winnings - betAmt
    
    setHasCashedOut(true)
    setProfit(profitAmt)
    addWinnings(winnings)
    
    // Add to bet history
    addBetToHistory({
      id: generateSecureRandom(8),
      gameId: 'crash',
      gameName: 'Crash',
      betAmount: betAmt,
      multiplier: cashoutMult,
      profit: profitAmt,
      timestamp: new Date(),
      result: 'win',
      serverSeedHash: gameSession?.serverSeedHash || '',
      clientSeed: gameSession?.clientSeed || '',
      nonce: gameSession?.nonce || 0
    })
  }
  
  // Place bet
  const handlePlaceBet = () => {
    if (!user) return
    
    const amount = parseFloat(betAmount)
    if (isNaN(amount) || amount < game.minBet || amount > game.maxBet) return
    if (amount > user.balance) return
    if (gameState !== 'waiting') return
    
    if (placeBet(amount)) {
      setHasBet(true)
      updateWagered(amount)
    }
  }
  
  // Draw graph
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    
    // Clear
    ctx.fillStyle = '#0a0d12'
    ctx.fillRect(0, 0, rect.width, rect.height)
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1
    
    for (let i = 0; i < 10; i++) {
      const y = (rect.height / 10) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(rect.width, y)
      ctx.stroke()
    }
    
    for (let i = 0; i < 10; i++) {
      const x = (rect.width / 10) * i
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, rect.height)
      ctx.stroke()
    }
    
    // Draw curve
    if (graphPoints.current.length > 1) {
      const maxTime = Math.max(10, graphPoints.current[graphPoints.current.length - 1]?.x || 10)
      const maxMult = Math.max(2, currentMultiplier)
      
      const scaleX = (rect.width - 60) / maxTime
      const scaleY = (rect.height - 60) / (maxMult - 1)
      
      ctx.beginPath()
      ctx.strokeStyle = gameState === 'crashed' ? '#ef4444' : '#00ff9d'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      graphPoints.current.forEach((point, i) => {
        const x = 30 + point.x * scaleX
        const y = rect.height - 30 - (point.y - 1) * scaleY
        
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
      
      // Glow effect
      ctx.shadowColor = gameState === 'crashed' ? '#ef4444' : '#00ff9d'
      ctx.shadowBlur = 20
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }, [currentMultiplier, gameState])
  
  // Start game loop
  useEffect(() => {
    startNewRound()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])
  
  // Simulate live bets
  useEffect(() => {
    const names = ['CryptoKing', 'LuckyAce', 'DiamondHands', 'MoonShot', 'BetMaster']
    const interval = setInterval(() => {
      if (gameState === 'waiting') {
        const bet: CrashBet = {
          id: generateSecureRandom(8),
          username: names[Math.floor(Math.random() * names.length)],
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
          betAmount: Math.floor(Math.random() * 100) + 1,
          timestamp: new Date()
        }
        setLiveBets(prev => [bet, ...prev].slice(0, 10))
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [gameState])
  
  return (
    <div className="h-full flex flex-col bg-[#0a0d12]">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-white/5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedGame(null)}
          className="text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Crash</h1>
            <p className="text-xs text-white/40">Celora Originals</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-white/60 gap-2">
            <Shield className="w-4 h-4" />
            <span className="text-xs">Provably Fair</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-white/60 gap-2">
            <Info className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Main Game Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Graph */}
          <div className="flex-1 relative rounded-2xl bg-[#0d1117] border border-white/5 overflow-hidden">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full"
            />
            
            {/* Multiplier Display */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {gameState === 'waiting' && countdown > 0 && (
                <div className="text-center">
                  <div className="text-6xl font-bold text-white/40">{countdown}s</div>
                  <p className="text-white/40 mt-2">Starting soon...</p>
                </div>
              )}
              
              {gameState === 'running' && (
                <div className={cn(
                  "text-7xl font-bold tabular-nums",
                  currentMultiplier >= 2 ? "text-emerald-400" : "text-white"
                )}>
                  {currentMultiplier.toFixed(2)}x
                </div>
              )}
              
              {gameState === 'crashed' && (
                <div className="text-center">
                  <div className="text-6xl font-bold text-red-500">
                    {crashPoint?.toFixed(2)}x
                  </div>
                  <p className="text-red-400 mt-2 font-medium">CRASHED!</p>
                </div>
              )}
              
              {hasCashedOut && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-6 py-3">
                  <p className="text-emerald-400 font-bold text-xl">
                    +${profit.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
            
            {/* History Strip */}
            <div className="absolute top-4 left-4 right-4 flex gap-2 overflow-hidden">
              {history.slice(0, 10).map((point, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    point >= 2 
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  )}
                >
                  {point.toFixed(2)}x
                </div>
              ))}
            </div>
          </div>
          
          {/* Betting Controls */}
          <div className="bg-[#0d1117] rounded-2xl border border-white/5 p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Bet Amount */}
              <div className="space-y-2">
                <label className="text-sm text-white/60">Bet Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="pl-7 bg-white/5 border-white/10 text-white"
                    disabled={hasBet || gameState !== 'waiting'}
                  />
                </div>
                <div className="flex gap-2">
                  {[5, 10, 25, 50, 100].map(amt => (
                    <Button
                      key={amt}
                      variant="ghost"
                      size="sm"
                      onClick={() => setBetAmount(amt.toString())}
                      className="flex-1 text-xs text-white/60 bg-white/5 hover:bg-white/10"
                      disabled={hasBet || gameState !== 'waiting'}
                    >
                      ${amt}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Auto Cashout */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/60">Auto Cashout</label>
                  <button
                    onClick={() => setIsAutoCashoutEnabled(!isAutoCashoutEnabled)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors",
                      isAutoCashoutEnabled ? "bg-emerald-500" : "bg-white/20"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white transition-transform",
                      isAutoCashoutEnabled ? "translate-x-5" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    value={autoCashout}
                    onChange={(e) => setAutoCashout(e.target.value)}
                    className="pr-8 bg-white/5 border-white/10 text-white"
                    disabled={!isAutoCashoutEnabled || hasBet}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">x</span>
                </div>
              </div>
            </div>
            
            {/* Action Button */}
            <div className="mt-4">
              {!hasBet ? (
                <Button
                  onClick={handlePlaceBet}
                  disabled={gameState !== 'waiting' || !user}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
                >
                  {!user ? "Login to Play" : gameState !== 'waiting' ? "Wait for next round..." : `Bet $${betAmount}`}
                </Button>
              ) : !hasCashedOut ? (
                <Button
                  onClick={() => handleCashout()}
                  disabled={gameState !== 'running'}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Cashout {currentMultiplier.toFixed(2)}x
                </Button>
              ) : (
                <Button
                  disabled
                  className="w-full h-14 text-lg font-bold bg-emerald-500/20 text-emerald-400"
                >
                  Cashed out at {currentMultiplier.toFixed(2)}x (+${profit.toFixed(2)})
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Side Panel - Live Bets */}
        <div className="w-80 bg-[#0d1117] rounded-2xl border border-white/5 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-white/5">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Live Bets</span>
            <span className="ml-auto text-xs text-white/40">{liveBets.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {liveBets.map((bet) => (
              <div
                key={bet.id}
                className="flex items-center gap-3 p-3 border-b border-white/5 hover:bg-white/5"
              >
                <img
                  src={bet.avatar}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{bet.username}</p>
                  <p className="text-xs text-white/40">${bet.betAmount.toFixed(2)}</p>
                </div>
                {bet.cashoutMultiplier && (
                  <div className={cn(
                    "text-sm font-medium",
                    bet.cashoutMultiplier >= 2 ? "text-emerald-400" : "text-white/60"
                  )}>
                    {bet.cashoutMultiplier.toFixed(2)}x
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Fairness Info */}
          <div className="p-4 border-t border-white/5 bg-white/5">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Shield className="w-3 h-3" />
              <span>Server Seed Hash: {gameSession?.serverSeedHash.slice(0, 16)}...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

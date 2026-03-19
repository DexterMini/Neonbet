'use client'

import { useState, useCallback, useEffect } from 'react'
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
import { Coins, RefreshCw, Crown, Gem } from 'lucide-react'
import { useRouter } from 'next/navigation'

/* ── Coin CSS ─────────────────────────────────────── */
const coinStyles = `
@keyframes coinFlipHeads {
  0%   { transform: rotateY(0deg) scale(1); }
  25%  { transform: rotateY(900deg) scale(1.15); }
  50%  { transform: rotateY(1800deg) scale(1.05); }
  75%  { transform: rotateY(2520deg) scale(1.1); }
  100% { transform: rotateY(3240deg) scale(1); }
}
@keyframes coinFlipTails {
  0%   { transform: rotateY(0deg) scale(1); }
  25%  { transform: rotateY(900deg) scale(1.15); }
  50%  { transform: rotateY(1800deg) scale(1.05); }
  75%  { transform: rotateY(2520deg) scale(1.1); }
  100% { transform: rotateY(3420deg) scale(1); }
}
@keyframes shimmerCoin {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes coinGlow {
  0%, 100% { filter: drop-shadow(0 0 20px rgba(251,191,36,0.3)); }
  50%      { filter: drop-shadow(0 0 40px rgba(251,191,36,0.6)); }
}
`

/* ── Floating particles ───────────────────────────── */
const GOLD_PARTICLES = ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fef3c7', '#b45309']
function FloatingCoins({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {GOLD_PARTICLES.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${5 + i * 16}%` }}
          animate={{ opacity: [0, 0.4, 0], y: '-10%', x: `${5 + i * 16 + (Math.random() - 0.5) * 10}%` }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

/* ── The Coin Component ───────────────────────────── */
function CoinFace({ side, size = 160 }: { side: 'heads' | 'tails'; size?: number }) {
  const isHeads = side === 'heads'
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className={`absolute inset-0 rounded-full border-4 ${isHeads ? 'border-amber-400/60 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600' : 'border-slate-300/60 bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500'}`}
        style={{ boxShadow: isHeads ? '0 0 50px rgba(251,191,36,0.4), inset 0 -4px 12px rgba(0,0,0,0.3)' : '0 0 50px rgba(148,163,184,0.3), inset 0 -4px 12px rgba(0,0,0,0.3)' }}>
        <div className="absolute inset-3 rounded-full border-2 border-white/20" />
        <div className="flex items-center justify-center h-full">
          {isHeads ? (
            <Crown className="w-16 h-16 text-amber-900/70 drop-shadow-lg" />
          ) : (
            <Gem className="w-16 h-16 text-slate-600/70 drop-shadow-lg" />
          )}
        </div>
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-black uppercase tracking-widest ${isHeads ? 'text-amber-900/50' : 'text-slate-700/50'}`}>
          {side}
        </div>
      </div>
    </div>
  )
}

export default function FlipPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()
  const router = useRouter()

  const [betAmount, setBetAmount] = useState('10.00')
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads')
  const [isFlipping, setIsFlipping] = useState(false)
  const [result, setResult] = useState<'heads' | 'tails' | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [lastWin, setLastWin] = useState<boolean | null>(null)
  const [showFairness, setShowFairness] = useState(false)
  const [flipKey, setFlipKey] = useState(0)
  const [history, setHistory] = useState<{ side: 'heads' | 'tails'; won: boolean }[]>([])
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)
  const [streak, setStreak] = useState(0)

  const multiplier = 1.96 // 2% house edge
  const potentialProfit = parseFloat(betAmount) * multiplier - parseFloat(betAmount)

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  const handleFlip = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet) || !initialized) return { won: false, profit: -bet }
    setIsFlipping(true)
    setShowResult(false)

    try {
      const data = await placeBet('flip', String(bet), 'usdt', { choice })
      const resultSide = (data.result_data?.result ?? (Math.random() > 0.5 ? 'heads' : 'tails')) as 'heads' | 'tails'

      setResult(resultSide)
      setFlipKey(k => k + 1)

      // wait for animation
      await new Promise(r => setTimeout(r, 1800))

      const isWin = resultSide === choice
      setLastWin(isWin)
      setShowResult(true)

      if (isWin) {
        setStreak(s => s + 1)
      } else {
        setStreak(0)
      }

      const profit = isWin ? bet * multiplier - bet : -bet
      setHistory(prev => [{ side: resultSide, won: isWin }, ...prev.slice(0, 29)])
      sessionStats.recordBet(isWin, bet, profit, isWin ? multiplier : 0)

      if (isWin) {
        toast.success(`${resultSide.toUpperCase()}! Won $${(bet * multiplier - bet).toFixed(2)}`)
      } else {
        toast.error(`${resultSide.toUpperCase()} — You lose!`)
      }

      return { won: isWin, profit }
    } catch (err: any) {
      toast.error(err?.message || 'Flip error')
      return { won: false, profit: -bet }
    } finally {
      setIsFlipping(false)
    }
  }, [betAmount, choice, initialized, placeBet, multiplier, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => handleFlip(amount), [handleFlip])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (!isFlipping && !autoBetState.running) handleFlip() }, () => autoBetStop(), !isFlipping)

  return (
    <GameLayout>
      <style>{coinStyles}</style>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          {/* History */}
          {history.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider shrink-0">History</span>
              {history.map((h, i) => (
                <motion.span key={i} initial={i === 0 ? { scale: 0, opacity: 0 } : {}} animate={{ scale: 1, opacity: 1 }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold whitespace-nowrap ${h.won ? 'bg-brand/15 text-brand' : 'bg-accent-red/15 text-accent-red'}`}>
                  {h.side === 'heads' ? '👑' : '💎'} {h.side[0].toUpperCase()}
                </motion.span>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            <BetControls betAmount={betAmount} onBetAmountChange={setBetAmount} disabled={isFlipping}
              serverSeedHash={serverSeedHash} nonce={nonce} onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig} onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState} onAutoBetStart={autoBetStart} onAutoBetStop={autoBetStop}
              actionButton={
                <button onClick={() => handleFlip()} disabled={isFlipping || isPlacing || !initialized}
                  className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                    isFlipping || isPlacing ? 'bg-surface text-muted cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-background-deep shadow-lg shadow-amber-500/30 hover:brightness-110'
                  }`}>
                  {isFlipping ? <><RefreshCw className="w-4 h-4 animate-spin" />Flipping...</> : <><Coins className="w-4 h-4" />Flip Coin</>}
                </button>
              }
            >
              {/* Pick Side */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">Pick Your Side</span>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setChoice('heads')} disabled={isFlipping}
                    className={`relative py-4 rounded-xl font-bold text-[13px] transition-all flex flex-col items-center gap-1.5 ${
                      choice === 'heads'
                        ? 'bg-amber-500/15 border-2 border-amber-400/50 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                        : 'bg-surface border-2 border-border text-muted hover:text-white hover:border-white/20'
                    }`}>
                    <Crown className="w-7 h-7" />
                    <span>Heads</span>
                    {choice === 'heads' && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />}
                  </button>
                  <button onClick={() => setChoice('tails')} disabled={isFlipping}
                    className={`relative py-4 rounded-xl font-bold text-[13px] transition-all flex flex-col items-center gap-1.5 ${
                      choice === 'tails'
                        ? 'bg-slate-400/15 border-2 border-slate-400/50 text-slate-300 shadow-[0_0_20px_rgba(148,163,184,0.15)]'
                        : 'bg-surface border-2 border-border text-muted hover:text-white hover:border-white/20'
                    }`}>
                    <Gem className="w-7 h-7" />
                    <span>Tails</span>
                    {choice === 'tails' && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.5)]" />}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Multi</div>
                  <div className="text-base font-bold text-brand font-mono">1.96x</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Win %</div>
                  <div className="text-base font-bold text-white font-mono">50%</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Streak</div>
                  <div className={`text-base font-bold font-mono ${streak > 0 ? 'text-amber-400' : 'text-white'}`}>{streak}🔥</div>
                </div>
              </div>

              {/* Profit */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Profit on Win</span>
                <div className="bg-surface border border-border rounded-xl px-3 py-2.5 font-mono text-brand text-[13px] font-bold">+${potentialProfit.toFixed(2)}</div>
              </div>
            </BetControls>

            {/* Game area */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #1a1505 0%, #14120a 40%, #0d0f1a 100%)' }}>
                <FloatingCoins active />

                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-amber-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.08) 100%)' }}>
                      <Coins className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Coin Flip</h2>
                      <p className="text-amber-300/30 text-[10px] mt-0.5">Pick a side, 1.96x payout</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 ring-1 ring-amber-400/20">
                      {choice === 'heads' ? '👑 Heads' : '💎 Tails'}
                    </div>
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Coin Area */}
                <div className="relative z-10 h-72 sm:h-80 flex items-center justify-center" style={{ perspective: '800px' }}>
                  {/* Win/loss glow */}
                  {showResult && lastWin && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.15 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand rounded-full blur-[100px]" />
                  )}
                  {showResult && lastWin === false && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.15 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent-red rounded-full blur-[100px]" />
                  )}

                  {/* The Coin */}
                  <AnimatePresence mode="wait">
                    {result !== null ? (
                      <motion.div key={`result-${flipKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="relative z-10"
                        style={{
                          animation: result === 'heads'
                            ? 'coinFlipHeads 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                            : 'coinFlipTails 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                          transformStyle: 'preserve-3d',
                        }}>
                        <div style={{ backfaceVisibility: 'hidden' }}>
                          <CoinFace side="heads" />
                        </div>
                        <div className="absolute top-0 left-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                          <CoinFace side="tails" />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="relative z-10"
                        style={{ animation: 'coinGlow 3s ease-in-out infinite' }}>
                        <CoinFace side={choice} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Result badge */}
                  {showResult && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: 'spring' }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                      <span className={`inline-flex items-center gap-2 text-sm font-bold px-5 py-2 rounded-full ${
                        lastWin ? 'bg-brand/15 text-brand ring-1 ring-brand/20' : 'bg-accent-red/15 text-accent-red ring-1 ring-accent-red/20'
                      }`}>
                        {lastWin ? (
                          <>{result === 'heads' ? '👑' : '💎'} You Win! +${(parseFloat(betAmount) * multiplier - parseFloat(betAmount)).toFixed(2)}</>
                        ) : (
                          <>{result === 'heads' ? '👑' : '💎'} You Lose!</>
                        )}
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Bottom pick indicator */}
                <div className="relative z-10 px-5 pb-4 flex justify-center gap-6">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    choice === 'heads' ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30' : 'text-white/20'
                  }`}>
                    <Crown className="w-4 h-4" /> Heads
                  </div>
                  <div className="text-white/15 font-mono text-xs self-center">VS</div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    choice === 'tails' ? 'bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/30' : 'text-white/20'
                  }`}>
                    <Gem className="w-4 h-4" /> Tails
                  </div>
                </div>
              </div>

              <LiveBetsTable game="flip" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="flip"
            serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
            previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

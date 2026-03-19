'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
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
import { ArrowUp, ArrowDown, RotateCcw, Play, Equal } from 'lucide-react'
import { useRouter } from 'next/navigation'

/* ── Card Data ────────────────────────────────────── */
const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
const RANK_VALUES: Record<string, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
}

function getCardColor(suit: string) {
  return suit === '♥' || suit === '♦' ? 'text-red-400' : 'text-white'
}

function getSuitColor(suit: string) {
  if (suit === '♥') return '#ef4444'
  if (suit === '♦') return '#f97316'
  if (suit === '♣') return '#22c55e'
  return '#60a5fa'
}

function randomCard(seed?: number): { rank: string; suit: string; value: number } {
  const s = seed !== undefined ? seed : Math.random()
  const rankIdx = Math.floor(s * 13) % 13
  const suitIdx = Math.floor((s * 1000) % 4)
  return { rank: RANKS[rankIdx], suit: SUITS[suitIdx], value: RANK_VALUES[RANKS[rankIdx]] }
}

/* ── Floating particles ───────────────────────────── */
const CARD_PARTICLES = ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#1d4ed8', '#dbeafe']
function FloatingCards({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {CARD_PARTICLES.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${5 + i * 16}%` }}
          animate={{ opacity: [0, 0.3, 0], y: '-10%', x: `${5 + i * 16 + (Math.random() - 0.5) * 10}%` }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

/* ── Card Component ───────────────────────────────── */
function PlayingCard({ rank, suit, faceDown, small, highlighted }: {
  rank: string; suit: string; faceDown?: boolean; small?: boolean; highlighted?: 'win' | 'lose' | null
}) {
  const color = getCardColor(suit)
  const w = small ? 'w-14 h-20' : 'w-24 h-36 sm:w-28 sm:h-40'

  if (faceDown) {
    return (
      <div className={`${w} rounded-xl border-2 border-blue-500/30 flex items-center justify-center relative overflow-hidden`}
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' }}>
        <div className="absolute inset-2 rounded-lg border border-blue-400/20">
          <div className="w-full h-full"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(59,130,246,0.08) 4px, rgba(59,130,246,0.08) 8px)' }} />
        </div>
        <span className="text-blue-400/40 text-2xl font-black">?</span>
      </div>
    )
  }

  const glowColor = highlighted === 'win' ? 'rgba(0,232,123,0.4)' : highlighted === 'lose' ? 'rgba(255,71,87,0.4)' : 'transparent'
  const borderColor = highlighted === 'win' ? 'border-brand/60' : highlighted === 'lose' ? 'border-accent-red/60' : 'border-white/15'

  return (
    <div className={`${w} rounded-xl border-2 ${borderColor} flex flex-col justify-between p-2 sm:p-3 relative overflow-hidden transition-all`}
      style={{
        background: 'linear-gradient(145deg, rgba(30,30,45,0.95) 0%, rgba(15,15,30,0.98) 100%)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 30px ${glowColor}`,
      }}>
      {/* Top rank+suit */}
      <div className={`${color} font-bold ${small ? 'text-sm' : 'text-lg'} leading-none`}>
        <div>{rank}</div>
        <div className={small ? 'text-xs' : 'text-sm'} style={{ color: getSuitColor(suit) }}>{suit}</div>
      </div>
      {/* Center suit */}
      <div className="flex-1 flex items-center justify-center">
        <span className={`${small ? 'text-2xl' : 'text-5xl sm:text-6xl'} select-none drop-shadow-lg`} style={{ color: getSuitColor(suit) }}>{suit}</span>
      </div>
      {/* Bottom rank+suit (inverted) */}
      <div className={`${color} font-bold ${small ? 'text-sm' : 'text-lg'} leading-none text-right self-end rotate-180`}>
        <div>{rank}</div>
        <div className={small ? 'text-xs' : 'text-sm'} style={{ color: getSuitColor(suit) }}>{suit}</div>
      </div>
    </div>
  )
}

export default function HiloPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()
  const router = useRouter()

  const [betAmount, setBetAmount] = useState('10.00')
  const [isPlaying, setIsPlaying] = useState(false)
  const [gameActive, setGameActive] = useState(false)
  const [currentCard, setCurrentCard] = useState<{ rank: string; suit: string; value: number } | null>(null)
  const [nextCard, setNextCard] = useState<{ rank: string; suit: string; value: number } | null>(null)
  const [revealNext, setRevealNext] = useState(false)
  const [lastGuess, setLastGuess] = useState<'higher' | 'lower' | 'same' | null>(null)
  const [lastWin, setLastWin] = useState<boolean | null>(null)
  const [round, setRound] = useState(0)
  const [currentMultiplier, setCurrentMultiplier] = useState(1)
  const [showFairness, setShowFairness] = useState(false)
  const [cardHistory, setCardHistory] = useState<{ rank: string; suit: string; value: number; won: boolean }[]>([])
  const [history, setHistory] = useState<{ rounds: number; won: boolean; multi: number }[]>([])
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)

  // Calculate probabilities based on current card
  const higherChance = useMemo(() => {
    if (!currentCard) return 50
    return Math.round(((13 - currentCard.value) / 13) * 100)
  }, [currentCard])

  const lowerChance = useMemo(() => {
    if (!currentCard) return 50
    return Math.round(((currentCard.value - 1) / 13) * 100)
  }, [currentCard])

  const sameChance = useMemo(() => {
    return Math.round((1 / 13) * 100)
  }, [])

  const higherMulti = useMemo(() => higherChance > 0 ? +(97 / higherChance).toFixed(2) : 0, [higherChance])
  const lowerMulti = useMemo(() => lowerChance > 0 ? +(97 / lowerChance).toFixed(2) : 0, [lowerChance])
  const sameMulti = useMemo(() => +(97 / sameChance).toFixed(2), [sameChance])

  const potentialProfit = parseFloat(betAmount) * currentMultiplier - parseFloat(betAmount)

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  const startGame = useCallback(async () => {
    const bet = parseFloat(betAmount)
    if (bet <= 0 || isNaN(bet) || !initialized) return

    const card = randomCard(Math.random())
    setCurrentCard(card)
    setNextCard(null)
    setRevealNext(false)
    setLastGuess(null)
    setLastWin(null)
    setRound(1)
    setCurrentMultiplier(1)
    setGameActive(true)
    setCardHistory([])
  }, [betAmount, initialized])

  const makeGuess = useCallback(async (guess: 'higher' | 'lower' | 'same') => {
    if (!currentCard || !gameActive || isPlaying) return
    setIsPlaying(true)
    setLastGuess(guess)

    try {
      const data = await placeBet('hilo', String(parseFloat(betAmount)), 'usdt', {
        guess, current_value: currentCard.value, round,
      })
      const val = data.result_data?.card_value ?? Math.floor(Math.random() * 13) + 1
      const suitIdx = Math.floor(Math.random() * 4)
      const rankIdx = val - 1
      const newCard = { rank: RANKS[rankIdx], suit: SUITS[suitIdx], value: val }

      setNextCard(newCard)

      // Animate reveal
      await new Promise(r => setTimeout(r, 300))
      setRevealNext(true)
      await new Promise(r => setTimeout(r, 500))

      const isWin =
        (guess === 'higher' && newCard.value >= currentCard.value) ||
        (guess === 'lower' && newCard.value <= currentCard.value) ||
        (guess === 'same' && newCard.value === currentCard.value)

      setLastWin(isWin)

      if (isWin) {
        const guessMulti = guess === 'higher' ? higherMulti : guess === 'lower' ? lowerMulti : sameMulti
        const newMulti = +(currentMultiplier * guessMulti).toFixed(2)
        setCurrentMultiplier(newMulti)
        setCardHistory(prev => [...prev, { ...currentCard, won: true }])

        await new Promise(r => setTimeout(r, 600))
        setCurrentCard(newCard)
        setNextCard(null)
        setRevealNext(false)
        setLastGuess(null)
        setLastWin(null)
        setRound(r => r + 1)
        toast.success(`Correct! ${newMulti}x multiplier`)
      } else {
        const bet = parseFloat(betAmount)
        setCardHistory(prev => [...prev, { ...currentCard, won: false }])
        setHistory(prev => [{ rounds: round, won: false, multi: 0 }, ...prev.slice(0, 19)])
        sessionStats.recordBet(false, bet, -bet, 0)
        setGameActive(false)
        toast.error(`Wrong! The card was ${newCard.rank}${newCard.suit}`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    } finally {
      setIsPlaying(false)
    }
  }, [currentCard, gameActive, isPlaying, placeBet, betAmount, round, currentMultiplier, higherMulti, lowerMulti, sameMulti, sessionStats])

  const cashOut = useCallback(() => {
    if (!gameActive || round < 2) return
    const bet = parseFloat(betAmount)
    const profit = bet * currentMultiplier - bet
    setHistory(prev => [{ rounds: round, won: true, multi: currentMultiplier }, ...prev.slice(0, 19)])
    sessionStats.recordBet(true, bet, profit, currentMultiplier)
    setGameActive(false)
    toast.success(`Cashed out at ${currentMultiplier}x! Won $${profit.toFixed(2)}`)
  }, [gameActive, round, betAmount, currentMultiplier, sessionStats])

  const autoBetHandler = useCallback(async (amount: number): Promise<{ won: boolean; profit: number }> => {
    // auto-bet: start a game, make one guess (always higher on low cards, lower on high)
    if (!initialized) return { won: false, profit: -amount }

    const card = randomCard(Math.random())
    const guess: 'higher' | 'lower' = card.value <= 7 ? 'higher' : 'lower'
    const { result: gameResult } = await generateBet('hilo')
    const newCard = randomCard(gameResult as number)

    const isWin = (guess === 'higher' && newCard.value >= card.value) || (guess === 'lower' && newCard.value <= card.value)
    const multi = guess === 'higher' ? +(97 / ((13 - card.value) / 13 * 100)).toFixed(2) : +(97 / ((card.value - 1) / 13 * 100)).toFixed(2)
    const profit = isWin ? amount * multi - amount : -amount
    sessionStats.recordBet(isWin, amount, profit, isWin ? multi : 0)
    return { won: isWin, profit }
  }, [initialized, generateBet, sessionStats])

  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          {/* History */}
          {history.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider shrink-0">History</span>
              {history.map((h, i) => (
                <motion.span key={i} initial={i === 0 ? { scale: 0, opacity: 0 } : {}} animate={{ scale: 1, opacity: 1 }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold whitespace-nowrap ${h.won ? 'bg-brand/15 text-brand' : 'bg-accent-red/15 text-accent-red'}`}>
                  {h.won ? `${h.multi}x` : `R${h.rounds}`}
                </motion.span>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            <BetControls betAmount={betAmount} onBetAmountChange={setBetAmount} disabled={gameActive || isPlaying}
              serverSeedHash={serverSeedHash} nonce={nonce} onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig} onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState} onAutoBetStart={autoBetStart} onAutoBetStop={autoBetStop}
              actionButton={
                !gameActive ? (
                  <button onClick={startGame} disabled={isPlaying || isPlacing || !initialized}
                    className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                      isPlaying || isPlacing ? 'bg-surface text-muted cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 hover:brightness-110'
                    }`}>
                    <Play className="w-4 h-4" /> Start Game
                  </button>
                ) : (
                  <button onClick={cashOut} disabled={round < 2 || isPlaying}
                    className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                      round < 2 || isPlaying ? 'bg-surface text-muted cursor-not-allowed' : 'bg-gradient-to-r from-brand to-emerald-400 text-background-deep shadow-lg shadow-brand/30 hover:brightness-110'
                    }`}>
                    Cash Out {currentMultiplier.toFixed(2)}x (${potentialProfit.toFixed(2)})
                  </button>
                )
              }
            >
              {/* Current multiplier */}
              <div className="bg-surface rounded-xl p-3 border border-border text-center">
                <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Current Multiplier</div>
                <div className={`text-2xl font-black font-mono ${currentMultiplier > 1 ? 'text-brand' : 'text-white'}`}>
                  {currentMultiplier.toFixed(2)}x
                </div>
                <div className="text-[10px] text-muted mt-0.5">Round {round}</div>
              </div>

              {/* Card trail */}
              {cardHistory.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Cards Seen</span>
                  <div className="flex gap-1 flex-wrap">
                    {cardHistory.map((c, i) => (
                      <div key={i} className={`w-8 h-10 rounded-md border flex flex-col items-center justify-center text-[10px] font-bold ${
                        c.won ? 'border-brand/30 bg-brand/10' : 'border-accent-red/30 bg-accent-red/10'
                      }`}>
                        <span style={{ color: getSuitColor(c.suit) }}>{c.rank}</span>
                        <span style={{ color: getSuitColor(c.suit) }} className="text-[8px]">{c.suit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profit */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Profit on Cash Out</span>
                <div className="bg-surface border border-border rounded-xl px-3 py-2.5 font-mono text-brand text-[13px] font-bold">
                  +${potentialProfit > 0 ? potentialProfit.toFixed(2) : '0.00'}
                </div>
              </div>
            </BetControls>

            {/* Game area */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #0a1628 0%, #0d1117 40%, #0d0f1a 100%)' }}>
                <FloatingCards active />

                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-blue-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.08) 100%)' }}>
                      <ArrowUp className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">HiLo</h2>
                      <p className="text-blue-300/30 text-[10px] mt-0.5">Higher or Lower?</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {gameActive && (
                      <div className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 ring-1 ring-blue-400/20 font-mono">
                        Round {round} • {currentMultiplier.toFixed(2)}x
                      </div>
                    )}
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Card Area */}
                <div className="relative z-10 h-80 sm:h-96 flex items-center justify-center gap-6 sm:gap-10 px-4">
                  {/* Win/loss glow */}
                  {lastWin === true && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.12 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand rounded-full blur-[100px]" />
                  )}
                  {lastWin === false && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.12 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent-red rounded-full blur-[100px]" />
                  )}

                  {gameActive && currentCard ? (
                    <>
                      {/* Current card */}
                      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}>
                        <PlayingCard rank={currentCard.rank} suit={currentCard.suit} />
                        <div className="text-center mt-3 text-white/30 text-[11px] font-semibold uppercase tracking-wider">Current</div>
                      </motion.div>

                      {/* Arrow / VS */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <span className="text-white/30 text-xs font-bold">VS</span>
                        </div>
                      </div>

                      {/* Next card (face down or revealed) */}
                      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.1 }}>
                        {nextCard && revealNext ? (
                          <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.5 }}>
                            <PlayingCard rank={nextCard.rank} suit={nextCard.suit}
                              highlighted={lastWin === true ? 'win' : lastWin === false ? 'lose' : null} />
                          </motion.div>
                        ) : (
                          <PlayingCard rank="" suit="" faceDown />
                        )}
                        <div className="text-center mt-3 text-white/30 text-[11px] font-semibold uppercase tracking-wider">Next</div>
                      </motion.div>
                    </>
                  ) : (
                    <div className="text-center z-10">
                      <div className="flex gap-3 justify-center mb-4">
                        <PlayingCard rank="A" suit="♠" small />
                        <PlayingCard rank="K" suit="♥" small />
                      </div>
                      <div className="text-white/25 text-sm mt-4">Place a bet to start</div>
                    </div>
                  )}
                </div>

                {/* Guess buttons */}
                {gameActive && !lastWin && lastWin !== false && (
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 px-5 pb-5">
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => makeGuess('higher')} disabled={isPlaying || !currentCard}
                        className="py-4 rounded-xl font-bold text-[13px] transition-all flex flex-col items-center gap-1.5 bg-brand/10 border-2 border-brand/30 text-brand hover:bg-brand/20 hover:border-brand/50 disabled:opacity-30">
                        <ArrowUp className="w-6 h-6" />
                        <span>Higher</span>
                        <span className="text-[10px] text-brand/60 font-mono">{higherMulti}x • {higherChance}%</span>
                      </button>
                      <button onClick={() => makeGuess('same')} disabled={isPlaying || !currentCard}
                        className="py-4 rounded-xl font-bold text-[13px] transition-all flex flex-col items-center gap-1.5 bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 disabled:opacity-30">
                        <Equal className="w-6 h-6" />
                        <span>Same</span>
                        <span className="text-[10px] text-amber-400/60 font-mono">{sameMulti}x • {sameChance}%</span>
                      </button>
                      <button onClick={() => makeGuess('lower')} disabled={isPlaying || !currentCard}
                        className="py-4 rounded-xl font-bold text-[13px] transition-all flex flex-col items-center gap-1.5 bg-accent-red/10 border-2 border-accent-red/30 text-accent-red hover:bg-accent-red/20 hover:border-accent-red/50 disabled:opacity-30">
                        <ArrowDown className="w-6 h-6" />
                        <span>Lower</span>
                        <span className="text-[10px] text-accent-red/60 font-mono">{lowerMulti}x • {lowerChance}%</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Game over */}
                {!gameActive && lastWin === false && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="relative z-10 px-5 pb-5 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-red/15 text-accent-red ring-1 ring-accent-red/20 text-sm font-bold">
                      Game Over — Round {round}
                    </div>
                  </motion.div>
                )}
              </div>

              <LiveBetsTable game="hilo" />
            </div>
          </div>

          <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="hilo"
            serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
            previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
        </div>
      </div>
    </GameLayout>
  )
}

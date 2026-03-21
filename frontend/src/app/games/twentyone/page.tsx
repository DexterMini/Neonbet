'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { Shield, Sparkles, RotateCcw, Spade } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { useAutoBet, defaultAutoBetConfig, type AutoBetConfig } from '@/hooks/useAutoBet'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useRouter } from 'next/navigation'

/* ── Floating particles ───────────────────────────── */
const CARD_PARTICLE_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#dc2626', '#b91c1c', '#fecaca']
function FloatingCards() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {CARD_PARTICLE_COLORS.map((c, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, y: '110%', x: `${5 + i * 16}%` }}
          animate={{ opacity: [0, 0.25, 0], y: '-10%', x: `${5 + i * 16 + (Math.random() - 0.5) * 10}%` }}
          transition={{ duration: 5 + Math.random() * 4, repeat: Infinity, delay: i * 0.9, ease: 'easeOut' }}
          className="absolute w-1.5 h-1.5 rounded-sm"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

/* ── Multiplier tables per card count ─────── */
const MULTIPLIER_TABLES: Record<number, Record<number, number>> = {
  2: { 16: 1.5, 17: 1.7, 18: 2.1, 19: 2.5, 20: 2.3, 21: 3.8 },
  3: { 16: 1.4, 17: 1.6, 18: 1.9, 19: 2.2, 20: 2.1, 21: 3.5 },
  4: { 16: 3.0, 17: 3.4, 18: 4.1, 19: 4.8, 20: 4.5, 21: 7.5 },
  5: { 16: 10.0, 17: 11.5, 18: 13.5, 19: 16.1, 20: 15.0, 21: 25.1 },
  6: { 16: 47.0, 17: 54.0, 18: 63.3, 19: 75.1, 20: 70.4, 21: 117.3 },
  7: { 16: 281.1, 17: 323.3, 18: 379.4, 19: 449.7, 20: 421.6, 21: 702.7 },
}

const SUITS = ['♠', '♥', '♦', '♣'] as const
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
type Card = { suit: typeof SUITS[number]; value: string; num: number }
type GameState = 'betting' | 'revealing' | 'finished'

const fmtMult = (m: number) => m >= 1000 ? m.toLocaleString() + 'x' : m + 'x'

/* ── Face-down card ────────────────────────────────── */
const FaceDownCard = () => (
  <div className="w-[84px] h-[120px] sm:w-[96px] sm:h-[136px] rounded-xl flex items-center justify-center shrink-0 ring-1 ring-emerald-400/15"
    style={{
      background: 'linear-gradient(145deg, rgba(52,211,153,0.12) 0%, rgba(52,211,153,0.03) 100%)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(52,211,153,0.08)',
    }}>
    <span className="text-emerald-400/25 text-3xl font-black italic" style={{ fontFamily: 'serif' }}>N</span>
  </div>
)

/* ── Revealed card ─────────────────────────────────── */
const RevealedCard = ({ card, index, won, bust }: { card: Card; index: number; won: boolean; bust: boolean }) => {
  const isRed = card.suit === '♥' || card.suit === '♦'
  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.85, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ duration: 0.45, delay: index * 0.18, type: 'spring', stiffness: 220, damping: 22 }}
      className="shrink-0"
    >
      <div className={`w-[84px] h-[120px] sm:w-[96px] sm:h-[136px] rounded-xl border-2 shadow-xl flex flex-col justify-between p-2 select-none
        ${bust ? 'border-red-500/40 shadow-red-500/15' : won ? 'border-emerald-400/50 shadow-emerald-400/15' : 'border-white/10 shadow-black/20'}`}
        style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f0f0f0 100%)' }}>
        <div className={`flex flex-col items-start leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
          <span className="text-sm font-bold">{card.value}</span>
          <span className="text-xs -mt-0.5">{card.suit}</span>
        </div>
        <div className={`flex items-center justify-center flex-1 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
          <span className="text-3xl">{card.suit}</span>
        </div>
        <div className={`flex flex-col items-end leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
          <span className="text-sm font-bold">{card.value}</span>
          <span className="text-xs -mt-0.5">{card.suit}</span>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Main Page ─────────────────────────────────────── */
export default function TwentyOnePage() {
  const {
    initialized, serverSeedHash, clientSeed, nonce, previousServerSeed,
    generateBet, rotateSeed, setClientSeed,
  } = useProvablyFair()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()
  const router = useRouter()

  const [betAmount, setBetAmount] = useState('10.00')
  const [numCards, setNumCards] = useState(2)
  const [showFairness, setShowFairness] = useState(false)
  const [gameState, setGameState] = useState<GameState>('betting')
  const [cards, setCards] = useState<Card[]>([])
  const [total, setTotal] = useState(0)
  const [winMultiplier, setWinMultiplier] = useState(0)
  const [autoBetConfig, setAutoBetConfig] = useState<AutoBetConfig>(defaultAutoBetConfig)

  const currentTable = useMemo(() => MULTIPLIER_TABLES[numCards], [numCards])
  const isWin = gameState === 'finished' && total >= 16 && total <= 21
  const isBust = gameState === 'finished' && total > 21
  const isLow = gameState === 'finished' && total < 16
  const profit = isWin ? parseFloat(betAmount) * winMultiplier - parseFloat(betAmount) : -parseFloat(betAmount)

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [isHydrated, isAuthenticated, router])

  const buildDeck = useCallback((hashes: number[]): Card[] => {
    const d: Card[] = []
    for (let i = 0; i < 52; i++) {
      const idx = hashes[i] % 52
      const suitIdx = Math.floor(idx / 13)
      const valIdx = idx % 13
      d.push({ suit: SUITS[suitIdx], value: VALUES[valIdx], num: valIdx >= 10 ? 10 : valIdx === 0 ? 11 : valIdx + 1 })
    }
    return d
  }, [])

  const calcTotal = useCallback((hand: Card[]): number => {
    let t = 0, aces = 0
    for (const c of hand) {
      if (c.value === 'A') { aces++; t += 11 } else if (['K', 'Q', 'J'].includes(c.value)) t += 10
      else t += parseInt(c.value)
    }
    while (t > 21 && aces > 0) { t -= 10; aces-- }
    return t
  }, [])

  const handleBet = useCallback(async (amount?: number): Promise<{ won: boolean; profit: number }> => {
    const bet = amount ?? parseFloat(betAmount)
    if (bet <= 0) { toast.error('Enter a valid bet'); return { won: false, profit: 0 } }
    if (!initialized) { toast.error('Not initialized'); return { won: false, profit: 0 } }

    setCards([]); setTotal(0); setWinMultiplier(0); setGameState('revealing')

    try {
      const data = await placeBet('twentyone', String(bet), 'usdt', { num_cards: numCards })
      const resultCards: Card[] = (data.result_data.cards || []).map((c: any) => ({
        suit: c.suit,
        value: c.rank || c.value,
        num: c.rank === 'A' ? 11 : ['J','Q','K'].includes(c.rank) ? 10 : parseInt(c.rank) || 0,
      }))
      const handTotal = data.result_data.total ?? calcTotal(resultCards)
      const table = MULTIPLIER_TABLES[numCards]
      const mult = table[handTotal] || 0
      const won = data.outcome === 'win'

      setCards(resultCards); setTotal(handTotal); setWinMultiplier(mult)

      return new Promise<{ won: boolean; profit: number }>((resolve) => {
        setTimeout(() => {
          setGameState('finished')
          const profit = won ? bet * mult - bet : -bet
          if (won) {
            sessionStats.recordBet(true, bet, bet * mult - bet, mult)
            toast.success(`${handTotal}! Won $${(bet * mult - bet).toFixed(2)} (${fmtMult(mult)})`)
          } else if (handTotal > 21) {
            sessionStats.recordBet(false, bet, -bet, 0)
            toast.error('Bust! Over 21')
          } else {
            sessionStats.recordBet(false, bet, -bet, 0)
            toast.error(`${handTotal} — under 16`)
          }
          resolve({ won, profit })
        }, numCards * 180 + 700)
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to place bet')
      setGameState('betting')
      return { won: false, profit: -(amount ?? parseFloat(betAmount)) }
    }
  }, [betAmount, initialized, placeBet, calcTotal, numCards, sessionStats])

  const autoBetHandler = useCallback(async (amount: number) => handleBet(amount), [handleBet])
  const { state: autoBetState, start: autoBetStart, stop: autoBetStop } = useAutoBet(autoBetConfig, betAmount, autoBetHandler)
  useHotkeys(() => { if (gameState === 'betting' && !autoBetState.running) handleBet() }, () => autoBetStop(), gameState === 'betting')

  const newGame = () => { setGameState('betting'); setCards([]); setTotal(0); setWinMultiplier(0) }

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
              disabled={gameState !== 'betting'}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              autoBetConfig={autoBetConfig}
              onAutoBetConfigChange={setAutoBetConfig}
              autoBetState={autoBetState}
              onAutoBetStart={autoBetStart}
              onAutoBetStop={autoBetStop}
              actionButton={
                gameState === 'betting' ? (
                  <button onClick={() => handleBet()} disabled={parseFloat(betAmount) <= 0 || isPlacing}
                    className="w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-background-deep shadow-lg shadow-emerald-500/30 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Sparkles className="w-4 h-4" />{isPlacing ? 'Dealing...' : 'Deal Cards'}
                  </button>
                ) : gameState === 'finished' ? (
                  <button onClick={newGame}
                    className="w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-background-deep shadow-lg shadow-emerald-500/30 hover:brightness-110">
                    <RotateCcw className="w-4 h-4" />Play Again
                  </button>
                ) : (
                  <div className="w-full py-3.5 bg-surface border border-emerald-400/30 font-bold text-[14px] text-emerald-400 rounded-xl text-center animate-pulse">
                    Revealing...
                  </div>
                )
              }
            >
              {/* Number of cards */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Number of Cards</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[2, 3, 4, 5, 6, 7].map(n => (
                    <button key={n} onClick={() => gameState === 'betting' && setNumCards(n)} disabled={gameState !== 'betting'}
                      className={`py-2 rounded-xl text-[12px] font-bold transition-all border disabled:opacity-50
                        ${numCards === n ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-surface border-border text-muted hover:text-white'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multiplier preview */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Payouts ({numCards} cards)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[16, 17, 18, 19, 20, 21].map(val => (
                    <div key={val} className={`rounded-xl p-2 border text-center ring-1 transition-all
                      ${gameState === 'finished' && total === val && isWin
                        ? 'bg-emerald-400/[0.08] border-emerald-400/30 ring-emerald-400/20'
                        : 'bg-surface border-border ring-transparent'}`}>
                      <div className="text-[10px] text-muted">{val}</div>
                      <div className={`text-[12px] font-bold font-mono ${gameState === 'finished' && total === val && isWin ? 'text-emerald-400' : 'text-white'}`}>{fmtMult(currentTable[val])}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Result */}
              <AnimatePresence>
                {gameState === 'finished' && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className={`rounded-xl p-3.5 text-center ring-1 ${isWin ? 'bg-emerald-400/[0.06] ring-emerald-400/20' : 'bg-accent-red/10 ring-accent-red/20'}`}>
                    <div className={`text-xl font-bold font-mono ${isWin ? 'text-emerald-400' : 'text-accent-red'}`}>
                      {isWin ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {isWin ? `${fmtMult(winMultiplier)} multiplier` : isBust ? 'Bust — over 21' : 'Under 16'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* Right: Game Area — Premium Scene */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Multiplier Grid + Total */}
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(165deg, #091a12 0%, #0c1410 40%, #0a0f16 100%)' }}>
                <FloatingCards />

                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-emerald-400/20"
                      style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.25) 0%, rgba(52,211,153,0.08) 100%)' }}>
                      <Spade className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base leading-none">Twenty One</h2>
                      <p className="text-emerald-300/30 text-[10px] mt-0.5">{numCards} cards • Hit 16-21 to win</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowFairness(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/[0.04] text-muted hover:text-white ring-1 ring-white/[0.06] transition-all">
                      <Shield className="w-3 h-3" />Fairness
                    </button>
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Multiplier Grid */}
                <div className="relative z-10 px-5 pb-3">
                  <div className="flex gap-4">
                    <div className="grid grid-cols-2 gap-2.5 flex-1">
                      {[16, 17, 18, 19, 20, 21].map(val => {
                        const mult = currentTable[val]
                        const isHit = gameState === 'finished' && total === val && isWin
                        return (
                          <motion.div key={`${val}-${numCards}`}
                            animate={isHit ? { scale: [1, 1.06, 1] } : {}}
                            transition={isHit ? { repeat: 2, duration: 0.3 } : {}}
                            className={`rounded-xl px-4 py-3 flex items-center justify-between transition-all duration-300 ring-1 ${
                              isHit ? 'bg-emerald-400/[0.12] ring-emerald-400/30 shadow-lg shadow-emerald-400/10'
                                : 'bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.04]'
                            }`}>
                            <span className={`text-xl font-bold tabular-nums ${isHit ? 'text-emerald-400' : 'text-white'}`}>{val}</span>
                            <span className={`font-mono font-bold text-sm ${
                              isHit ? 'text-emerald-400' : mult >= 10 ? 'text-cyan-400' : 'text-cyan-400/70'
                            }`}>{fmtMult(mult)}</span>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* Total */}
                    <div className={`w-32 sm:w-36 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all duration-500 ring-1 ${
                      isWin ? 'bg-emerald-400/[0.08] ring-emerald-400/20' :
                      (isBust || isLow) ? 'bg-accent-red/[0.08] ring-accent-red/20' :
                      'bg-white/[0.02] ring-white/[0.06]'
                    }`}>
                      <AnimatePresence mode="wait">
                        <motion.span key={total}
                          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className={`text-6xl sm:text-7xl font-bold font-mono tabular-nums ${
                            isWin ? 'text-emerald-400' : (isBust || isLow) ? 'text-accent-red' : total > 0 ? 'text-white' : 'text-white/15'
                          }`}
                          style={{ textShadow: isWin ? '0 0 40px rgba(52,211,153,0.5)' : isBust ? '0 0 40px rgba(255,71,87,0.4)' : 'none' }}>
                          {total}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-muted text-sm mt-1">Total</span>
                    </div>
                  </div>
                </div>

                {/* Card Area */}
                <div className="relative z-10 mx-5 mb-5 rounded-2xl border border-dashed border-white/[0.06] overflow-hidden"
                  style={{ background: 'linear-gradient(165deg, rgba(52,211,153,0.03) 0%, rgba(15,15,20,0.3) 100%)' }}>
                  {/* Suit header */}
                  <div className="flex items-center justify-center gap-2.5 pt-5 pb-3">
                    <span className="text-white/15">♠</span>
                    <span className="text-red-500/30">♥</span>
                    <span className="text-white/30 font-bold text-sm tracking-[0.2em] uppercase">Twenty One</span>
                    <span className="text-red-500/30">♦</span>
                    <span className="text-white/15">♣</span>
                  </div>

                  {/* Cards */}
                  <div className="px-6 pb-7 pt-2">
                    <div className="flex flex-wrap gap-3 items-center justify-center min-h-[150px]">
                      {gameState === 'betting' ? (
                        [...Array(numCards)].map((_, i) => (
                          <motion.div key={`fd-${i}-${numCards}`}
                            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.2 }}>
                            <FaceDownCard />
                          </motion.div>
                        ))
                      ) : (
                        cards.map((card, i) => (
                          <RevealedCard key={`rv-${i}-${card.value}${card.suit}`} card={card} index={i} won={isWin} bust={isBust} />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <LiveBetsTable game="twentyone" />
            </div>
          </div>
        </div>

        <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="twentyone"
          serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
          previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
      </div>
    </GameLayout>
  )
}

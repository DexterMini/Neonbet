'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import { Shield, Sparkles, RotateCcw } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats } from '@/components/game'

/* ── Multiplier tables per card count (from Winna.com) ─────── */
const MULTIPLIER_TABLES: Record<number, Record<number, number>> = {
  2: { 16: 0.2, 17: 0.3, 18: 2.4, 19: 3.1, 20: 3.5, 21: 5 },
  3: { 16: 0.7, 17: 0.8, 18: 1.1, 19: 2, 20: 2.7, 21: 5 },
  4: { 16: 2.2, 17: 2.4, 18: 3.5, 19: 4, 20: 4.8, 21: 10 },
  5: { 16: 1.6, 17: 3.4, 18: 10.9, 19: 14.6, 20: 16.3, 21: 40 },
  6: { 16: 23, 17: 36, 18: 65, 19: 90, 20: 100, 21: 200 },
  7: { 16: 280, 17: 400, 18: 500, 19: 1000, 20: 1000, 21: 1500 },
}

const SUITS = ['♠', '♥', '♦', '♣'] as const
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
type Card = { suit: typeof SUITS[number]; value: string; num: number }
type GameState = 'betting' | 'revealing' | 'finished'

/* ── Format multiplier ─────────────────────────────── */
const fmtMult = (m: number) => {
  if (m >= 1000) return m.toLocaleString() + 'x'
  return m + 'x'
}

/* ── Face-down card ────────────────────────────────── */
const FaceDownCard = () => (
  <div
    className="w-[84px] h-[120px] sm:w-[96px] sm:h-[136px] rounded-xl border border-brand/20 flex items-center justify-center shrink-0"
    style={{
      background: 'linear-gradient(145deg, rgba(201,169,110,0.12) 0%, rgba(201,169,110,0.04) 100%)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(201,169,110,0.08)',
    }}
  >
    <span className="text-brand/30 text-3xl font-black italic" style={{ fontFamily: 'serif' }}>N</span>
  </div>
)

/* ── Revealed card ─────────────────────────────────── */
const RevealedCard = ({ card, index, won, bust }: {
  card: Card; index: number; won: boolean; bust: boolean
}) => {
  const isRed = card.suit === '♥' || card.suit === '♦'

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.85, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{
        duration: 0.45,
        delay: index * 0.18,
        type: 'spring',
        stiffness: 220,
        damping: 22,
      }}
      className="shrink-0"
    >
      <div
        className={`
          w-[84px] h-[120px] sm:w-[96px] sm:h-[136px] rounded-xl border-2 shadow-xl
          flex flex-col justify-between p-2 select-none
          ${bust ? 'border-red-500/40 shadow-red-500/15' :
            won ? 'border-brand/50 shadow-brand/15' :
            'border-white/10 shadow-black/20'}
        `}
        style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f0f0f0 100%)' }}
      >
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
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [numCards, setNumCards] = useState(2)
  const [showFairness, setShowFairness] = useState(false)
  const [gameState, setGameState] = useState<GameState>('betting')
  const [cards, setCards] = useState<Card[]>([])
  const [total, setTotal] = useState(0)
  const [winMultiplier, setWinMultiplier] = useState(0)

  const currentTable = useMemo(() => MULTIPLIER_TABLES[numCards], [numCards])
  const isWin = gameState === 'finished' && total >= 16 && total <= 21
  const isBust = gameState === 'finished' && total > 21
  const isLow = gameState === 'finished' && total < 16
  const profit = isWin
    ? parseFloat(betAmount) * winMultiplier - parseFloat(betAmount)
    : -parseFloat(betAmount)

  /* ── Build deck from provably fair hash ─────────── */
  const buildDeck = useCallback((hashes: number[]): Card[] => {
    const d: Card[] = []
    for (let i = 0; i < 52; i++) {
      const idx = hashes[i] % 52
      const suitIdx = Math.floor(idx / 13)
      const valIdx = idx % 13
      d.push({
        suit: SUITS[suitIdx],
        value: VALUES[valIdx],
        num: valIdx >= 10 ? 10 : valIdx === 0 ? 11 : valIdx + 1,
      })
    }
    return d
  }, [])

  /* ── Calculate hand total ───────────────────────── */
  const calcTotal = useCallback((hand: Card[]): number => {
    let t = 0, aces = 0
    for (const c of hand) {
      if (c.value === 'A') { aces++; t += 11 }
      else if (['K', 'Q', 'J'].includes(c.value)) t += 10
      else t += parseInt(c.value)
    }
    while (t > 21 && aces > 0) { t -= 10; aces-- }
    return t
  }, [])

  /* ── Bet handler ────────────────────────────────── */
  const handleBet = async () => {
    const bet = parseFloat(betAmount)
    if (bet <= 0) { toast.error('Enter a valid bet'); return }
    if (!initialized && !isAuthenticated) { toast.error('Not initialized'); return }

    setCards([])
    setTotal(0)
    setWinMultiplier(0)
    setGameState('revealing')

    try {
      const { result: shuffled } = await generateBet('twentyone')
      const fullDeck = buildDeck(shuffled as number[])
      const drawn = fullDeck.slice(0, numCards)
      const handTotal = calcTotal(drawn)
      const table = MULTIPLIER_TABLES[numCards]
      const mult = table[handTotal] || 0
      const won = handTotal >= 16 && handTotal <= 21

      setCards(drawn)
      setTotal(handTotal)
      setWinMultiplier(mult)

      // Wait for reveal animations
      setTimeout(() => {
        setGameState('finished')
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
      }, numCards * 180 + 700)
    } catch {
      toast.error('Failed to place bet')
      setGameState('betting')
    }
  }

  const newGame = () => {
    setGameState('betting')
    setCards([])
    setTotal(0)
    setWinMultiplier(0)
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
              disabled={gameState !== 'betting'}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              showAutoTab={false}
              actionButton={
                gameState === 'betting' ? (
                  <button onClick={handleBet} disabled={parseFloat(betAmount) <= 0 || isPlacing}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />{isPlacing ? 'Dealing...' : 'Deal Cards'}
                  </button>
                ) : gameState === 'finished' ? (
                  <button onClick={newGame}
                    className="w-full py-3.5 bg-brand text-background-deep font-bold text-[14px] rounded-xl shadow-glow-brand-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />Play Again
                  </button>
                ) : (
                  <div className="w-full py-3.5 bg-surface border border-brand/30 font-bold text-[14px] text-brand rounded-xl text-center animate-pulse">
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
                        ${numCards === n ? 'bg-brand/15 border-brand/40 text-brand' : 'bg-surface border-border text-muted hover:text-white'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multiplier preview for selected card count */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Payouts ({numCards} cards)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[16, 17, 18, 19, 20, 21].map(val => (
                    <div key={val} className={`bg-surface rounded-lg p-2 border border-border text-center
                      ${gameState === 'finished' && total === val && isWin ? 'border-brand/50 bg-brand/10' : ''}`}>
                      <div className="text-[10px] text-muted">{val}</div>
                      <div className={`text-[12px] font-bold font-mono ${gameState === 'finished' && total === val && isWin ? 'text-brand' : 'text-white'}`}>{fmtMult(currentTable[val])}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Result */}
              <AnimatePresence>
                {gameState === 'finished' && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className={`rounded-xl p-3.5 text-center border ${isWin ? 'bg-brand/[0.06] border-brand/20' : 'bg-accent-red/10 border-accent-red/30'}`}>
                    <div className={`text-xl font-bold font-mono ${isWin ? 'text-brand' : 'text-accent-red'}`}>
                      {isWin ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {isWin ? `${fmtMult(winMultiplier)} multiplier` : isBust ? 'Bust — over 21' : 'Under 16'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* Right: Game Area */}
            <div className="flex-1 min-w-0 space-y-4">

            {/* Multiplier Grid + Total */}
            <div
              className="rounded-2xl border border-border/60 p-5"
              style={{
                background: 'linear-gradient(165deg, rgba(30,30,45,0.6) 0%, rgba(15,15,20,0.6) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              <div className="flex gap-4">
                {/* 3×2 multiplier grid */}
                <div className="grid grid-cols-2 gap-2.5 flex-1">
                  {[16, 17, 18, 19, 20, 21].map(val => {
                    const mult = currentTable[val]
                    const isHit = gameState === 'finished' && total === val && isWin

                    return (
                      <motion.div
                        key={`${val}-${numCards}`}
                        animate={isHit ? { scale: [1, 1.06, 1] } : {}}
                        transition={isHit ? { repeat: 2, duration: 0.3 } : {}}
                        className={`
                          rounded-xl border px-4 py-3 flex items-center justify-between transition-all duration-300
                          ${isHit
                            ? 'bg-brand/15 border-brand/50 shadow-lg shadow-brand/15'
                            : 'bg-surface-light/20 border-border-light/30 hover:bg-surface-light/30'}
                        `}
                      >
                        <span className={`text-xl font-bold tabular-nums ${
                          isHit ? 'text-brand' : 'text-text-primary'
                        }`}>
                          {val}
                        </span>
                        <span className={`font-mono font-bold text-sm border-b-2 pb-0.5 ${
                          isHit ? 'text-brand border-brand/40' :
                          mult >= 10 ? 'text-cyan-400 border-cyan-400/25' :
                          'text-cyan-400/80 border-cyan-400/15'
                        }`}>
                          {fmtMult(mult)}
                        </span>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Total */}
                <div className={`
                  w-32 sm:w-36 rounded-xl border flex flex-col items-center justify-center shrink-0 transition-all duration-500
                  ${isWin ? 'bg-brand/10 border-brand/30' :
                    (isBust || isLow) ? 'bg-accent-red/10 border-red-500/25' :
                    'bg-surface-light/15 border-border-light/30'}
                `}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={total}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className={`text-6xl sm:text-7xl font-bold font-mono tabular-nums ${
                        isWin ? 'text-brand' :
                        (isBust || isLow) ? 'text-accent-red' :
                        total > 0 ? 'text-text-primary' : 'text-text-muted/30'
                      }`}
                    >
                      {total}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-text-muted text-sm mt-1">Total</span>
                </div>
              </div>
            </div>

            {/* Card Area */}
            <div
              className="rounded-2xl border border-dashed border-border/50 overflow-hidden"
              style={{
                background: 'linear-gradient(165deg, rgba(30,30,45,0.4) 0%, rgba(15,15,20,0.4) 100%)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-center gap-2.5 pt-5 pb-3">
                <span className="text-text-muted/60">♠</span>
                <span className="text-accent-red/60">♥</span>
                <span className="text-text-secondary font-bold text-sm tracking-[0.2em] uppercase">Twenty One</span>
                <span className="text-accent-red/60">♦</span>
                <span className="text-text-muted/60">♣</span>
              </div>

              {/* Cards */}
              <div className="px-6 pb-7 pt-2">
                <div className="flex flex-wrap gap-3 items-center justify-center min-h-[150px]">
                  {gameState === 'betting' ? (
                    [...Array(numCards)].map((_, i) => (
                      <motion.div
                        key={`fd-${i}-${numCards}`}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.2 }}
                      >
                        <FaceDownCard />
                      </motion.div>
                    ))
                  ) : (
                    cards.map((card, i) => (
                      <RevealedCard
                        key={`rv-${i}-${card.value}${card.suit}`}
                        card={card}
                        index={i}
                        won={isWin}
                        bust={isBust}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            <LiveBetsTable game="twentyone" />
          </div>
          </div>
        </div>

        <FairnessModal
          isOpen={showFairness}
          onClose={() => setShowFairness(false)}
          game="twentyone"
          serverSeedHash={serverSeedHash}
          clientSeed={clientSeed}
          nonce={nonce}
          previousServerSeed={previousServerSeed}
          onClientSeedChange={setClientSeed}
          onRotateSeed={rotateSeed}
        />
      </div>
    </GameLayout>
  )
}

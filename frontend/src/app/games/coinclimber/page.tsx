'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameLayout } from '@/components/GameLayout'
import { FairnessModal } from '@/components/FairnessModal'
import { useProvablyFair } from '@/hooks/useProvablyFair'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { Sparkles, RotateCcw, Zap, TrendingUp, Coins, Skull, Crown, CircleDot } from 'lucide-react'
import { BetControls, LiveBetsTable, SessionStatsBar, useSessionStats, GameSettingsDropdown } from '@/components/game'
import { toast } from 'sonner'

/* ── Config ────────────────────────────────────────── */
const MAX_LEVELS = 10

const DIFFICULTY_PRESETS = [
  { label: 'Easy',   cols: 4, color: 'text-brand',     bg: 'bg-brand/15 border-brand/40',         accent: '#00E87B' },
  { label: 'Medium', cols: 3, color: 'text-amber-400', bg: 'bg-amber-400/15 border-amber-400/40', accent: '#FBBF24' },
  { label: 'Hard',   cols: 2, color: 'text-red-400',   bg: 'bg-red-400/15 border-red-400/40',     accent: '#F87171' },
]

const getMultiplier = (cols: number, level: number): number => {
  if (level === 0) return 1
  const edge = 0.97
  let mult = 1
  for (let i = 0; i < level; i++) mult *= cols * edge
  return parseFloat(mult.toFixed(2))
}

interface Level { correctIndex: number }

/* ── Floating coins background ─────────────────────── */
const COIN_PARTICLE_COLORS = ['#facc15', '#fbbf24', '#f59e0b', '#eab308', '#ca8a04', '#fde68a', '#fef08a', '#d97706']
function FloatingCoins({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {COIN_PARTICLE_COLORS.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: '110%', x: `${10 + i * 11}%`, rotate: 0 }}
          animate={{
            opacity: [0, 0.5, 0],
            y: '-5%',
            x: `${10 + i * 11 + (Math.random() - 0.5) * 15}%`,
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
          className="absolute w-2 h-2 rounded-full"
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

/* ── Height meter ──────────────────────────────────── */
function HeightMeter({ level, maxLevel, active }: { level: number; maxLevel: number; active: boolean }) {
  const pct = (level / maxLevel) * 100
  return (
    <div className="hidden lg:flex flex-col items-center gap-1 w-6 shrink-0">
      <span className="text-[9px] text-amber-400/60 font-mono">TOP</span>
      <div className="flex-1 w-1.5 rounded-full bg-white/[0.04] relative overflow-hidden min-h-[200px]">
        <motion.div
          animate={{ height: `${pct}%` }}
          transition={{ type: 'spring', damping: 15 }}
          className="absolute bottom-0 w-full rounded-full"
          style={{ background: `linear-gradient(to top, #00E87B, #FBBF24)` }}
        />
        {active && level > 0 && (
          <motion.div
            animate={{ bottom: `${pct - 3}%`, scale: [1, 1.3, 1] }}
            transition={{ scale: { repeat: Infinity, duration: 1.5 } }}
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-brand shadow-lg shadow-brand/50 border border-brand/60"
          />
        )}
      </div>
      <span className="text-[9px] text-white/20 font-mono">GND</span>
    </div>
  )
}

export default function CoinClimberPage() {
  const { initialized, serverSeedHash, clientSeed, nonce, previousServerSeed, generateBet, rotateSeed, setClientSeed } = useProvablyFair()
  const { isAuthenticated } = useAuthStore()
  const { placeBet, isPlacing } = useGameStore()
  const sessionStats = useSessionStats()

  const [betAmount, setBetAmount] = useState('10.00')
  const [difficulty, setDifficulty] = useState(1)
  const [showFairness, setShowFairness] = useState(false)

  const [gameActive, setGameActive] = useState(false)
  const [currentLevel, setCurrentLevel] = useState(0)
  const [levels, setLevels] = useState<Level[]>([])
  const [picked, setPicked] = useState<{ level: number; col: number }[]>([])
  const [hitWrong, setHitWrong] = useState<{ level: number; col: number } | null>(null)
  const [cashedOut, setCashedOut] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const cols = DIFFICULTY_PRESETS[difficulty].cols
  const currentMult = getMultiplier(cols, currentLevel)
  const nextMult = getMultiplier(cols, currentLevel + 1)
  const diffPreset = DIFFICULTY_PRESETS[difficulty]

  useEffect(() => {
    if (scrollRef.current && currentLevel > 0) scrollRef.current.scrollTop = 0
  }, [currentLevel])

  const generateLevels = useCallback(async (): Promise<Level[]> => {
    const r: Level[] = []
    for (let i = 0; i < MAX_LEVELS; i++) {
      const { result } = await generateBet('coinclimber', { level: i, cols })
      const n = typeof result === 'number' ? result : parseInt(String(result), 16)
      r.push({ correctIndex: Math.abs(n) % cols })
    }
    return r
  }, [generateBet, cols])

  const startGame = async () => {
    if (parseFloat(betAmount) <= 0 || !initialized || isPlacing) return
    try {
      const nl = await generateLevels()
      setLevels(nl); setCurrentLevel(0); setPicked([]); setHitWrong(null); setCashedOut(false); setGameActive(true)
    } catch (err: any) { toast.error(err?.message || 'Error starting game') }
  }

  const pickTile = (level: number, col: number) => {
    if (!gameActive || level !== currentLevel || hitWrong || cashedOut) return
    const isCorrect = levels[level].correctIndex === col
    setPicked(p => [...p, { level, col }])
    if (!isCorrect) {
      setHitWrong({ level, col }); setGameActive(false)
      sessionStats.recordBet(false, parseFloat(betAmount), -parseFloat(betAmount), 0)
      toast.error('Wrong step! You fell.')
    } else if (level + 1 >= MAX_LEVELS) {
      setCurrentLevel(level + 1); setGameActive(false); setCashedOut(true)
      const fm = getMultiplier(cols, level + 1)
      sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * fm - parseFloat(betAmount), fm)
      toast.success(`Summit! Won $${(parseFloat(betAmount) * fm).toFixed(2)}!`)
    } else { setCurrentLevel(level + 1) }
  }

  const cashout = () => {
    if (!gameActive || currentLevel === 0) return
    setCashedOut(true); setGameActive(false)
    sessionStats.recordBet(true, parseFloat(betAmount), parseFloat(betAmount) * currentMult - parseFloat(betAmount), currentMult)
    toast.success(`Cashed out $${(parseFloat(betAmount) * currentMult).toFixed(2)}!`)
  }

  const resetGame = () => {
    setGameActive(false); setCurrentLevel(0); setLevels([]); setPicked([]); setHitWrong(null); setCashedOut(false)
  }

  const visibleLevels = Array.from({ length: MAX_LEVELS }, (_, i) => MAX_LEVELS - 1 - i)
  const gameEnded = !!hitWrong || cashedOut

  return (
    <GameLayout>
      <div className="p-3 sm:p-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <SessionStatsBar />

          <div className="flex flex-col lg:flex-row gap-4">
            {/* ── Left: Controls ─────────────────────── */}
            <BetControls
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              disabled={gameActive}
              serverSeedHash={serverSeedHash}
              nonce={nonce}
              onShowFairness={() => setShowFairness(true)}
              showAutoTab={false}
              actionButton={
                !gameActive && !gameEnded ? (
                  <button onClick={startGame} disabled={parseFloat(betAmount) <= 0 || !initialized}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-background-deep font-bold text-[14px] rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />Start Climbing
                  </button>
                ) : gameActive && currentLevel > 0 ? (
                  <motion.button onClick={cashout}
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-full py-3.5 bg-gradient-to-r from-brand via-emerald-400 to-brand text-background-deep font-bold text-[14px] rounded-xl shadow-lg shadow-brand/30 hover:shadow-brand/50 transition-all flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />Cash Out ${(parseFloat(betAmount) * currentMult).toFixed(2)}
                  </motion.button>
                ) : gameActive ? (
                  <div className="w-full py-3.5 bg-surface border border-amber-400/30 font-bold text-[14px] text-amber-400 rounded-xl text-center">
                    <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                      Pick the right step!
                    </motion.span>
                  </div>
                ) : (
                  <button onClick={resetGame}
                    className={`w-full py-3.5 font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2
                      ${hitWrong ? 'bg-gradient-to-r from-red-500 to-red-400 text-white shadow-lg shadow-red-500/25' : 'bg-gradient-to-r from-amber-500 to-amber-400 text-background-deep shadow-lg shadow-amber-500/25'}`}>
                    <RotateCcw className="w-4 h-4" />Play Again
                  </button>
                )
              }
            >
              {/* Difficulty */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Difficulty</span>
                <div className="flex gap-1.5">
                  {DIFFICULTY_PRESETS.map((d, i) => (
                    <button key={d.label} onClick={() => !gameActive && setDifficulty(i)} disabled={gameActive}
                      className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all disabled:opacity-50
                        ${difficulty === i ? `${d.bg} ${d.color}` : 'bg-surface border-border text-muted hover:text-white'}`}>
                      {d.label}
                      <div className="text-[10px] font-normal opacity-70">{d.cols} cols</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Level</div>
                  <div className="text-base font-bold text-brand font-mono">{currentLevel}/{MAX_LEVELS}</div>
                </div>
                <div className="bg-surface rounded-xl p-2.5 border border-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Next</div>
                  <div className="text-base font-bold text-amber-400 font-mono">{nextMult.toFixed(2)}x</div>
                </div>
              </div>

              {/* Active multiplier */}
              <AnimatePresence>
                {gameActive && currentLevel > 0 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative overflow-hidden rounded-xl border border-amber-400/20">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.08] via-amber-400/[0.04] to-amber-500/[0.08]" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(251,191,36,0.08),transparent_70%)]" />
                    <div className="relative flex items-center justify-between p-3.5">
                      <div>
                        <div className="text-[10px] text-muted uppercase mb-0.5">Multiplier</div>
                        <div className="text-2xl text-amber-400 font-black font-mono animate-multiplier-glow">{currentMult.toFixed(2)}x</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted uppercase mb-0.5">Payout</div>
                        <div className="text-2xl text-amber-400 font-black font-mono">${(parseFloat(betAmount) * currentMult).toFixed(2)}</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BetControls>

            {/* ── Right: Tower Scene ─────────────────── */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
                style={{ background: 'linear-gradient(180deg, #14100a 0%, #0f0d0a 25%, #0c0e12 100%)' }}>

                {/* Floating coins */}
                <FloatingCoins active={gameActive && currentLevel > 0} />

                {/* Top bar */}
                <div className="relative z-10 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/[0.05]"
                  style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3), transparent)' }}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-600/15 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
                        <Coins className="w-6 h-6 text-amber-400" />
                      </div>
                      {gameActive && (
                        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.3, 0.8] }} transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-white font-bold text-[15px] tracking-tight">Coin Climber</div>
                      <div className="text-[11px] text-white/35">Climb higher, earn more</div>
                    </div>
                  </div>

                  {/* Level & progress */}
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-[3px] bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/[0.05]">
                      {Array.from({ length: MAX_LEVELS }, (_, i) => (
                        <motion.div key={i}
                          animate={i === currentLevel && gameActive ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ repeat: Infinity, duration: 1 }}
                          className={`w-[6px] h-[6px] rounded-full transition-all duration-500
                          ${i < currentLevel ? 'bg-amber-400 shadow-sm shadow-amber-400/60'
                            : i === currentLevel && gameActive ? 'bg-brand'
                            : 'bg-white/[0.08]'}`} />
                      ))}
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08]">
                      <span className="text-amber-400 font-mono font-bold text-sm">{currentLevel}</span>
                      <span className="text-white/25 text-xs">/{MAX_LEVELS}</span>
                    </div>
                    <GameSettingsDropdown />
                  </div>
                </div>

                {/* Tower grid with height meter */}
                <div className="relative flex gap-2 p-3 sm:p-4">
                  {/* Height meter */}
                  <HeightMeter level={currentLevel} maxLevel={MAX_LEVELS} active={gameActive} />

                  <div className="flex-1 min-w-0">
                    {/* Summit */}
                    <div className="relative mb-2 group">
                      <div className="absolute inset-0 rounded-xl bg-amber-400/5 blur-xl group-hover:bg-amber-400/10 transition-colors" />
                      <div className="relative flex items-center gap-3 py-3 px-4 rounded-xl border border-amber-400/20 overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.02) 50%, rgba(251,191,36,0.06) 100%)' }}>
                        <div className="absolute inset-0 opacity-[0.03]" style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(251,191,36,0.2) 8px, rgba(251,191,36,0.2) 9px)'
                        }} />
                        <Crown className="relative w-5 h-5 text-amber-400" />
                        <div className="relative">
                          <div className="text-amber-400 text-[13px] font-bold tracking-wide">SUMMIT</div>
                          <div className="text-amber-400/40 text-[10px]">Maximum payout</div>
                        </div>
                        <div className="relative ml-auto">
                          <span className="text-amber-400 font-mono font-black text-lg">{getMultiplier(cols, MAX_LEVELS).toFixed(2)}x</span>
                        </div>
                      </div>
                    </div>

                    {/* Level grid */}
                    <div ref={scrollRef} className="space-y-[3px] max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
                      {visibleLevels.map(lvl => {
                        const isCurrentLevel = gameActive && lvl === currentLevel
                        const isPastLevel = lvl < currentLevel
                        const isFutureLevel = lvl > currentLevel
                        const levelPick = picked.find(p => p.level === lvl)
                        const isWrongLevel = hitWrong?.level === lvl
                        const multiplier = getMultiplier(cols, lvl + 1)
                        const heightPct = (lvl + 1) / MAX_LEVELS

                        // Sky gradient changes with height
                        const levelBg = isCurrentLevel
                          ? `rgba(251,191,36,0.04)`
                          : isPastLevel
                          ? `rgba(0,232,123,0.02)`
                          : 'transparent'

                        return (
                          <motion.div
                            key={lvl}
                            layout
                            initial={false}
                            animate={{ opacity: isFutureLevel && !gameEnded ? 0.25 + heightPct * 0.2 : 1 }}
                          >
                            <div className={`relative flex items-center gap-2 py-[3px] px-1.5 rounded-xl transition-all duration-300
                              ${isCurrentLevel ? 'z-10' : ''}`}
                              style={{ background: levelBg }}>

                              {/* Level badge */}
                              <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold font-mono shrink-0 overflow-hidden transition-all duration-300
                                ${isCurrentLevel ? 'text-brand' : isPastLevel ? 'text-amber-400' : 'text-white/20'}`}>
                                <div className={`absolute inset-0 rounded-lg transition-all duration-300
                                  ${isCurrentLevel
                                    ? 'bg-brand/15 border border-brand/40 shadow-lg shadow-brand/10'
                                    : isPastLevel
                                    ? 'bg-amber-400/10 border border-amber-400/20'
                                    : 'bg-white/[0.03] border border-white/[0.05]'
                                  }`} />
                                <span className="relative z-10 flex items-center justify-center">{isPastLevel ? <Coins className="w-3.5 h-3.5 text-amber-400" /> : lvl + 1}</span>
                                {isCurrentLevel && (
                                  <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }} transition={{ repeat: Infinity, duration: 1.8 }}
                                    className="absolute inset-0 rounded-lg border-2 border-brand/50" />
                                )}
                              </div>

                              {/* Tiles */}
                              <div className={`flex-1 flex gap-[5px] p-[5px] rounded-xl transition-all duration-300
                                ${isCurrentLevel
                                  ? 'ring-1 ring-brand/15'
                                  : ''}`}>
                                {Array.from({ length: cols }, (_, c) => {
                                  const wasPicked = levelPick?.col === c
                                  const isCorrectTile = levels[lvl]?.correctIndex === c
                                  const showResult = isPastLevel || isWrongLevel || cashedOut
                                  const isCorrectRevealed = showResult && isCorrectTile
                                  const isWrongPick = isWrongLevel && wasPicked && !isCorrectTile

                                  return (
                                    <motion.button
                                      key={c}
                                      onClick={() => pickTile(lvl, c)}
                                      disabled={!isCurrentLevel || !!hitWrong || cashedOut}
                                      whileHover={isCurrentLevel && !hitWrong ? { scale: 1.06, y: -3, transition: { duration: 0.15 } } : {}}
                                      whileTap={isCurrentLevel && !hitWrong ? { scale: 0.93 } : {}}
                                      className={`relative flex-1 h-[50px] sm:h-[54px] rounded-xl font-bold transition-all duration-200 flex items-center justify-center overflow-hidden
                                        ${isWrongPick
                                          ? 'shadow-2xl shadow-red-500/30'
                                          : isCorrectRevealed && wasPicked
                                          ? 'shadow-lg shadow-amber-400/25'
                                          : isCurrentLevel
                                          ? 'cursor-pointer hover:shadow-xl hover:shadow-brand/10'
                                          : 'cursor-default'
                                        }`}
                                      style={{
                                        background: isWrongPick
                                          ? 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(239,68,68,0.1))'
                                          : isCorrectRevealed && wasPicked
                                          ? 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.1))'
                                          : isCorrectRevealed
                                          ? 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.03))'
                                          : showResult && !isCorrectTile
                                          ? 'rgba(255,255,255,0.01)'
                                          : isCurrentLevel
                                          ? 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
                                          : 'rgba(255,255,255,0.015)',
                                      }}
                                    >
                                      {/* Ring */}
                                      <div className={`absolute inset-0 rounded-xl transition-all duration-200
                                        ${isWrongPick
                                          ? 'ring-2 ring-red-500/60'
                                          : isCorrectRevealed && wasPicked
                                          ? 'ring-2 ring-amber-400/50'
                                          : isCorrectRevealed
                                          ? 'ring-1 ring-amber-400/15'
                                          : showResult && !isCorrectTile
                                          ? 'ring-1 ring-white/[0.03]'
                                          : isCurrentLevel
                                          ? 'ring-1 ring-white/[0.08] hover:ring-brand/30'
                                          : 'ring-1 ring-white/[0.03]'
                                        }`} />

                                      {/* Brick texture for platforms */}
                                      {!showResult && (
                                        <div className="absolute inset-0 opacity-[0.02]" style={{
                                          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 12px, rgba(255,255,255,0.2) 12px, rgba(255,255,255,0.2) 13px),
                                            repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(255,255,255,0.1) 24px, rgba(255,255,255,0.1) 25px)`,
                                        }} />
                                      )}

                                      {/* Content */}
                                      <div className="relative z-10">
                                        {isWrongPick ? (
                                          <motion.div initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }}
                                            transition={{ type: 'spring', damping: 8 }}
                                            className="flex flex-col items-center">
                                            <Skull className="w-6 h-6 text-red-400" />
                                            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                                              className="text-[8px] text-red-400 font-black uppercase tracking-widest">FALL</motion.span>
                                          </motion.div>
                                        ) : isCorrectRevealed && wasPicked ? (
                                          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                                            transition={{ type: 'spring', damping: 12 }}>
                                            <Coins className="w-5 h-5 text-amber-400" />
                                          </motion.div>
                                        ) : isCorrectRevealed ? (
                                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.25 }}
                                            className="text-sm select-none flex items-center justify-center"><Coins className="w-3.5 h-3.5 text-amber-400/25" /></motion.span>
                                        ) : showResult && !isCorrectTile ? (
                                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.1 }}
                                            className="text-xs select-none text-white/20">·</motion.span>
                                        ) : isCurrentLevel ? (
                                          <motion.span animate={{ y: [0, -2, 0], opacity: [0.2, 0.45, 0.2] }}
                                            transition={{ repeat: Infinity, duration: 2.5, delay: c * 0.2 }}
                                            className="text-base select-none">?</motion.span>
                                        ) : null}
                                      </div>
                                    </motion.button>
                                  )
                                })}
                              </div>

                              {/* Multiplier badge */}
                              <div className="w-[62px] shrink-0 text-right">
                                <span className={`inline-block px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all
                                  ${isCurrentLevel
                                    ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                                    : isPastLevel
                                    ? 'text-amber-400/50'
                                    : 'text-white/15'
                                  }`}>
                                  {multiplier.toFixed(2)}x
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* Ground / Start */}
                    <div className="mt-2">
                      <div className="flex items-center gap-3 py-2.5 px-4 rounded-xl border border-white/[0.05]"
                        style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.015), transparent, rgba(255,255,255,0.015))' }}>
                        <TrendingUp className="w-4 h-4 text-white/30" />
                        <div>
                          <div className="text-white/50 text-[12px] font-bold">GROUND</div>
                          <div className="text-white/20 text-[10px]">Begin your ascent</div>
                        </div>
                        <span className="ml-auto text-white/15 font-mono text-[11px]">1.00x</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Result overlay */}
                <AnimatePresence>
                  {gameEnded && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ type: 'spring', damping: 15 }}
                      className="relative mx-4 mb-4"
                    >
                      <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-sm
                        ${hitWrong ? 'border-red-500/25' : 'border-amber-400/25'}`}>
                        {/* Gradient BG */}
                        <div className={`absolute inset-0 ${hitWrong
                          ? 'bg-gradient-to-br from-red-500/15 via-red-900/10 to-transparent'
                          : 'bg-gradient-to-br from-amber-400/15 via-amber-900/10 to-transparent'}`} />
                        <div className={`absolute inset-0 ${hitWrong
                          ? 'bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.15),transparent_70%)]'
                          : 'bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.15),transparent_70%)]'}`} />

                        <div className="relative p-6 text-center">
                          <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 10, delay: 0.1 }}
                            className="text-5xl mb-3">
                            {hitWrong ? <Skull className="w-12 h-12 text-red-400" /> : <Crown className="w-12 h-12 text-amber-400" />}
                          </motion.div>
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10, delay: 0.25 }}
                            className={`text-3xl font-black font-mono mb-1 ${hitWrong ? 'text-red-400' : 'text-amber-400 animate-multiplier-glow'}`}>
                            {hitWrong ? 'FELL OFF' : `${currentMult.toFixed(2)}x`}
                          </motion.div>
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                            className={`text-sm font-medium ${hitWrong ? 'text-red-400/60' : 'text-amber-400/60'}`}>
                            {hitWrong ? `Lost $${parseFloat(betAmount).toFixed(2)} at level ${hitWrong.level + 1}` : `Won $${(parseFloat(betAmount) * currentMult).toFixed(2)}`}
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <LiveBetsTable game="coinclimber" />
            </div>
          </div>
        </div>
      </div>

      <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} game="coinclimber"
        serverSeedHash={serverSeedHash} clientSeed={clientSeed} nonce={nonce}
        previousServerSeed={previousServerSeed} onClientSeedChange={setClientSeed} onRotateSeed={rotateSeed} />
    </GameLayout>
  )
}

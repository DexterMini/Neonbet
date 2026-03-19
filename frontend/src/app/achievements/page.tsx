'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Star, Zap, Target, Compass, Award, Lock, ChevronRight, Flame } from 'lucide-react'
import { useProgressionStore, ACHIEVEMENTS, XP_LEVELS, Achievement } from '@/stores/progressionStore'

/* ── daily challenges ─────────────────────────────── */
const DAILY_CHALLENGES = [
  { id: 'daily-bets-10', title: 'Daily Grind', description: 'Place 10 bets today', type: 'bets' as const, target: 10, xp: 25 },
  { id: 'daily-wins-5', title: 'Winner Winner', description: 'Win 5 bets today', type: 'wins' as const, target: 5, xp: 40 },
  { id: 'daily-wager-500', title: 'Big Spender', description: 'Wager $500 today', type: 'wagered' as const, target: 500, xp: 50 },
]

const CATEGORY_INFO = {
  betting: { icon: Target, label: 'Betting', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  winning: { icon: Trophy, label: 'Winning', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  exploration: { icon: Compass, label: 'Exploration', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  social: { icon: Star, label: 'Social', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  milestone: { icon: Award, label: 'Milestones', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
}

export default function AchievementsPage() {
  const store = useProgressionStore()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const unlocked = new Set(store.unlockedAchievements)
  const totalAch = ACHIEVEMENTS.length
  const unlockedCount = store.unlockedAchievements.length

  // Current level info
  const currentLevelInfo = XP_LEVELS.find(l => l.level === store.level) || XP_LEVELS[0]
  const nextLevelInfo = XP_LEVELS.find(l => l.level === store.level + 1)
  const xpInLevel = store.xp - currentLevelInfo.xpNeeded
  const xpForNext = nextLevelInfo ? nextLevelInfo.xpNeeded - currentLevelInfo.xpNeeded : 1
  const xpProgress = nextLevelInfo ? Math.min(xpInLevel / xpForNext, 1) : 1

  // Filter achievements
  const filtered = selectedCategory === 'all' ? ACHIEVEMENTS :
    ACHIEVEMENTS.filter(a => a.category === selectedCategory)

  // Daily challenge progress
  const dailyProgress = (type: 'bets' | 'wins' | 'wagered') => {
    if (type === 'bets') return store.dailyBets
    if (type === 'wins') return store.dailyWins
    return store.dailyWagered
  }

  const categories = ['all', 'betting', 'winning', 'exploration', 'milestone'] as const

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/10 rounded-full blur-[100px]" />

        <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30">
              <Trophy className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Achievements & Progression</h1>
              <p className="text-sm text-gray-400">Track your journey and unlock rewards</p>
            </div>
          </div>

          {/* Level card */}
          <div className="bg-[#111827]/90 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-violet-500/20">
                    {store.level}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-violet-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    LVL
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold">{currentLevelInfo.title}</h2>
                  <p className="text-sm text-gray-400">{store.xp.toLocaleString()} XP total</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Achievements</div>
                <div className="text-xl font-bold text-violet-400">{unlockedCount}<span className="text-gray-500">/{totalAch}</span></div>
              </div>
            </div>

            {/* XP bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Level {store.level}</span>
                <span>{nextLevelInfo ? `${xpInLevel.toLocaleString()} / ${xpForNext.toLocaleString()} XP` : 'MAX LEVEL'}</span>
                <span>{nextLevelInfo ? `Level ${store.level + 1}` : '✨'}</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress * 100}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Bets', value: store.totalBets.toLocaleString(), icon: '🎲' },
              { label: 'Total Wins', value: store.totalWins.toLocaleString(), icon: '🏆' },
              { label: 'Best Multi', value: `${store.bestMultiplier.toFixed(2)}x`, icon: '🚀' },
              { label: 'Best Streak', value: store.bestStreak.toString(), icon: '🔥' },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#111827]/80 border border-gray-700/40 rounded-xl p-3 text-center">
                <div className="text-lg mb-1">{stat.icon}</div>
                <div className="text-lg font-bold">{stat.value}</div>
                <div className="text-xs text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* Daily challenges */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold">Daily Challenges</h2>
            <span className="text-xs text-gray-500 ml-2">Resets at midnight UTC</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {DAILY_CHALLENGES.map((ch) => {
              const progress = dailyProgress(ch.type)
              const pct = Math.min(progress / ch.target, 1)
              const done = pct >= 1
              return (
                <motion.div
                  key={ch.id}
                  className={`relative overflow-hidden rounded-xl border p-4 transition-colors ${
                    done ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-[#111827]/80 border-gray-700/40'
                  }`}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">{ch.title}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700/50 text-gray-400'
                    }`}>
                      +{ch.xp} XP
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{ch.description}</p>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-violet-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct * 100}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-right">
                    {ch.type === 'wagered' ? `$${progress.toFixed(0)}` : progress} / {ch.type === 'wagered' ? `$${ch.target}` : ch.target}
                  </div>
                  {done && (
                    <div className="absolute top-2 right-2 text-emerald-400">✓</div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin">
          {categories.map((cat) => {
            const info = cat === 'all' ? null : CATEGORY_INFO[cat]
            const count = cat === 'all' ? ACHIEVEMENTS.length : ACHIEVEMENTS.filter(a => a.category === cat).length
            const unlockedInCat = cat === 'all' ? unlockedCount :
              ACHIEVEMENTS.filter(a => a.category === cat && unlocked.has(a.id)).length
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                    : 'bg-[#111827]/60 text-gray-400 border border-gray-700/40 hover:border-gray-600/60'
                }`}
              >
                {info && <info.icon className="w-4 h-4" />}
                {cat === 'all' ? 'All' : info?.label}
                <span className="text-xs opacity-60">{unlockedInCat}/{count}</span>
              </button>
            )
          })}
        </div>

        {/* Achievement grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((ach, i) => {
              const isUnlocked = unlocked.has(ach.id)
              const catInfo = CATEGORY_INFO[ach.category]
              return (
                <motion.div
                  key={ach.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.02 }}
                  className={`relative rounded-xl border p-4 transition-all ${
                    isUnlocked
                      ? `${catInfo.bg} ${catInfo.border}`
                      : 'bg-[#111827]/40 border-gray-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-40'}`}>
                      {ach.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-sm ${isUnlocked ? 'text-white' : 'text-gray-500'}`}>
                          {ach.title}
                        </h3>
                        {!isUnlocked && <Lock className="w-3 h-3 text-gray-600" />}
                      </div>
                      <p className={`text-xs mt-0.5 ${isUnlocked ? 'text-gray-300' : 'text-gray-600'}`}>
                        {ach.description}
                      </p>
                    </div>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isUnlocked ? 'bg-violet-500/20 text-violet-400' : 'bg-gray-800 text-gray-600'
                    }`}>
                      {isUnlocked ? `✓ +${ach.xpReward}` : `+${ach.xpReward} XP`}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Level progression table */}
        <div className="mt-10 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Level Progression
          </h2>
          <div className="bg-[#111827]/80 border border-gray-700/40 rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 text-xs text-gray-400 font-medium px-4 py-3 border-b border-gray-700/40">
              <div>Level</div>
              <div>Title</div>
              <div>XP Required</div>
              <div className="text-right">Status</div>
            </div>
            {XP_LEVELS.map((lvl) => {
              const isCurrent = lvl.level === store.level
              const isReached = lvl.level <= store.level
              return (
                <div
                  key={lvl.level}
                  className={`grid grid-cols-4 text-sm px-4 py-2.5 border-b border-gray-800/40 last:border-0 ${
                    isCurrent ? 'bg-violet-500/10' : ''
                  }`}
                >
                  <div className={`font-bold ${isReached ? 'text-violet-400' : 'text-gray-600'}`}>
                    {lvl.level}
                  </div>
                  <div className={isReached ? 'text-white' : 'text-gray-600'}>
                    {lvl.title}
                  </div>
                  <div className={isReached ? 'text-gray-300' : 'text-gray-600'}>
                    {lvl.xpNeeded.toLocaleString()} XP
                  </div>
                  <div className="text-right">
                    {isCurrent ? (
                      <span className="text-xs font-medium text-violet-400 bg-violet-500/20 px-2 py-0.5 rounded-full">
                        CURRENT
                      </span>
                    ) : isReached ? (
                      <span className="text-xs text-emerald-400">✓</span>
                    ) : (
                      <span className="text-xs text-gray-600">
                        <Lock className="w-3 h-3 inline" />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

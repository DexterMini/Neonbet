'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GameLayout } from '@/components/GameLayout'
import { Crown, Gift, Zap, Shield, Trophy, Lock, Check, Award, Gem, Star } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'

const vipIcons: Record<number, React.ElementType> = {
  1: Award,
  2: Shield,
  3: Star,
  4: Gem,
  5: Crown,
}

const vipLevels = [
  { level: 1, name: 'Bronze', color: 'from-amber-700 to-amber-900', iconColor: 'text-amber-300', wager: 0, rakeback: '5%', unlocked: true },
  { level: 2, name: 'Silver', color: 'from-slate-400 to-slate-600', iconColor: 'text-slate-200', wager: 5000, rakeback: '10%', unlocked: false },
  { level: 3, name: 'Gold', color: 'from-yellow-500 to-amber-600', iconColor: 'text-yellow-200', wager: 25000, rakeback: '15%', unlocked: false },
  { level: 4, name: 'Platinum', color: 'from-cyan-400 to-blue-600', iconColor: 'text-cyan-200', wager: 100000, rakeback: '20%', unlocked: false },
  { level: 5, name: 'Diamond', color: 'from-violet-500 to-purple-700', iconColor: 'text-violet-200', wager: 500000, rakeback: '25%', unlocked: false },
]

const perks = [
  { icon: Gift, title: 'Bonuses', desc: 'Daily & weekly rewards' },
  { icon: Zap, title: 'Rakeback', desc: 'Instant bet returns' },
  { icon: Shield, title: 'Support', desc: '24/7 VIP support' },
  { icon: Trophy, title: 'Events', desc: 'Exclusive tournaments' },
]

export default function VIPPage() {
  const { token, isAuthenticated, isHydrated } = useAuthStore()
  const [totalWagered, setTotalWagered] = useState(0)
  const [selected, setSelected] = useState(vipLevels[0])

  // Fetch real wagered amount from bet stats
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token) return
    fetch('/api/v1/bets/stats/summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.total_wagered) setTotalWagered(parseFloat(d.total_wagered))
      })
      .catch(() => {})
  }, [isHydrated, isAuthenticated, token])

  // Derive current level from wagered amount
  const levelsWithUnlocked = vipLevels.map(l => ({
    ...l,
    unlocked: totalWagered >= l.wager,
  }))
  const currentLevelIdx = [...levelsWithUnlocked].reverse().findIndex(l => l.unlocked)
  const resolvedIdx = currentLevelIdx === -1 ? 0 : vipLevels.length - 1 - currentLevelIdx
  const currentLevel = levelsWithUnlocked[resolvedIdx]
  const nextLevel = levelsWithUnlocked[resolvedIdx + 1] || null
  const progress = nextLevel
    ? Math.min(100, ((totalWagered - currentLevel.wager) / (nextLevel.wager - currentLevel.wager)) * 100)
    : 100

  return (
    <GameLayout>
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-3">
              <Crown className="w-7 h-7 text-text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">VIP Club</h1>
            <p className="text-text-muted text-sm">Unlock rewards as you play</p>
          </div>

          {/* Current Level */}
          <div className="bg-surface/50 rounded-xl border border-border/60 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 bg-gradient-to-br ${currentLevel.color} rounded-xl flex items-center justify-center`}>
                  {(() => { const Icon = vipIcons[currentLevel.level] || Award; return <Icon className={`w-6 h-6 ${currentLevel.iconColor}`} /> })()}
                </div>
                <div>
                  <p className="text-xs text-text-muted">Current Level</p>
                  <p className="font-bold text-text-primary">{currentLevel.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">Rakeback</p>
                <p className="font-bold text-accent-green">{currentLevel.rakeback}</p>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">
                  {nextLevel ? `Progress to ${nextLevel.name}` : 'Max level reached'}
                </span>
                <span className="text-text-primary font-mono">
                  {formatCurrency(totalWagered)}{nextLevel ? ` / ${formatCurrency(nextLevel.wager)}` : ''}
                </span>
              </div>
              <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {/* Level Selector */}
          <div className="grid grid-cols-5 gap-2 mb-6">
            {levelsWithUnlocked.map((level) => (
              <button
                key={level.level}
                onClick={() => setSelected(level)}
                className={`relative p-3 rounded-lg border transition-all ${
                  selected.level === level.level
                    ? 'bg-surface-light/50 border-violet-500'
                    : 'bg-surface/50 border-border/60 hover:border-border-light'
                }`}
              >
                {!level.unlocked && <Lock className="absolute top-1.5 right-1.5 w-3 h-3 text-text-muted" />}
                <div className={`w-8 h-8 bg-gradient-to-br ${level.color} rounded-lg flex items-center justify-center mb-1`}>
                  {(() => { const Icon = vipIcons[level.level] || Award; return <Icon className={`w-4 h-4 ${level.iconColor || 'text-white'}`} /> })()}
                </div>
                <p className={`text-xs font-medium ${level.unlocked ? 'text-text-primary' : 'text-text-muted'}`}>
                  {level.name}
                </p>
              </button>
            ))}
          </div>

          {/* Selected Level Info */}
          <div className="bg-surface/50 rounded-xl border border-border/60 p-4 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 bg-gradient-to-br ${selected.color} rounded-lg flex items-center justify-center`}>
                {(() => { const Icon = vipIcons[selected.level] || Award; return <Icon className={`w-5 h-5 ${selected.iconColor || 'text-white'}`} /> })()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-text-primary">{selected.name}</p>
                <p className="text-xs text-text-muted">Wager {formatCurrency(selected.wager)} to unlock</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">Rakeback</p>
                <p className="font-bold text-brand">{selected.rakeback}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Daily Bonus', 'Weekly Rakeback', selected.level >= 3 ? 'VIP Host' : null, selected.level >= 4 ? 'Custom Limits' : null].filter(Boolean).map((perk, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-light rounded text-xs text-text-secondary">
                  <Check className="w-3 h-3 text-accent-green" /> {perk}
                </span>
              ))}
            </div>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {perks.map((perk) => (
              <div key={perk.title} className="bg-surface/50 rounded-lg border border-border/60 p-3">
                <perk.icon className="w-6 h-6 text-brand mb-2" />
                <p className="font-medium text-text-primary text-sm">{perk.title}</p>
                <p className="text-xs text-text-muted">{perk.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GameLayout>
  )
}

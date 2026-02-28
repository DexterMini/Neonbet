'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Trophy, Crown, Target, Gift, Clock, Users, Zap, 
  ChevronRight, Star, Flame, Calendar, Timer
} from 'lucide-react'

const promotions = [
  {
    id: 'daily-race',
    title: 'Daily Race',
    subtitle: '$10,000 Prize Pool',
    description: 'Compete against other players for a share of the daily prize pool. Top 100 players win!',
    icon: Trophy,
    gradient: 'from-accent-amber to-amber-400',
    prize: '$10,000',
    timeLeft: '8h 23m',
    participants: 1247,
    type: 'race'
  },
  {
    id: 'weekly-race',
    title: 'Weekly Race',
    subtitle: '$50,000 Prize Pool',
    description: 'The ultimate weekly competition. Wager more, climb higher, win bigger!',
    icon: Crown,
    gradient: 'from-brand to-brand-light',
    prize: '$50,000',
    timeLeft: '4d 12h',
    participants: 3841,
    type: 'race'
  },
  {
    id: 'challenges',
    title: 'Daily Challenges',
    subtitle: 'Complete & Earn',
    description: 'Complete daily challenges to unlock bonus rewards and exclusive perks.',
    icon: Target,
    gradient: 'from-accent-red to-rose-400',
    prize: 'Up to $500',
    challenges: 17,
    type: 'challenge'
  },
  {
    id: 'deposit-bonus',
    title: 'First Deposit Bonus',
    subtitle: '200% Match',
    description: 'Get a 200% bonus on your first deposit up to $1,000. Start big!',
    icon: Gift,
    gradient: 'from-accent-green to-emerald-400',
    bonus: '200%',
    maxBonus: '$1,000',
    type: 'bonus'
  },
  {
    id: 'reload',
    title: 'Weekend Reload',
    subtitle: '50% Bonus',
    description: 'Every weekend, get a 50% reload bonus on your deposits.',
    icon: Zap,
    gradient: 'from-accent-blue to-blue-400',
    bonus: '50%',
    maxBonus: '$500',
    type: 'bonus'
  },
  {
    id: 'rakeback',
    title: 'Instant Rakeback',
    subtitle: 'Up to 25%',
    description: 'Get instant cashback on every bet you place. The more you play, the more you earn.',
    icon: Star,
    gradient: 'from-brand to-brand-light',
    rakeback: 'Up to 25%',
    type: 'vip'
  },
]

const leaderboard = [
  { rank: 1, name: 'CryptoKing', wagered: '$245,000', prize: '$2,500' },
  { rank: 2, name: 'LuckyAce', wagered: '$189,000', prize: '$1,500' },
  { rank: 3, name: 'DiamondH...', wagered: '$156,000', prize: '$1,000' },
  { rank: 4, name: 'BetMaster', wagered: '$134,000', prize: '$750' },
  { rank: 5, name: 'NeonPro', wagered: '$98,000', prize: '$500' },
]

export default function PromotionsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'races' | 'bonuses'>('all')

  const filteredPromotions = promotions.filter(p => {
    if (activeTab === 'all') return true
    if (activeTab === 'races') return p.type === 'race' || p.type === 'challenge'
    if (activeTab === 'bonuses') return p.type === 'bonus' || p.type === 'vip'
    return true
  })

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-text-secondary hover:text-text-primary text-sm flex items-center gap-1 mb-4">
            ← Back to Casino
          </Link>
          <h1 className="text-4xl font-bold text-text-primary mb-2">Promotions</h1>
          <p className="text-text-secondary">Boost your winnings with exclusive offers and competitions</p>
        </div>

        {/* Featured Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-r from-brand via-brand-light to-brand-light rounded-3xl p-8 mb-8 overflow-hidden"
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -right-40 -top-40 w-80 h-80 bg-white rounded-full blur-3xl" />
            <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-5 h-5 text-yellow-300" />
                <span className="text-text-primary/80 text-sm font-medium">FEATURED PROMOTION</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-text-primary mb-2">Weekly Race</h2>
              <p className="text-text-primary/80 text-lg mb-4">$50,000 Prize Pool • Top 100 Winners</p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-text-primary/60" />
                  <span className="text-text-primary font-medium">4d 12h remaining</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-text-primary/60" />
                  <span className="text-text-primary font-medium">3,841 participants</span>
                </div>
              </div>
            </div>
            <button className="px-8 py-4 bg-white text-brand font-bold rounded-xl hover:bg-white/90 transition-colors whitespace-nowrap">
              Join Now
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { id: 'all', label: 'All' },
            { id: 'races', label: 'Races & Challenges' },
            { id: 'bonuses', label: 'Bonuses' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-full font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-brand to-brand-light text-text-primary'
                  : 'bg-surface text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr,340px] gap-8">
          {/* Promotions Grid */}
          <div className="space-y-4">
            {filteredPromotions.map((promo, i) => {
              const Icon = promo.icon
              return (
                <motion.div
                  key={promo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-surface rounded-2xl border border-border overflow-hidden hover:border-brand/50 transition-colors group"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className={`w-full sm:w-48 h-32 sm:h-auto bg-gradient-to-br ${promo.gradient} flex items-center justify-center`}>
                      <Icon className="w-16 h-16 text-text-primary/80" />
                    </div>
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-text-primary mb-1">{promo.title}</h3>
                          <p className="text-brand font-semibold">{promo.subtitle}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-brand group-hover:translate-x-1 transition-all" />
                      </div>
                      <p className="text-text-secondary text-sm mb-4">{promo.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        {promo.timeLeft && (
                          <div className="flex items-center gap-1.5 text-text-secondary">
                            <Clock className="w-4 h-4" />
                            <span>{promo.timeLeft} left</span>
                          </div>
                        )}
                        {promo.participants && (
                          <div className="flex items-center gap-1.5 text-text-secondary">
                            <Users className="w-4 h-4" />
                            <span>{promo.participants.toLocaleString()} joined</span>
                          </div>
                        )}
                        {promo.challenges && (
                          <div className="flex items-center gap-1.5 text-brand">
                            <Target className="w-4 h-4" />
                            <span>{promo.challenges} available</span>
                          </div>
                        )}
                        {promo.bonus && (
                          <div className="px-3 py-1 bg-green-500/20 text-accent-green rounded-full font-semibold">
                            {promo.bonus} up to {promo.maxBonus}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Daily Race Leaderboard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-surface rounded-2xl border border-border overflow-hidden"
            >
              <div className="p-5 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-text-primary">Daily Leaderboard</h3>
                  <div className="flex items-center gap-1.5 text-brand text-sm">
                    <Clock className="w-4 h-4" />
                    <span>8h 23m</span>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border">
                {leaderboard.map((player, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-surface-light transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        player.rank === 1 ? 'bg-yellow-500 text-black' :
                        player.rank === 2 ? 'bg-gray-400 text-black' :
                        player.rank === 3 ? 'bg-amber-700 text-text-primary' :
                        'bg-surface-light text-text-secondary'
                      }`}>
                        {player.rank}
                      </div>
                      <div>
                        <div className="text-text-primary font-medium text-sm">{player.name}</div>
                        <div className="text-text-muted text-xs">{player.wagered}</div>
                      </div>
                    </div>
                    <div className="text-brand font-bold">{player.prize}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border">
                <button className="w-full py-3 bg-gradient-to-r from-brand to-brand-light text-text-primary font-bold rounded-xl hover:opacity-90 transition-opacity">
                  View Full Leaderboard
                </button>
              </div>
            </motion.div>

            {/* Upcoming */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-surface rounded-2xl border border-border p-5"
            >
              <h3 className="text-lg font-bold text-text-primary mb-4">Upcoming Events</h3>
              <div className="space-y-3">
                {[
                  { name: 'Monthly Tournament', date: 'Dec 1st', prize: '$100,000' },
                  { name: 'Slot Race', date: 'Nov 25th', prize: '$25,000' },
                  { name: 'VIP Exclusive', date: 'Nov 28th', prize: '$50,000' },
                ].map((event, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-brand/20 to-brand-light/20 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-brand" />
                      </div>
                      <div>
                        <div className="text-text-primary font-medium text-sm">{event.name}</div>
                        <div className="text-text-muted text-xs">{event.date}</div>
                      </div>
                    </div>
                    <div className="text-brand font-bold text-sm">{event.prize}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

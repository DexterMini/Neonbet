import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* ── Achievement Definitions ─────────────────────── */
export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  category: 'betting' | 'winning' | 'exploration' | 'social' | 'milestone'
  requirement: number
  xpReward: number
}

export const ACHIEVEMENTS: Achievement[] = [
  // Betting milestones
  { id: 'first-bet', title: 'First Steps', description: 'Place your first bet', icon: '🎲', category: 'betting', requirement: 1, xpReward: 10 },
  { id: 'bets-50', title: 'Getting Started', description: 'Place 50 bets', icon: '🎯', category: 'betting', requirement: 50, xpReward: 50 },
  { id: 'bets-250', title: 'Regular', description: 'Place 250 bets', icon: '⚡', category: 'betting', requirement: 250, xpReward: 150 },
  { id: 'bets-1000', title: 'Veteran', description: 'Place 1,000 bets', icon: '🏅', category: 'betting', requirement: 1000, xpReward: 500 },
  { id: 'bets-5000', title: 'Legend', description: 'Place 5,000 bets', icon: '🏆', category: 'betting', requirement: 5000, xpReward: 2000 },
  { id: 'bets-10000', title: 'Degen King', description: 'Place 10,000 bets', icon: '👑', category: 'betting', requirement: 10000, xpReward: 5000 },

  // Winning milestones
  { id: 'first-win', title: 'Winner!', description: 'Win your first bet', icon: '🎉', category: 'winning', requirement: 1, xpReward: 15 },
  { id: 'wins-25', title: 'Lucky Streak', description: 'Win 25 bets', icon: '🍀', category: 'winning', requirement: 25, xpReward: 75 },
  { id: 'wins-100', title: 'Consistent', description: 'Win 100 bets', icon: '💪', category: 'winning', requirement: 100, xpReward: 300 },
  { id: 'wins-500', title: 'Sharp', description: 'Win 500 bets', icon: '🎯', category: 'winning', requirement: 500, xpReward: 1000 },
  { id: 'wins-2000', title: 'Untouchable', description: 'Win 2,000 bets', icon: '💎', category: 'winning', requirement: 2000, xpReward: 4000 },

  // Multiplier achievements
  { id: 'multi-2x', title: 'Double Up', description: 'Hit 2x multiplier', icon: '✌️', category: 'winning', requirement: 2, xpReward: 10 },
  { id: 'multi-5x', title: 'High Five', description: 'Hit 5x multiplier', icon: '🖐️', category: 'winning', requirement: 5, xpReward: 30 },
  { id: 'multi-10x', title: 'Tenner', description: 'Hit 10x multiplier', icon: '🔥', category: 'winning', requirement: 10, xpReward: 75 },
  { id: 'multi-50x', title: 'Jackpot', description: 'Hit 50x multiplier', icon: '💰', category: 'winning', requirement: 50, xpReward: 250 },
  { id: 'multi-100x', title: 'Moon Shot', description: 'Hit 100x multiplier', icon: '🚀', category: 'winning', requirement: 100, xpReward: 1000 },
  { id: 'multi-500x', title: 'Legendary', description: 'Hit 500x multiplier', icon: '⭐', category: 'winning', requirement: 500, xpReward: 5000 },

  // Streak achievements
  { id: 'streak-3', title: 'On a Roll', description: '3 wins in a row', icon: '🎳', category: 'winning', requirement: 3, xpReward: 25 },
  { id: 'streak-5', title: 'Hot Streak', description: '5 wins in a row', icon: '🔥', category: 'winning', requirement: 5, xpReward: 75 },
  { id: 'streak-10', title: 'Unstoppable', description: '10 wins in a row', icon: '💫', category: 'winning', requirement: 10, xpReward: 500 },

  // Exploration achievements
  { id: 'games-3', title: 'Explorer', description: 'Play 3 different games', icon: '🗺️', category: 'exploration', requirement: 3, xpReward: 50 },
  { id: 'games-6', title: 'Adventurer', description: 'Play 6 different games', icon: '🧭', category: 'exploration', requirement: 6, xpReward: 150 },
  { id: 'games-12', title: 'Master', description: 'Play all 12+ games', icon: '🏆', category: 'exploration', requirement: 12, xpReward: 500 },

  // Wagered amount
  { id: 'wagered-100', title: 'Penny Starter', description: 'Wager $100 total', icon: '💵', category: 'milestone', requirement: 100, xpReward: 25 },
  { id: 'wagered-1000', title: 'Solid Player', description: 'Wager $1,000 total', icon: '💰', category: 'milestone', requirement: 1000, xpReward: 100 },
  { id: 'wagered-10000', title: 'High Roller', description: 'Wager $10,000 total', icon: '🤑', category: 'milestone', requirement: 10000, xpReward: 500 },
  { id: 'wagered-100000', title: 'Whale Alert', description: 'Wager $100,000 total', icon: '🐋', category: 'milestone', requirement: 100000, xpReward: 2500 },

  // Profit milestones
  { id: 'profit-100', title: 'In Profit', description: 'Earn $100 profit', icon: '📈', category: 'milestone', requirement: 100, xpReward: 50 },
  { id: 'profit-1000', title: 'Pro Trader', description: 'Earn $1,000 profit', icon: '📊', category: 'milestone', requirement: 1000, xpReward: 300 },
  { id: 'profit-10000', title: 'Big Winner', description: 'Earn $10,000 profit', icon: '🏦', category: 'milestone', requirement: 10000, xpReward: 2000 },
]

/* ── XP Level Thresholds ─────────────────────────── */
export const XP_LEVELS = [
  { level: 1, xpNeeded: 0, title: 'Newcomer' },
  { level: 2, xpNeeded: 50, title: 'Beginner' },
  { level: 3, xpNeeded: 150, title: 'Apprentice' },
  { level: 4, xpNeeded: 350, title: 'Regular' },
  { level: 5, xpNeeded: 650, title: 'Skilled' },
  { level: 6, xpNeeded: 1100, title: 'Expert' },
  { level: 7, xpNeeded: 1800, title: 'Veteran' },
  { level: 8, xpNeeded: 2800, title: 'Elite' },
  { level: 9, xpNeeded: 4200, title: 'Master' },
  { level: 10, xpNeeded: 6200, title: 'Grandmaster' },
  { level: 11, xpNeeded: 9000, title: 'Champion' },
  { level: 12, xpNeeded: 12500, title: 'Legend' },
  { level: 13, xpNeeded: 17500, title: 'Mythic' },
  { level: 14, xpNeeded: 24000, title: 'Immortal' },
  { level: 15, xpNeeded: 35000, title: 'Transcendent' },
]

/* ── Store ────────────────────────────────────────── */
interface ProgressionState {
  // Stats
  totalBets: number
  totalWins: number
  totalWagered: number
  totalProfit: number
  bestMultiplier: number
  bestStreak: number
  currentStreak: number
  gamesPlayed: Set<string> // tracked as array in persist

  // XP
  xp: number
  level: number

  // Achievements
  unlockedAchievements: string[]
  recentUnlock: string | null // for toast notification

  // Daily challenges
  dailyBets: number
  dailyWins: number
  dailyWagered: number
  dailyDate: string // YYYY-MM-DD

  // Actions
  recordBet: (game: string, won: boolean, wagered: number, profit: number, multiplier: number) => string[] // returns newly unlocked
  clearRecentUnlock: () => void
}

function getLevel(xp: number): number {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].xpNeeded) return XP_LEVELS[i].level
  }
  return 1
}

export const useProgressionStore = create<ProgressionState>()(
  persist(
    (set, get) => ({
      totalBets: 0,
      totalWins: 0,
      totalWagered: 0,
      totalProfit: 0,
      bestMultiplier: 0,
      bestStreak: 0,
      currentStreak: 0,
      gamesPlayed: new Set<string>(),
      xp: 0,
      level: 1,
      unlockedAchievements: [],
      recentUnlock: null,
      dailyBets: 0,
      dailyWins: 0,
      dailyWagered: 0,
      dailyDate: new Date().toISOString().slice(0, 10),

      recordBet: (game, won, wagered, profit, multiplier) => {
        const state = get()
        const today = new Date().toISOString().slice(0, 10)
        const isNewDay = state.dailyDate !== today

        const newTotalBets = state.totalBets + 1
        const newTotalWins = state.totalWins + (won ? 1 : 0)
        const newTotalWagered = state.totalWagered + wagered
        const newTotalProfit = state.totalProfit + profit
        const newBestMulti = Math.max(state.bestMultiplier, multiplier)
        const newStreak = won ? state.currentStreak + 1 : 0
        const newBestStreak = Math.max(state.bestStreak, newStreak)
        const newGamesPlayed = new Set(state.gamesPlayed)
        newGamesPlayed.add(game)

        const newDailyBets = isNewDay ? 1 : state.dailyBets + 1
        const newDailyWins = isNewDay ? (won ? 1 : 0) : state.dailyWins + (won ? 1 : 0)
        const newDailyWagered = isNewDay ? wagered : state.dailyWagered + wagered

        // Check achievements
        const newUnlocks: string[] = []
        const unlocked = new Set(state.unlockedAchievements)

        const check = (id: string, value: number) => {
          const ach = ACHIEVEMENTS.find(a => a.id === id)
          if (ach && !unlocked.has(id) && value >= ach.requirement) {
            newUnlocks.push(id)
            unlocked.add(id)
          }
        }

        // Betting milestones
        check('first-bet', newTotalBets)
        check('bets-50', newTotalBets)
        check('bets-250', newTotalBets)
        check('bets-1000', newTotalBets)
        check('bets-5000', newTotalBets)
        check('bets-10000', newTotalBets)

        // Win milestones
        check('first-win', newTotalWins)
        check('wins-25', newTotalWins)
        check('wins-100', newTotalWins)
        check('wins-500', newTotalWins)
        check('wins-2000', newTotalWins)

        // Multiplier
        check('multi-2x', newBestMulti)
        check('multi-5x', newBestMulti)
        check('multi-10x', newBestMulti)
        check('multi-50x', newBestMulti)
        check('multi-100x', newBestMulti)
        check('multi-500x', newBestMulti)

        // Streaks
        check('streak-3', newStreak)
        check('streak-5', newStreak)
        check('streak-10', newStreak)

        // Exploration
        check('games-3', newGamesPlayed.size)
        check('games-6', newGamesPlayed.size)
        check('games-12', newGamesPlayed.size)

        // Wagered
        check('wagered-100', newTotalWagered)
        check('wagered-1000', newTotalWagered)
        check('wagered-10000', newTotalWagered)
        check('wagered-100000', newTotalWagered)

        // Profit
        if (newTotalProfit > 0) {
          check('profit-100', newTotalProfit)
          check('profit-1000', newTotalProfit)
          check('profit-10000', newTotalProfit)
        }

        // Calculate XP gained
        let xpGained = won ? 5 : 2 // base XP per bet
        xpGained += Math.floor(wagered / 10) // 1 XP per $10 wagered
        for (const id of newUnlocks) {
          const ach = ACHIEVEMENTS.find(a => a.id === id)
          if (ach) xpGained += ach.xpReward
        }

        const newXp = state.xp + xpGained
        const newLevel = getLevel(newXp)

        set({
          totalBets: newTotalBets,
          totalWins: newTotalWins,
          totalWagered: newTotalWagered,
          totalProfit: newTotalProfit,
          bestMultiplier: newBestMulti,
          bestStreak: newBestStreak,
          currentStreak: newStreak,
          gamesPlayed: newGamesPlayed,
          xp: newXp,
          level: newLevel,
          unlockedAchievements: Array.from(unlocked),
          recentUnlock: newUnlocks.length > 0 ? newUnlocks[newUnlocks.length - 1] : null,
          dailyBets: newDailyBets,
          dailyWins: newDailyWins,
          dailyWagered: newDailyWagered,
          dailyDate: today,
        })

        return newUnlocks
      },

      clearRecentUnlock: () => set({ recentUnlock: null }),
    }),
    {
      name: 'casino-progression',
      partialize: (state) => ({
        totalBets: state.totalBets,
        totalWins: state.totalWins,
        totalWagered: state.totalWagered,
        totalProfit: state.totalProfit,
        bestMultiplier: state.bestMultiplier,
        bestStreak: state.bestStreak,
        currentStreak: state.currentStreak,
        gamesPlayed: Array.from(state.gamesPlayed),
        xp: state.xp,
        level: state.level,
        unlockedAchievements: state.unlockedAchievements,
        dailyBets: state.dailyBets,
        dailyWins: state.dailyWins,
        dailyWagered: state.dailyWagered,
        dailyDate: state.dailyDate,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...(persisted || {}),
        gamesPlayed: new Set(persisted?.gamesPlayed || []),
      }),
    }
  )
)

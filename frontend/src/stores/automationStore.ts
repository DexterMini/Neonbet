import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* ── House Edge per Game ──────────────────────────── */
export interface GameEdgeConfig {
  game: string
  label: string
  houseEdge: number   // e.g. 0.03 = 3%
  minBet: number
  maxBet: number
  maxWin: number
  enabled: boolean
}

/* ── Cashback Settings ────────────────────────────── */
export interface CashbackConfig {
  enabled: boolean
  percentage: number         // % of net losses returned (e.g. 10 = 10%)
  frequency: 'instant' | 'daily' | 'weekly'
  minLossThreshold: number   // Min total loss before cashback kicks in ($)
  maxCashback: number        // Max cashback per period ($)
  wageringReq: number        // Wagering requirement multiplier (e.g. 1 = 1x)
}

/* ── Deposit Bonus Settings ───────────────────────── */
export interface DepositBonusConfig {
  enabled: boolean
  firstDepositPercent: number   // e.g. 100 = 100% match
  firstDepositMax: number       // Max first deposit bonus ($)
  reloadPercent: number         // Subsequent deposit bonus %
  reloadMax: number             // Max reload bonus ($)
  wageringReq: number           // Wagering requirement multiplier
}

/* ── VIP Settings ─────────────────────────────────── */
export interface VIPLevelConfig {
  level: number
  name: string
  minWagered: number       // Monthly wagered required ($)
  rakebackPercent: number  // % of house edge returned
  levelUpBonus: number     // One-time level-up bonus ($)
  weeklyBonusPercent: number
  monthlyBonusPercent: number
}

export interface VIPConfig {
  enabled: boolean
  autoProgression: boolean
  autoDistribute: boolean  // Auto-distribute weekly/monthly bonuses
  levels: VIPLevelConfig[]
}

/* ── Profit Tracking ──────────────────────────────── */
export interface ProfitEntry {
  timestamp: number
  game: string
  betAmount: number
  payout: number
  houseProfit: number  // betAmount - payout (positive = house wins)
  userId?: string
}

export interface ProfitStats {
  totalBets: number
  totalWagered: number
  totalPayouts: number
  grossProfit: number          // totalWagered - totalPayouts
  totalCashbackPaid: number
  totalBonusesPaid: number
  netProfit: number            // grossProfit - cashback - bonuses
  perGame: Record<string, {
    bets: number
    wagered: number
    payouts: number
    profit: number
    effectiveEdge: number
  }>
}

/* ── Full Store ───────────────────────────────────── */
interface AutomationState {
  // Configs
  cashback: CashbackConfig
  depositBonus: DepositBonusConfig
  vip: VIPConfig
  gameEdges: GameEdgeConfig[]

  // Profit tracking
  profitHistory: ProfitEntry[]
  profitStats: ProfitStats

  // User cashback tracking
  userLosses: Record<string, number>        // userId -> accumulated losses since last cashback
  userCashbackPaid: Record<string, number>  // userId -> total cashback paid
  lastCashbackTime: Record<string, number>  // userId -> timestamp of last cashback

  // Actions - Config
  setCashbackConfig: (config: Partial<CashbackConfig>) => void
  setDepositBonusConfig: (config: Partial<DepositBonusConfig>) => void
  setVIPConfig: (config: Partial<VIPConfig>) => void
  updateVIPLevel: (levelIndex: number, update: Partial<VIPLevelConfig>) => void
  setGameEdge: (game: string, update: Partial<GameEdgeConfig>) => void

  // Actions - Tracking
  recordBet: (entry: Omit<ProfitEntry, 'timestamp'>) => void
  calculateCashback: (userId: string) => number
  payCashback: (userId: string) => number
  calculateDepositBonus: (amount: number, isFirst: boolean) => number
  resetProfitStats: () => void

  // Getters
  getEffectiveEdge: (game: string) => number
  getGameConfig: (game: string) => GameEdgeConfig | undefined
}

const DEFAULT_GAME_EDGES: GameEdgeConfig[] = [
  { game: 'dice',       label: 'Dice',          houseEdge: 0.01, minBet: 0.10, maxBet: 10000, maxWin: 100000, enabled: true },
  { game: 'crash',      label: 'Crash',         houseEdge: 0.03, minBet: 0.10, maxBet: 10000, maxWin: 500000, enabled: true },
  { game: 'mines',      label: 'Mines',         houseEdge: 0.02, minBet: 0.10, maxBet: 5000,  maxWin: 50000,  enabled: true },
  { game: 'plinko',     label: 'Plinko',        houseEdge: 0.03, minBet: 0.10, maxBet: 5000,  maxWin: 50000,  enabled: true },
  { game: 'limbo',      label: 'Limbo',         houseEdge: 0.01, minBet: 0.10, maxBet: 10000, maxWin: 1000000,enabled: true },
  { game: 'wheel',      label: 'Wheel',         houseEdge: 0.04, minBet: 0.10, maxBet: 5000,  maxWin: 50000,  enabled: true },
  { game: 'keno',       label: 'Keno',          houseEdge: 0.03, minBet: 0.10, maxBet: 5000,  maxWin: 400000, enabled: true },
  { game: 'twentyone',  label: 'Twenty One',    houseEdge: 0.02, minBet: 0.10, maxBet: 5000,  maxWin: 50000,  enabled: true },
  { game: 'slots',      label: 'Slots',         houseEdge: 0.04, minBet: 0.10, maxBet: 1000,  maxWin: 50000,  enabled: true },
  { game: 'coinclimber',label: 'Coin Climber',  houseEdge: 0.03, minBet: 0.10, maxBet: 5000,  maxWin: 50000,  enabled: true },
  { game: 'snake',      label: 'Snake',         houseEdge: 0.03, minBet: 0.10, maxBet: 5000,  maxWin: 50000,  enabled: true },
  { game: 'chicken',    label: 'Chicken',       houseEdge: 0.03, minBet: 0.10, maxBet: 5000,  maxWin: 50000,  enabled: true },
  { game: 'sports',     label: 'Sports',        houseEdge: 0.05, minBet: 1.00, maxBet: 50000, maxWin: 500000, enabled: true },
]

const DEFAULT_VIP_LEVELS: VIPLevelConfig[] = [
  { level: 0, name: 'Bronze',   minWagered: 0,         rakebackPercent: 5,  levelUpBonus: 0,     weeklyBonusPercent: 0.1, monthlyBonusPercent: 0.5 },
  { level: 1, name: 'Silver',   minWagered: 5000,      rakebackPercent: 10, levelUpBonus: 25,    weeklyBonusPercent: 0.2, monthlyBonusPercent: 1.0 },
  { level: 2, name: 'Gold',     minWagered: 25000,     rakebackPercent: 15, levelUpBonus: 100,   weeklyBonusPercent: 0.3, monthlyBonusPercent: 1.5 },
  { level: 3, name: 'Platinum', minWagered: 100000,    rakebackPercent: 20, levelUpBonus: 500,   weeklyBonusPercent: 0.4, monthlyBonusPercent: 2.0 },
  { level: 4, name: 'Diamond',  minWagered: 500000,    rakebackPercent: 25, levelUpBonus: 2500,  weeklyBonusPercent: 0.5, monthlyBonusPercent: 2.5 },
  { level: 5, name: 'VIP',      minWagered: 2000000,   rakebackPercent: 30, levelUpBonus: 10000, weeklyBonusPercent: 0.6, monthlyBonusPercent: 3.0 },
  { level: 6, name: 'SVIP',     minWagered: 10000000,  rakebackPercent: 35, levelUpBonus: 50000, weeklyBonusPercent: 0.7, monthlyBonusPercent: 3.5 },
]

const EMPTY_PROFIT_STATS: ProfitStats = {
  totalBets: 0,
  totalWagered: 0,
  totalPayouts: 0,
  grossProfit: 0,
  totalCashbackPaid: 0,
  totalBonusesPaid: 0,
  netProfit: 0,
  perGame: {},
}

export const useAutomationStore = create<AutomationState>()(
  persist(
    (set, get) => ({
      // ── Defaults ──
      cashback: {
        enabled: true,
        percentage: 10,
        frequency: 'instant',
        minLossThreshold: 5,
        maxCashback: 5000,
        wageringReq: 1,
      },
      depositBonus: {
        enabled: true,
        firstDepositPercent: 100,
        firstDepositMax: 500,
        reloadPercent: 25,
        reloadMax: 200,
        wageringReq: 30,
      },
      vip: {
        enabled: true,
        autoProgression: true,
        autoDistribute: true,
        levels: DEFAULT_VIP_LEVELS,
      },
      gameEdges: DEFAULT_GAME_EDGES,

      profitHistory: [],
      profitStats: { ...EMPTY_PROFIT_STATS },

      userLosses: {},
      userCashbackPaid: {},
      lastCashbackTime: {},

      // ── Config Actions ──
      setCashbackConfig: (config) =>
        set((s) => ({ cashback: { ...s.cashback, ...config } })),

      setDepositBonusConfig: (config) =>
        set((s) => ({ depositBonus: { ...s.depositBonus, ...config } })),

      setVIPConfig: (config) =>
        set((s) => ({ vip: { ...s.vip, ...config } })),

      updateVIPLevel: (levelIndex, update) =>
        set((s) => {
          const levels = [...s.vip.levels]
          levels[levelIndex] = { ...levels[levelIndex], ...update }
          return { vip: { ...s.vip, levels } }
        }),

      setGameEdge: (game, update) =>
        set((s) => ({
          gameEdges: s.gameEdges.map((g) =>
            g.game === game ? { ...g, ...update } : g,
          ),
        })),

      // ── Record a bet & update profit tracking ──
      recordBet: (entry) => {
        const timestamp = Date.now()
        const fullEntry: ProfitEntry = { ...entry, timestamp }

        set((s) => {
          const newHistory = [...s.profitHistory.slice(-9999), fullEntry] // Keep last 10k

          // Update stats
          const stats = { ...s.profitStats }
          stats.totalBets += 1
          stats.totalWagered += entry.betAmount
          stats.totalPayouts += entry.payout
          stats.grossProfit = stats.totalWagered - stats.totalPayouts
          stats.netProfit = stats.grossProfit - stats.totalCashbackPaid - stats.totalBonusesPaid

          // Per-game stats
          const gameStats = stats.perGame[entry.game] || {
            bets: 0, wagered: 0, payouts: 0, profit: 0, effectiveEdge: 0,
          }
          gameStats.bets += 1
          gameStats.wagered += entry.betAmount
          gameStats.payouts += entry.payout
          gameStats.profit = gameStats.wagered - gameStats.payouts
          gameStats.effectiveEdge = gameStats.wagered > 0
            ? (gameStats.profit / gameStats.wagered) * 100
            : 0
          stats.perGame[entry.game] = gameStats

          // Track user losses for cashback
          const userLosses = { ...s.userLosses }
          if (entry.houseProfit > 0 && entry.userId) {
            userLosses[entry.userId] = (userLosses[entry.userId] || 0) + entry.houseProfit
          }

          return {
            profitHistory: newHistory,
            profitStats: stats,
            userLosses,
          }
        })
      },

      // ── Calculate pending cashback for a user ──
      calculateCashback: (userId) => {
        const s = get()
        if (!s.cashback.enabled) return 0

        const losses = s.userLosses[userId] || 0
        if (losses < s.cashback.minLossThreshold) return 0

        const cashback = Math.min(
          losses * (s.cashback.percentage / 100),
          s.cashback.maxCashback,
        )
        return Math.round(cashback * 100) / 100
      },

      // ── Pay out cashback and reset user loss counter ──
      payCashback: (userId) => {
        const cashback = get().calculateCashback(userId)
        if (cashback <= 0) return 0

        set((s) => {
          const userLosses = { ...s.userLosses }
          const userCashbackPaid = { ...s.userCashbackPaid }
          const lastCashbackTime = { ...s.lastCashbackTime }
          const stats = { ...s.profitStats }

          userLosses[userId] = 0
          userCashbackPaid[userId] = (userCashbackPaid[userId] || 0) + cashback
          lastCashbackTime[userId] = Date.now()
          stats.totalCashbackPaid += cashback
          stats.netProfit = stats.grossProfit - stats.totalCashbackPaid - stats.totalBonusesPaid

          return { userLosses, userCashbackPaid, lastCashbackTime, profitStats: stats }
        })

        return cashback
      },

      // ── Calculate deposit bonus ──
      calculateDepositBonus: (amount, isFirst) => {
        const s = get()
        if (!s.depositBonus.enabled) return 0

        if (isFirst) {
          return Math.min(
            amount * (s.depositBonus.firstDepositPercent / 100),
            s.depositBonus.firstDepositMax,
          )
        }
        return Math.min(
          amount * (s.depositBonus.reloadPercent / 100),
          s.depositBonus.reloadMax,
        )
      },

      // ── Reset profit stats ──
      resetProfitStats: () =>
        set({
          profitHistory: [],
          profitStats: { ...EMPTY_PROFIT_STATS },
          userLosses: {},
          userCashbackPaid: {},
          lastCashbackTime: {},
        }),

      // ── Getters ──
      getEffectiveEdge: (game) => {
        const cfg = get().gameEdges.find((g) => g.game === game)
        return cfg ? cfg.houseEdge : 0.03
      },

      getGameConfig: (game) => get().gameEdges.find((g) => g.game === game),
    }),
    {
      name: 'neonbet-automation',
      partialize: (state) => ({
        cashback: state.cashback,
        depositBonus: state.depositBonus,
        vip: state.vip,
        gameEdges: state.gameEdges,
        profitHistory: state.profitHistory.slice(-1000), // Only persist last 1k entries
        profitStats: state.profitStats,
        userLosses: state.userLosses,
        userCashbackPaid: state.userCashbackPaid,
        lastCashbackTime: state.lastCashbackTime,
      }),
    },
  ),
)

import { create } from 'zustand'
import Decimal from 'decimal.js'
import { useAuthStore } from './authStore'

export type GameType = 'dice' | 'crash' | 'mines' | 'plinko' | 'limbo' | 'wheel' | 'keno' | 'twentyone' | 'flip' | 'hilo' | 'stairs' | 'chicken' | 'coinclimber' | 'snake' | 'slots'

/** Supported game types with backend engines */
const BACKEND_GAMES = new Set([
  'dice', 'limbo', 'mines', 'plinko', 'wheel', 'keno', 'twentyone',
  'flip', 'hilo', 'stairs', 'chicken', 'coinclimber', 'snake', 'slots',
])

export interface BetResult {
  id: string
  betAmount: number
  payout: number
  multiplier: number
  profit: number
  isWin: boolean
  gameData: Record<string, any>
  resultData: Record<string, any>
  provablyFair?: {
    serverSeedHash: string
    clientSeed: string
    nonce: number
  }
}

export interface ApiPlaceBetResponse {
  bet_id: string
  game_type: string
  bet_amount: string
  outcome: string
  multiplier: string
  payout: string
  profit: string
  result_data: Record<string, any>
  server_seed_hash: string
  client_seed: string
  nonce: number
  timestamp: string
}

interface BalanceMap {
  [currency: string]: { available: number; locked: number; total: number }
}

interface GameState {
  // Current bet settings
  betAmount: string
  currency: string

  // Balance (fetched from backend when authenticated)
  balances: BalanceMap
  balancesLoaded: boolean

  // Placing state
  isPlacing: boolean

  // Game-specific settings
  diceTarget: number
  diceRollOver: boolean

  mineCount: number
  minesRevealed: number[]

  crashCashoutAt: number
  crashMultiplier: number
  crashStatus: 'waiting' | 'running' | 'crashed'

  plinkoRows: number
  plinkoRisk: 'low' | 'medium' | 'high'

  limboTarget: number

  wheelSegments: number

  // Last result
  lastResult: BetResult | null

  // Actions
  setBetAmount: (amount: string) => void
  setCurrency: (currency: string) => void

  // Balance
  fetchBalances: () => Promise<void>
  refreshBalance: () => Promise<void>

  // Bet placement via backend API
  placeBet: (
    gameType: string,
    betAmount: string | number,
    currency: string,
    gameData: Record<string, any>,
    twoFactorCode?: string,
  ) => Promise<ApiPlaceBetResponse>

  // Dice
  setDiceTarget: (target: number) => void
  setDiceRollOver: (rollOver: boolean) => void

  // Mines
  setMineCount: (count: number) => void
  revealTile: (index: number) => void
  resetMines: () => void

  // Crash
  setCrashCashoutAt: (multiplier: number) => void
  setCrashMultiplier: (multiplier: number) => void
  setCrashStatus: (status: 'waiting' | 'running' | 'crashed') => void

  // Plinko
  setPlinkoRows: (rows: number) => void
  setPlinkoRisk: (risk: 'low' | 'medium' | 'high') => void

  // Limbo
  setLimboTarget: (target: number) => void

  // Wheel
  setWheelSegments: (segments: number) => void

  // Result
  setLastResult: (result: BetResult | null) => void

  // Calculations
  getDiceMultiplier: () => number
  getDiceWinChance: () => number
  getLimboMultiplier: () => number
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  betAmount: '0.0001',
  currency: 'BTC',

  balances: {},
  balancesLoaded: false,

  isPlacing: false,

  diceTarget: 50,
  diceRollOver: false,

  mineCount: 3,
  minesRevealed: [],

  crashCashoutAt: 2.0,
  crashMultiplier: 1.0,
  crashStatus: 'waiting',

  plinkoRows: 8,
  plinkoRisk: 'medium',

  limboTarget: 2.0,

  wheelSegments: 10,

  lastResult: null,

  // Actions
  setBetAmount: (amount) => set({ betAmount: amount }),
  setCurrency: (currency) => set({ currency }),

  // ------- Balance -------
  fetchBalances: async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      let res = await fetch('/api/v1/wallet/balances', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        const refreshed = await useAuthStore.getState().refreshToken()
        if (refreshed) {
          const newToken = useAuthStore.getState().token!
          res = await fetch('/api/v1/wallet/balances', {
            headers: { Authorization: `Bearer ${newToken}` },
          })
        }
      }
      if (!res.ok) return
      const data = await res.json()
      const map: BalanceMap = {}
      for (const b of data.balances ?? []) {
        map[b.currency.toLowerCase()] = {
          available: parseFloat(b.available),
          locked: parseFloat(b.locked),
          total: parseFloat(b.total),
        }
      }
      set({ balances: map, balancesLoaded: true })
    } catch {
      /* ignore */
    }
  },

  refreshBalance: async () => {
    await get().fetchBalances()
  },

  // ------- Place Bet (Backend API) -------
  placeBet: async (gameType, betAmount, currency, gameData, twoFactorCode) => {
    let token = useAuthStore.getState().token
    if (!token) throw new Error('Not authenticated')
    if (!BACKEND_GAMES.has(gameType)) throw new Error(`Game "${gameType}" not supported by backend`)

    set({ isPlacing: true })
    try {
      const makeRequest = async (authToken: string) => {
        return fetch('/api/v1/bets/place', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            game_type: gameType,
            bet_amount: typeof betAmount === 'string' ? parseFloat(betAmount) : betAmount,
            currency: currency.toUpperCase(),
            game_data: gameData,
            ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
          }),
        })
      }

      let res = await makeRequest(token)

      // On 401, try refreshing the token once
      if (res.status === 401) {
        const refreshed = await useAuthStore.getState().refreshToken()
        if (refreshed) {
          token = useAuthStore.getState().token!
          res = await makeRequest(token)
        }
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || 'Bet failed')
      }

      const data: ApiPlaceBetResponse = await res.json()

      // Update lastResult
      set({
        lastResult: {
          id: data.bet_id,
          betAmount: parseFloat(data.bet_amount),
          payout: parseFloat(data.payout),
          multiplier: parseFloat(data.multiplier),
          profit: parseFloat(data.profit),
          isWin: data.outcome === 'win',
          gameData: {},
          resultData: data.result_data,
          provablyFair: {
            serverSeedHash: data.server_seed_hash,
            clientSeed: data.client_seed,
            nonce: data.nonce,
          },
        },
      })

      // Refresh balance in background
      get().fetchBalances()

      return data
    } finally {
      set({ isPlacing: false })
    }
  },

  // Dice
  setDiceTarget: (target) => set({ diceTarget: Math.max(1, Math.min(98, target)) }),
  setDiceRollOver: (rollOver) => set({ diceRollOver: rollOver }),

  // Mines
  setMineCount: (count) => set({ mineCount: Math.max(1, Math.min(24, count)) }),
  revealTile: (index) =>
    set((state) => ({
      minesRevealed: [...state.minesRevealed, index],
    })),
  resetMines: () => set({ minesRevealed: [] }),

  // Crash
  setCrashCashoutAt: (multiplier) => set({ crashCashoutAt: multiplier }),
  setCrashMultiplier: (multiplier) => set({ crashMultiplier: multiplier }),
  setCrashStatus: (status) => set({ crashStatus: status }),

  // Plinko
  setPlinkoRows: (rows) => set({ plinkoRows: Math.max(8, Math.min(16, rows)) }),
  setPlinkoRisk: (risk) => set({ plinkoRisk: risk }),

  // Limbo
  setLimboTarget: (target) => set({ limboTarget: Math.max(1.01, target) }),

  // Wheel
  setWheelSegments: (segments) => set({ wheelSegments: segments }),

  // Result
  setLastResult: (result) => set({ lastResult: result }),

  // Calculations
  getDiceMultiplier: () => {
    const { diceTarget, diceRollOver } = get()
    const winChance = diceRollOver ? (99 - diceTarget) / 100 : diceTarget / 100
    const houseEdge = 0.01
    return new Decimal(1 - houseEdge).div(winChance).toDecimalPlaces(4).toNumber()
  },

  getDiceWinChance: () => {
    const { diceTarget, diceRollOver } = get()
    return diceRollOver ? 99 - diceTarget : diceTarget
  },

  getLimboMultiplier: () => {
    const { limboTarget } = get()
    const houseEdge = 0.01
    return new Decimal(1 - houseEdge)
      .div(new Decimal(1).div(limboTarget))
      .toDecimalPlaces(4)
      .toNumber()
  },
}))

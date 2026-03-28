import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  createGameSession, 
  incrementNonce, 
  rotateServerSeed,
  type GameSession as ProvablyFairSession 
} from './provably-fair'
import * as api from './api'

export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  vipLevel: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'vip' | 'svip'
  balance: number
  currency: string
  isAdmin: boolean
  createdAt: Date
  totalWagered: number
  totalWon: number
}

export interface Game {
  id: string
  name: string
  slug: string
  category: 'originals' | 'slots' | 'live' | 'table' | 'game-shows'
  description: string
  rtp: number
  houseEdge: number
  minBet: number
  maxBet: number
  maxWin: number
  isLive: boolean
  isNew: boolean
  isHot: boolean
  players: number
  provider: string
}

export interface BetHistory {
  id: string
  gameId: string
  gameName: string
  betAmount: number
  multiplier: number
  profit: number
  timestamp: Date
  result: 'win' | 'loss'
  serverSeedHash: string
  clientSeed: string
  nonce: number
}

interface CasinoState {
  // Auth
  user: User | null
  isAuthenticated: boolean
  
  // Provably Fair Session
  gameSession: ProvablyFairSession | null
  revealedSeeds: { serverSeed: string; hash: string; timestamp: number }[]
  
  // UI State
  currentView: 'lobby' | 'admin' | 'game'
  selectedGame: Game | null
  sidebarCollapsed: boolean
  
  // Live Data
  onlineUsers: number
  totalBetsToday: number
  jackpotAmount: number
  betHistory: BetHistory[]
  
  // Actions
  setUser: (user: User | null) => void
  setCurrentView: (view: 'lobby' | 'admin' | 'game') => void
  setSelectedGame: (game: Game | null) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  updateBalance: (amount: number) => void
  addBetToHistory: (bet: BetHistory) => void
  updateOnlineUsers: (count: number) => void
  logout: () => void
  
  // Real Auth Actions
  loginUser: (username: string, password: string) => Promise<void>
  registerUser: (username: string, email: string, password: string) => Promise<void>
  fetchMe: () => Promise<void>
  fetchBalances: () => Promise<void>
  
  // Provably Fair Actions
  initGameSession: (clientSeed?: string) => void
  incrementGameNonce: () => void
  rotateGameSeed: () => string | null
  setClientSeed: (seed: string) => void
  
  // Game Actions
  placeBet: (amount: number) => boolean
  addWinnings: (amount: number) => void
  updateWagered: (amount: number) => void
}

export const useCasinoStore = create<CasinoState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      isAuthenticated: false,
      gameSession: null,
      revealedSeeds: [],
      currentView: 'lobby',
      selectedGame: null,
      sidebarCollapsed: false,
      onlineUsers: 0,
      totalBetsToday: 0,
      jackpotAmount: 0,
      betHistory: [],
      
      // Actions
      setUser: (user) => {
        set({ user, isAuthenticated: !!user })
        // Initialize game session when user logs in
        if (user && !get().gameSession) {
          get().initGameSession()
        }
      },
      
      setCurrentView: (currentView) => set({ currentView }),
      setSelectedGame: (selectedGame) => set({ selectedGame }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      
      updateBalance: (amount) => set((state) => ({
        user: state.user ? { ...state.user, balance: Math.max(0, state.user.balance + amount) } : null
      })),
      
      addBetToHistory: (bet) => set((state) => ({
        betHistory: [bet, ...state.betHistory].slice(0, 100),
        totalBetsToday: state.totalBetsToday + 1
      })),
      
      updateOnlineUsers: (onlineUsers) => set({ onlineUsers }),
      
      logout: () => {
        api.logout().catch(() => {})
        api.clearToken()
        set({ 
          user: null, 
          isAuthenticated: false, 
          currentView: 'lobby',
          gameSession: null 
        })
      },
      
      // Real Auth Actions
      loginUser: async (username, password) => {
        const data = await api.login(username, password)
        const me = await api.getMe()
        const user: User = {
          id: me.id || me.user_id,
          username: me.username,
          email: me.email,
          avatar: me.avatar,
          vipLevel: me.vip_level || me.vipLevel || 'bronze',
          balance: 0,
          currency: 'USD',
          isAdmin: me.is_admin || false,
          createdAt: new Date(me.created_at || Date.now()),
          totalWagered: me.total_wagered || 0,
          totalWon: me.total_won || 0,
        }
        set({ user, isAuthenticated: true })
        get().initGameSession()
        // fetch real balances
        get().fetchBalances()
      },

      registerUser: async (username, email, password) => {
        const data = await api.register(username, email, password)
        const me = await api.getMe()
        const user: User = {
          id: me.id || me.user_id,
          username: me.username,
          email: me.email,
          avatar: me.avatar,
          vipLevel: me.vip_level || me.vipLevel || 'bronze',
          balance: 0,
          currency: 'USD',
          isAdmin: me.is_admin || false,
          createdAt: new Date(me.created_at || Date.now()),
          totalWagered: me.total_wagered || 0,
          totalWon: me.total_won || 0,
        }
        set({ user, isAuthenticated: true })
        get().initGameSession()
      },

      fetchMe: async () => {
        try {
          const token = api.getToken()
          if (!token) return
          const me = await api.getMe()
          const user: User = {
            id: me.id || me.user_id,
            username: me.username,
            email: me.email,
            avatar: me.avatar,
            vipLevel: me.vip_level || me.vipLevel || 'bronze',
            balance: get().user?.balance || 0,
            currency: 'USD',
            isAdmin: me.is_admin || false,
            createdAt: new Date(me.created_at || Date.now()),
            totalWagered: me.total_wagered || 0,
            totalWon: me.total_won || 0,
          }
          set({ user, isAuthenticated: true })
          if (!get().gameSession) get().initGameSession()
          get().fetchBalances()
        } catch {
          api.clearToken()
          set({ user: null, isAuthenticated: false })
        }
      },

      fetchBalances: async () => {
        try {
          const balances = await api.getBalances()
          // Sum all balances as USD equivalent (simplified)
          const usdBalance = balances['USD'] || balances['usd'] || 0
          set((state) => ({
            user: state.user ? { ...state.user, balance: usdBalance } : null,
          }))
        } catch {
          // silently fail, balance stays as-is
        }
      },
      
      // Provably Fair Actions
      initGameSession: (clientSeed) => {
        const session = createGameSession(clientSeed)
        set({ gameSession: session })
      },
      
      incrementGameNonce: () => set((state) => ({
        gameSession: state.gameSession ? incrementNonce(state.gameSession) : null
      })),
      
      rotateGameSeed: () => {
        const state = get()
        if (!state.gameSession) return null
        
        const { newSession, revealedSeed } = rotateServerSeed(state.gameSession)
        
        set((s) => ({
          gameSession: newSession,
          revealedSeeds: [
            { 
              serverSeed: revealedSeed, 
              hash: s.gameSession?.serverSeedHash || '', 
              timestamp: Date.now() 
            },
            ...s.revealedSeeds
          ].slice(0, 10)
        }))
        
        return revealedSeed
      },
      
      setClientSeed: (seed) => set((state) => ({
        gameSession: state.gameSession ? { ...state.gameSession, clientSeed: seed } : null
      })),
      
      // Game Actions
      placeBet: (amount) => {
        const state = get()
        if (!state.user || state.user.balance < amount) return false
        
        set((s) => ({
          user: s.user ? { ...s.user, balance: s.user.balance - amount } : null
        }))
        
        return true
      },
      
      addWinnings: (amount) => set((state) => ({
        user: state.user ? { 
          ...state.user, 
          balance: state.user.balance + amount,
          totalWon: state.user.totalWon + amount
        } : null
      })),
      
      updateWagered: (amount) => set((state) => ({
        user: state.user ? { 
          ...state.user, 
          totalWagered: state.user.totalWagered + amount 
        } : null
      })),
    }),
    {
      name: 'celora-casino-storage',
      partialize: (state) => ({ 
        sidebarCollapsed: state.sidebarCollapsed,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        betHistory: state.betHistory.slice(0, 50),
        revealedSeeds: state.revealedSeeds,
      }),
    }
  )
)

// Game definitions - these would come from API in production
export const CELORA_GAMES: Game[] = [
  {
    id: 'crash',
    name: 'Crash',
    slug: 'crash',
    category: 'originals',
    description: 'Watch the multiplier rise and cash out before it crashes',
    rtp: 97,
    houseEdge: 3,
    minBet: 0.1,
    maxBet: 10000,
    maxWin: 100000,
    isLive: false,
    isNew: false,
    isHot: true,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'mines',
    name: 'Mines',
    slug: 'mines',
    category: 'originals',
    description: 'Reveal gems while avoiding hidden mines',
    rtp: 98.5,
    houseEdge: 1.5,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 50000,
    isLive: false,
    isNew: false,
    isHot: true,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'dice',
    name: 'Dice',
    slug: 'dice',
    category: 'originals',
    description: 'Roll the dice and predict the outcome',
    rtp: 99,
    houseEdge: 1,
    minBet: 0.1,
    maxBet: 10000,
    maxWin: 100000,
    isLive: false,
    isNew: false,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'plinko',
    name: 'Plinko',
    slug: 'plinko',
    category: 'originals',
    description: 'Drop the ball and win multipliers',
    rtp: 97,
    houseEdge: 3,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 50000,
    isLive: false,
    isNew: false,
    isHot: true,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'limbo',
    name: 'Limbo',
    slug: 'limbo',
    category: 'originals',
    description: 'Set your target and test your luck',
    rtp: 99,
    houseEdge: 1,
    minBet: 0.1,
    maxBet: 10000,
    maxWin: 1000000,
    isLive: false,
    isNew: false,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'wheel',
    name: 'Wheel',
    slug: 'wheel',
    category: 'originals',
    description: 'Spin the wheel of fortune',
    rtp: 96,
    houseEdge: 4,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 50000,
    isLive: false,
    isNew: false,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'keno',
    name: 'Keno',
    slug: 'keno',
    category: 'originals',
    description: 'Pick your numbers and win big',
    rtp: 97,
    houseEdge: 3,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 400000,
    isLive: false,
    isNew: true,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'blackjack',
    name: 'Twenty One',
    slug: 'twenty-one',
    category: 'originals',
    description: 'Classic blackjack with Celora twist',
    rtp: 99.5,
    houseEdge: 0.5,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 50000,
    isLive: false,
    isNew: false,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'coin-climber',
    name: 'Coin Climber',
    slug: 'coin-climber',
    category: 'originals',
    description: 'Climb higher for bigger multipliers',
    rtp: 97,
    houseEdge: 3,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 50000,
    isLive: false,
    isNew: true,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'snake',
    name: 'Snake',
    slug: 'snake',
    category: 'originals',
    description: 'Guide the snake to collect rewards',
    rtp: 97,
    houseEdge: 3,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 50000,
    isLive: false,
    isNew: true,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'chicken',
    name: 'Chicken',
    slug: 'chicken',
    category: 'originals',
    description: 'Test your nerve crossing the road',
    rtp: 97,
    houseEdge: 3,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 50000,
    isLive: false,
    isNew: true,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
  {
    id: 'coin-flip',
    name: 'Coin Flip',
    slug: 'coin-flip',
    category: 'originals',
    description: 'Classic 50/50 coin flip',
    rtp: 98,
    houseEdge: 2,
    minBet: 0.1,
    maxBet: 5000,
    maxWin: 50000,
    isLive: false,
    isNew: true,
    isHot: false,
    players: 0,
    provider: 'Celora'
  },
]

// VIP Level configurations
export const VIP_LEVELS = {
  bronze: { minWager: 10000, rakeback: 5, levelUpBonus: 0, weeklyBonus: 0.1, monthlyBonus: 0.5 },
  silver: { minWager: 50000, rakeback: 10, levelUpBonus: 25, weeklyBonus: 0.2, monthlyBonus: 1 },
  gold: { minWager: 90000, rakeback: 15, levelUpBonus: 100, weeklyBonus: 0.3, monthlyBonus: 1.5 },
  platinum: { minWager: 150000, rakeback: 20, levelUpBonus: 500, weeklyBonus: 0.4, monthlyBonus: 2 },
  diamond: { minWager: 650000, rakeback: 25, levelUpBonus: 2500, weeklyBonus: 0.5, monthlyBonus: 2.5 },
  vip: { minWager: 1000000, rakeback: 30, levelUpBonus: 10000, weeklyBonus: 0.6, monthlyBonus: 3 },
  svip: { minWager: 5000000, rakeback: 35, levelUpBonus: 50000, weeklyBonus: 0.7, monthlyBonus: 3.5 },
}

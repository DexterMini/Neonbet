import { create } from 'zustand'

export type NotificationType = 'welcome' | 'win' | 'deposit' | 'withdraw' | 'vip' | 'promo' | 'game' | 'system' | 'bonus' | 'cashback'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: number
  read: boolean
  icon?: string
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number

  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  removeNotification: (id: string) => void
}

let nextId = 1

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [
    {
      id: 'default-1',
      type: 'welcome',
      title: 'Welcome to NeonBet!',
      message: 'Start playing and earn VIP rewards on every bet.',
      timestamp: Date.now() - 60000,
      read: false,
    },
    {
      id: 'default-2',
      type: 'game',
      title: 'New games added',
      message: 'Check out Coin Climber, Snake & Chicken Road!',
      timestamp: Date.now() - 120000,
      read: false,
    },
  ],
  unreadCount: 2,

  addNotification: (n) => {
    const id = `notif-${nextId++}-${Date.now()}`
    const notification: Notification = {
      ...n,
      id,
      timestamp: Date.now(),
      read: false,
    }
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50), // keep max 50
      unreadCount: state.unreadCount + 1,
    }))
  },

  markAsRead: (id) =>
    set((state) => {
      const n = state.notifications.find((x) => x.id === id)
      if (!n || n.read) return state
      return {
        notifications: state.notifications.map((x) => (x.id === id ? { ...x, read: true } : x)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((x) => ({ ...x, read: true })),
      unreadCount: 0,
    })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  removeNotification: (id) =>
    set((state) => {
      const n = state.notifications.find((x) => x.id === id)
      return {
        notifications: state.notifications.filter((x) => x.id !== id),
        unreadCount: n && !n.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      }
    }),
}))

// ── Simulated notification generator ──────────────────────────
// Generates realistic periodic notifications like a real casino
const PROMO_NOTIFICATIONS = [
  { title: '🔥 Happy Hour Active!', message: 'All slots have 10% cashback for the next 2 hours.' },
  { title: '🎰 Free Spins Available', message: 'Claim 25 free spins on Plinko — limited time!' },
  { title: '⚡ Turbo Tuesday', message: 'Earn 2x VIP points on all bets today.' },
  { title: '🏆 Tournament Starting', message: '$5,000 Crash tournament begins in 30 minutes!' },
  { title: '💰 Reload Bonus', message: 'Deposit now and get a 50% reload bonus up to $200.' },
  { title: '🎁 Mystery Box Ready', message: 'Your daily mystery box is ready to open!' },
  { title: '🔔 Weekend Special', message: 'Place 10 bets this weekend for a guaranteed bonus.' },
  { title: '🌟 Level Up Reward', message: 'You\'re close to the next VIP level — keep playing!' },
]

const WIN_NOTIFICATIONS = [
  { title: 'Big Win! 🎉', message: 'Congratulations! You won $42.50 on Crash.' },
  { title: 'Lucky Streak! 🍀', message: 'You hit a 5x multiplier on Dice!' },
  { title: 'Jackpot Alert! 💎', message: 'Someone just won $12,450 on Slots — could be you next!' },
  { title: 'Payout Processed ✅', message: 'Your withdrawal of $150.00 has been confirmed.' },
  { title: 'Cashback Credited 💸', message: '$3.20 cashback has been added to your balance.' },
]

const SYSTEM_NOTIFICATIONS = [
  { title: 'Maintenance Complete', message: 'All systems are running smoothly.' },
  { title: 'New Feature: Auto-Bet', message: 'Try the new auto-bet feature in Crash & Dice!' },
  { title: 'Security Update', message: 'We\'ve enhanced our security — your funds are safe.' },
  { title: 'Sports Betting Live!', message: 'Bet on live matches with real-time odds.' },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

let simulationStarted = false

export function startNotificationSimulation() {
  if (simulationStarted) return
  simulationStarted = true

  // First random notification after 30-90 seconds
  const firstDelay = 30000 + Math.random() * 60000
  setTimeout(() => {
    fireRandomNotification()
    // Then every 45-120 seconds
    setInterval(() => {
      fireRandomNotification()
    }, 45000 + Math.random() * 75000)
  }, firstDelay)
}

function fireRandomNotification() {
  const store = useNotificationStore.getState()
  const roll = Math.random()

  if (roll < 0.45) {
    // Promo
    const p = pickRandom(PROMO_NOTIFICATIONS)
    store.addNotification({ type: 'promo', title: p.title, message: p.message })
  } else if (roll < 0.75) {
    // Win/payout
    const w = pickRandom(WIN_NOTIFICATIONS)
    store.addNotification({ type: 'win', title: w.title, message: w.message })
  } else {
    // System
    const s = pickRandom(SYSTEM_NOTIFICATIONS)
    store.addNotification({ type: 'system', title: s.title, message: s.message })
  }
}

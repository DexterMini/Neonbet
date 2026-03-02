import { create } from 'zustand'

/* ── Types ──────────────────────────────────────────── */

export interface ChatMessage {
  id: string
  type: 'message' | 'win' | 'tip' | 'rain' | 'system'
  user: {
    name: string
    vipLevel: number
    avatar?: string
  }
  content: string
  timestamp: number
  /** For win messages */
  game?: string
  multiplier?: number
  amount?: number
  currency?: string
  /** For tip messages */
  recipient?: string
  /** For rain messages */
  rainAmount?: number
  rainCurrency?: string
  rainRecipients?: number
}

export interface RainEvent {
  id: string
  creator: string
  amount: number
  currency: string
  totalRecipients: number
  claimedBy: string[]
  expiresAt: number
  active: boolean
}

interface ChatState {
  messages: ChatMessage[]
  isOpen: boolean
  onlineCount: number
  rain: RainEvent | null
  isMuted: boolean

  // Actions
  toggle: () => void
  open: () => void
  close: () => void
  addMessage: (msg: ChatMessage) => void
  setOnlineCount: (n: number) => void
  startRain: (rain: RainEvent) => void
  claimRain: (userId: string) => void
  clearRain: () => void
  toggleMute: () => void
}

/* ── Fake users for simulation ──────────────────────── */
const fakeUsers = [
  { name: 'CryptoKing42', vipLevel: 5 },
  { name: 'LuckyAce', vipLevel: 3 },
  { name: 'DiamondHands', vipLevel: 4 },
  { name: 'moonWalker', vipLevel: 1 },
  { name: 'NeonPlayer', vipLevel: 2 },
  { name: 'HighRoller7', vipLevel: 6 },
  { name: 'BetMaster99', vipLevel: 3 },
  { name: 'xWinnerx', vipLevel: 1 },
  { name: 'SatoshiFan', vipLevel: 2 },
  { name: 'JackpotJoe', vipLevel: 4 },
  { name: 'GreenCandle', vipLevel: 0 },
  { name: 'DiceWhiz', vipLevel: 1 },
  { name: 'PlinkoMaster', vipLevel: 3 },
  { name: 'CrashQueen', vipLevel: 5 },
  { name: 'MinesSweeper', vipLevel: 2 },
]

const chatPhrases = [
  'gg!', 'nice hit!', 'lets gooo', 'anyone hitting tonight?',
  'crash is on fire rn', 'just deposited, wish me luck',
  'that multiplier was insane', 'who wants rain?',
  'this game is addicting lol', 'I love this site',
  'another L', 'mines is my fav game', 'LFG',
  'can someone explain plinko?', 'GL everyone',
  'bruh that crash', 'easy money', 'diamonds incoming',
  'vibes are immaculate', 'whos up?', 'that was close',
  'green green green', 'cant stop wont stop',
]

const games = ['Crash', 'Dice', 'Mines', 'Plinko', 'Limbo', 'Wheel', 'Keno', 'Twenty One']
const currencies = ['BTC', 'ETH', 'SOL', 'USDT', 'LTC']

let msgIdCounter = 0
function genId() { return `msg_${Date.now()}_${++msgIdCounter}` }

function randomUser() {
  return fakeUsers[Math.floor(Math.random() * fakeUsers.length)]
}

function generateRandomMessage(): ChatMessage {
  const roll = Math.random()

  // 30% chance of a win share
  if (roll < 0.30) {
    const user = randomUser()
    const game = games[Math.floor(Math.random() * games.length)]
    const mult = +(1 + Math.random() * 49).toFixed(2)
    const amount = +(0.001 + Math.random() * 2).toFixed(4)
    const currency = currencies[Math.floor(Math.random() * currencies.length)]
    return {
      id: genId(),
      type: 'win',
      user,
      content: '',
      timestamp: Date.now(),
      game,
      multiplier: mult,
      amount: +(amount * mult).toFixed(4),
      currency,
    }
  }

  // 5% chance of a tip
  if (roll < 0.35) {
    const user = randomUser()
    let recipient = randomUser()
    while (recipient.name === user.name) recipient = randomUser()
    const amount = +(0.0001 + Math.random() * 0.05).toFixed(4)
    const currency = currencies[Math.floor(Math.random() * currencies.length)]
    return {
      id: genId(),
      type: 'tip',
      user,
      content: '',
      timestamp: Date.now(),
      amount,
      currency,
      recipient: recipient.name,
    }
  }

  // Normal message
  const user = randomUser()
  const content = chatPhrases[Math.floor(Math.random() * chatPhrases.length)]
  return {
    id: genId(),
    type: 'message',
    user,
    content,
    timestamp: Date.now(),
  }
}

/* ── Initial seed messages ──────────────────────────── */
function seedMessages(count: number): ChatMessage[] {
  const msgs: ChatMessage[] = []
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    const msg = generateRandomMessage()
    msg.timestamp = now - (count - i) * 4000
    msgs.push(msg)
  }
  return msgs
}

/* ── Store ──────────────────────────────────────────── */
export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  onlineCount: 47,
  rain: null,
  isMuted: false,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages.slice(-200), msg], // keep last 200
    })),

  setOnlineCount: (n) => set({ onlineCount: n }),

  startRain: (rain) => set({ rain }),
  claimRain: (userId) =>
    set((s) => {
      if (!s.rain || !s.rain.active) return s
      if (s.rain.claimedBy.includes(userId)) return s
      return {
        rain: {
          ...s.rain,
          claimedBy: [...s.rain.claimedBy, userId],
          active: s.rain.claimedBy.length + 1 < s.rain.totalRecipients,
        },
      }
    }),
  clearRain: () => set({ rain: null }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
}))

/* ── Auto-generate messages (client side simulation) ── */
let intervalId: NodeJS.Timeout | null = null
let seeded = false

export function startChatSimulation() {
  if (!seeded) {
    seeded = true
    const initial = seedMessages(8)
    useChatStore.setState({ messages: initial, onlineCount: 32 + Math.floor(Math.random() * 30) })
  }
  if (intervalId) return
  intervalId = setInterval(() => {
    const msg = generateRandomMessage()
    useChatStore.getState().addMessage(msg)
  }, 8000 + Math.random() * 15000)

  // Occasionally fluctuate online count
  setInterval(() => {
    const current = useChatStore.getState().onlineCount
    const delta = Math.floor(Math.random() * 6) - 3
    useChatStore.getState().setOnlineCount(Math.max(15, Math.min(80, current + delta)))
  }, 30000)
}

export function stopChatSimulation() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export { generateRandomMessage }

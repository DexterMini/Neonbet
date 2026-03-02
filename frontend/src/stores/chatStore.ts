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

/* ── Store ──────────────────────────────────────────── */
export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  onlineCount: 0,
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

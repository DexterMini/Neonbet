import { create } from 'zustand'

/* ── Types ───────────────────────────────────────── */
export interface LiveBet {
  id: string
  username: string
  avatar: string
  game: string
  betAmount: number
  multiplier: number
  profit: number
  currency: string
  timestamp: number
}

interface LiveBetsState {
  bets: LiveBet[]
  myBets: LiveBet[]
  addBet: (bet: LiveBet) => void
  addMyBet: (bet: LiveBet) => void
}

/* ── Store ───────────────────────────────────────── */
export const useLiveBetsStore = create<LiveBetsState>((set) => ({
  bets: [],
  myBets: [],

  addBet: (bet) => set(s => ({ bets: [bet, ...s.bets].slice(0, 30) })),
  addMyBet: (bet) => set(s => ({
    bets: [bet, ...s.bets].slice(0, 30),
    myBets: [bet, ...s.myBets].slice(0, 50),
  })),
}))

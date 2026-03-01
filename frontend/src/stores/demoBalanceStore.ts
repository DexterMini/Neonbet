import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DemoBalanceState {
  balance: number
  setBalance: (b: number) => void
  deduct: (amount: number) => boolean // returns false if insufficient
  credit: (amount: number) => void
  refill: () => void
}

const INITIAL_BALANCE = 1000.00

export const useDemoBalance = create<DemoBalanceState>()(
  persist(
    (set, get) => ({
      balance: INITIAL_BALANCE,

      setBalance: (b) => set({ balance: Math.max(0, parseFloat(b.toFixed(2))) }),

      deduct: (amount) => {
        const current = get().balance
        if (amount > current) return false
        set({ balance: parseFloat((current - amount).toFixed(2)) })
        return true
      },

      credit: (amount) => {
        set({ balance: parseFloat((get().balance + amount).toFixed(2)) })
      },

      refill: () => set({ balance: INITIAL_BALANCE }),
    }),
    { name: 'neonbet-demo-balance' }
  )
)

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
const MAX_BALANCE = 1_000_000.00

export function formatDemoBalance(balance: number): string {
  if (balance >= 1_000_000) return `$${(balance / 1_000_000).toFixed(2)}M`
  if (balance >= 10_000) return `$${(balance / 1000).toFixed(1)}K`
  return `$${balance.toFixed(2)}`
}

export const useDemoBalance = create<DemoBalanceState>()(
  persist(
    (set, get) => ({
      balance: INITIAL_BALANCE,

      setBalance: (b) => set({ balance: Math.min(MAX_BALANCE, Math.max(0, parseFloat(b.toFixed(2)))) }),

      deduct: (amount) => {
        const current = get().balance
        if (amount > current) return false
        set({ balance: parseFloat((current - amount).toFixed(2)) })
        return true
      },

      credit: (amount) => {
        const newBal = Math.min(MAX_BALANCE, get().balance + amount)
        set({ balance: parseFloat(newBal.toFixed(2)) })
      },

      refill: () => set({ balance: INITIAL_BALANCE }),
    }),
    {
      name: 'neonbet-demo-balance',
      // Reset corrupted balances on rehydrate
      onRehydrateStorage: () => (state) => {
        if (state && state.balance > MAX_BALANCE) {
          state.setBalance(INITIAL_BALANCE)
        }
      },
    }
  )
)

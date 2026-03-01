import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type GameSpeed = 'normal' | 'fast' | 'instant'

interface SettingsState {
  // Toggles
  soundEnabled: boolean
  animationsEnabled: boolean
  hotkeysEnabled: boolean
  maxBetConfirm: boolean

  // Speed
  gameSpeed: GameSpeed

  // Actions
  setSoundEnabled: (v: boolean) => void
  setAnimationsEnabled: (v: boolean) => void
  setHotkeysEnabled: (v: boolean) => void
  setMaxBetConfirm: (v: boolean) => void
  setGameSpeed: (s: GameSpeed) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      animationsEnabled: true,
      hotkeysEnabled: true,
      maxBetConfirm: true,
      gameSpeed: 'normal',

      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setAnimationsEnabled: (v) => set({ animationsEnabled: v }),
      setHotkeysEnabled: (v) => set({ hotkeysEnabled: v }),
      setMaxBetConfirm: (v) => set({ maxBetConfirm: v }),
      setGameSpeed: (s) => set({ gameSpeed: s }),
    }),
    {
      name: 'neonbet-settings',
    }
  )
)

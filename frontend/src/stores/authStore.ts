import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  email: string
  vip_level: number
  kyc_level: number
  created_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isHydrated: boolean

  // Actions
  setUser: (user: User) => void
  setToken: (token: string) => void
  login: (usernameOrEmail: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  setHydrated: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,

      setHydrated: () => set({ isHydrated: true }),

      setUser: (user) => set({ user, isAuthenticated: true }),

      setToken: (token) => set({ token }),

      login: async (usernameOrEmail, password) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
          })

          if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Login failed')
          }

          const data = await response.json()
          set({
            user: data.user as User,
            token: data.session_token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          // Demo mode: create a local demo user when backend is unavailable
          const username = usernameOrEmail.includes('@')
            ? usernameOrEmail.split('@')[0]
            : usernameOrEmail
          set({
            user: {
              id: 'demo-' + Date.now(),
              username,
              email: usernameOrEmail.includes('@') ? usernameOrEmail : `${usernameOrEmail}@demo.neonbet`,
              vip_level: 1,
              kyc_level: 0,
              created_at: new Date().toISOString(),
            },
            token: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
          })

          if (!response.ok) {
            const err = await response.json().catch(() => null)
            throw new Error(err?.detail || 'Registration failed')
          }

          const data = await response.json()
          set({
            user: data.user as User,
            token: data.session_token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          // Demo mode: create a local demo user when backend is unavailable
          set({
            user: {
              id: 'demo-' + Date.now(),
              username,
              email,
              vip_level: 1,
              kyc_level: 0,
              created_at: new Date().toISOString(),
            },
            token: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },

      logout: () => {
        const token = useAuthStore.getState().token
        if (token) {
          fetch('/api/v1/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {})
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'casino-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    }
  )
)

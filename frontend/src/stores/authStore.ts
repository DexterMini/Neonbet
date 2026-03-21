import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  email: string
  vip_level: number
  kyc_level: number
  created_at: string
  is_admin?: boolean
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
  refreshToken: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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
        } catch (error: any) {
          set({ isLoading: false })
          throw error instanceof Error ? error : new Error('Login failed')
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
        } catch (error: any) {
          set({ isLoading: false })
          throw error instanceof Error ? error : new Error('Registration failed')
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      refreshToken: async () => {
        const currentToken = get().token
        if (!currentToken) return false
        try {
          const res = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentToken}` },
          })
          if (!res.ok) {
            get().logout()
            return false
          }
          const data = await res.json()
          set({ token: data.session_token })
          return true
        } catch {
          return false
        }
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

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name: string
  email: string
  role?: string
  company_name?: string
  avatar?: string
  vat_number?: string
  address?: string
  email_notifications?: boolean
  ai_notifications?: boolean
  is_fingerprint?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

export function clearLocalDbData(): void {
  if (typeof window === 'undefined') return
  const keys = Object.keys(localStorage)
  const keep = new Set(['britledger-auth-storage', 'britledger_users', 'britledger_device_id'])
  for (const key of keys) {
    if (key.startsWith('britledger_') && !keep.has(key)) {
      localStorage.removeItem(key)
    }
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'britledger-auth-storage',
    }
  )
)

import { create } from 'zustand'

interface AuthUser {
  id: string
  username: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  fetchUser: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, email?: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  loading: true,

  fetchUser: async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user, loading: false })
      } else {
        set({ user: null, loading: false })
      }
    } catch {
      set({ user: null, loading: false })
    }
  },

  login: async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Login failed')
    }
    const data = await res.json()
    set({ user: data.user })
  },

  register: async (username, password, email) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Registration failed')
    }
    const data = await res.json()
    set({ user: data.user })
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    set({ user: null })
  },
}))

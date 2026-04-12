import { create } from 'zustand'

export interface ProviderConfigItem {
  id: string
  configured: boolean
  docsUrl?: string | null
  values: Record<string, string>
}

interface ProviderState {
  providers: ProviderConfigItem[]
  loading: boolean
  error: string | null

  fetchProviderConfigs: () => Promise<void>
  saveProviderConfig: (
    providerId: string,
    values: Record<string, string>,
  ) => Promise<void>
  clearProviderConfig: (providerId: string) => Promise<void>
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  loading: false,
  error: null,

  fetchProviderConfigs: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/providers/config')
      if (!res.ok) throw new Error('Failed to fetch provider configs')
      const data = await res.json()
      set({ providers: data.providers, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  saveProviderConfig: async (providerId, values) => {
    const res = await fetch('/api/providers/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, values }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to save config')
    }
    await get().fetchProviderConfigs()
  },

  clearProviderConfig: async providerId => {
    const res = await fetch(`/api/providers/config/${providerId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to clear config')
    }
    await get().fetchProviderConfigs()
  },
}))

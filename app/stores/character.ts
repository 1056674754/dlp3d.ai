import { create } from 'zustand'

export interface CharacterItem {
  character_id: string
  character_name: string
  avatar: string
  prompt: string
  scene_name: string
  tts_adapter: string
  voice: string
  voice_speed: number
  asr_adapter: string
  conversation_adapter: string
  conversation_model_override: string
  classification_adapter: string
  classification_model_override: string
  reaction_adapter: string
  reaction_model_override: string
  memory_adapter: string
  memory_model_override: string
  read_only: boolean
  create_datatime: string
}

interface CharacterState {
  characters: CharacterItem[]
  selectedId: string | null
  loading: boolean

  fetchCharacters: () => Promise<void>
  selectCharacter: (id: string) => void
  updateCharacter: (
    characterId: string,
    data: Partial<
      Omit<CharacterItem, 'character_id' | 'read_only' | 'create_datatime'>
    >,
  ) => Promise<void>
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  selectedId: null,
  loading: false,

  fetchCharacters: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/characters')
      if (!res.ok) throw new Error('Failed to fetch characters')
      const data = await res.json()
      set({ characters: data.characters, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  selectCharacter: id => {
    set({ selectedId: id })
  },

  updateCharacter: async (characterId, data) => {
    const res = await fetch(`/api/characters/${characterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to update character')
    }
    await get().fetchCharacters()
  },
}))

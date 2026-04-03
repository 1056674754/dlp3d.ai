import type { Character } from '@/request/api'

/** Mirrors RN `CharacterConfig` in `android/src/bridge/types.ts` (camelCase JSON). */
export interface NativeChatItem {
  id: string
  characterId: string
  characterName: string
  prompt: string
  sceneIndex: number
  modelIndex: number
  createdAt: string
  updatedAt: string
}

export function characterToNativeChat(c: Character): NativeChatItem {
  return {
    id: c.character_id,
    characterId: c.character_id,
    characterName: c.character_name,
    prompt: '',
    sceneIndex: 0,
    modelIndex: 1,
    createdAt: '',
    updatedAt: '',
  }
}

import type { Character } from '@/request/api'
import type { CharacterConfig } from '@/types/character'

/** Mirrors RN `CharacterConfig` in `android/src/bridge/types.ts` (camelCase JSON). */
export interface NativeChatItem {
  id: string
  characterId: string
  characterName: string
  prompt: string
  avatarModelName: string
  readOnly?: boolean
  sceneIndex: number
  modelIndex: number
  createdAt: string
  updatedAt: string
}

/** Basic mapping from list-only Character data (no avatar/prompt). */
export function characterToNativeChat(c: Character): NativeChatItem {
  return {
    id: c.character_id,
    characterId: c.character_id,
    characterName: c.character_name,
    prompt: '',
    avatarModelName: '',
    sceneIndex: 0,
    modelIndex: 1,
    createdAt: '',
    updatedAt: '',
  }
}

/** Rich mapping from full CharacterConfig (has avatar, prompt, scene). */
export function characterConfigToNativeChat(c: CharacterConfig): NativeChatItem {
  return {
    id: c.character_id,
    characterId: c.character_id,
    characterName: c.character_name,
    prompt: c.prompt || '',
    avatarModelName: c.avatar || '',
    readOnly: c.read_only,
    sceneIndex: 0,
    modelIndex: 1,
    createdAt: c.create_datatime || '',
    updatedAt: '',
  }
}

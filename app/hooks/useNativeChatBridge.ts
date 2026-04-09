import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { getIsLogin } from '@/features/auth/authStore'
import { getUserInfo } from '@/features/auth/authStore'
import { getSelectedCharacterId } from '@/features/chat/chat'
import type { Character } from '@/request/api'
import { getCharacterConfig } from '@/request/api'
import { isNativeApp, onNativeMessage, sendToNative } from '@/utils/nativeBridge'
import {
  characterToNativeChat,
  characterConfigToNativeChat,
} from '@/utils/nativeChatSync'

export interface NativeChatBridgeParams {
  characters: Character[]
  selectCharacter: (id: string) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
  createChatFromTemplate: (modelIndex: number) => Promise<void>
}

/**
 * Syncs chat list / selection to the React Native host and handles native commands.
 */
export function useNativeChatBridge({
  characters,
  selectCharacter,
  deleteCharacter,
  createChatFromTemplate,
}: NativeChatBridgeParams) {
  const selectedCharacterId = useSelector(getSelectedCharacterId)
  const isLogin = useSelector(getIsLogin)
  const user = useSelector(getUserInfo)

  const handlersRef = useRef({
    selectCharacter,
    deleteCharacter,
    createChatFromTemplate,
  })
  handlersRef.current = {
    selectCharacter,
    deleteCharacter,
    createChatFromTemplate,
  }

  useEffect(() => {
    if (!isNativeApp() || !isLogin || !user?.id) return

    // Send basic data immediately so RN gets something fast
    sendToNative({
      type: 'chat:list:updated',
      payload: {
        chats: characters.map(characterToNativeChat),
        selectedCharacterId,
      },
    })

    // Then fetch full configs and send enriched data
    let cancelled = false
    ;(async () => {
      try {
        const results = await Promise.allSettled(
          characters.map(c => getCharacterConfig(user.id, c.character_id)),
        )
        if (cancelled) return
        const enriched = results.map((r, i) =>
          r.status === 'fulfilled'
            ? characterConfigToNativeChat(r.value)
            : characterToNativeChat(characters[i]),
        )
        sendToNative({
          type: 'chat:list:updated',
          payload: { chats: enriched, selectedCharacterId },
        })
      } catch {
        // basic data already sent, ignore enrichment failure
      }
    })()
    return () => {
      cancelled = true
    }
  }, [characters, selectedCharacterId, isLogin, user?.id])

  useEffect(() => {
    if (!isNativeApp()) return
    return onNativeMessage(detail => {
      if (!detail?.type) return
      const h = handlersRef.current
      if (detail.type === 'chat:select' && detail.payload?.chatId) {
        void h.selectCharacter(detail.payload.chatId as string)
      }
      if (detail.type === 'chat:delete' && detail.payload?.chatId) {
        void h.deleteCharacter(detail.payload.chatId as string)
      }
      if (detail.type === 'chat:requestNew') {
        const mi =
          typeof detail.payload?.modelIndex === 'number'
            ? detail.payload.modelIndex
            : 0
        void h.createChatFromTemplate(mi)
      }
    })
  }, [])
}

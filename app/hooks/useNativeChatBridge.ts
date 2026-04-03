import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { getIsLogin } from '@/features/auth/authStore'
import { getSelectedCharacterId } from '@/features/chat/chat'
import type { Character } from '@/request/api'
import { isNativeApp, onNativeMessage, sendToNative } from '@/utils/nativeBridge'
import { characterToNativeChat } from '@/utils/nativeChatSync'

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
    if (!isNativeApp() || !isLogin) return
    sendToNative({
      type: 'chat:list:updated',
      payload: {
        chats: characters.map(characterToNativeChat),
        selectedCharacterId,
      },
    })
  }, [characters, selectedCharacterId, isLogin])

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

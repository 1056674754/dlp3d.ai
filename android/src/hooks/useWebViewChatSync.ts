import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { CharacterConfig } from '@/bridge/types';
import { bridge } from '@/bridge/WebViewBridge';
import {
  setChatList,
  setSelectedChat,
  setSelectedCharacterId,
} from '@/store/chatSlice';

/**
 * Subscribes to Web → RN chat list updates. Lives outside WebView so it runs
 * even when the user opens the Chats tab before visiting Home.
 */
export function useWebViewChatSync() {
  const dispatch = useDispatch();

  useEffect(() => {
    const unsub = bridge.on('chat:list:updated', (payload: unknown) => {
      const p = payload as {
        chats: CharacterConfig[];
        selectedCharacterId?: string | null;
      };
      dispatch(setChatList(p.chats));
      if (p.selectedCharacterId) {
        const sel = p.chats.find(
          c => c.characterId === p.selectedCharacterId,
        );
        if (sel) {
          dispatch(setSelectedChat(sel));
        }
        dispatch(setSelectedCharacterId(p.selectedCharacterId));
      }
    });
    return unsub;
  }, [dispatch]);
}

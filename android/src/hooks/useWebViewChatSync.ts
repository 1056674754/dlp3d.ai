import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { CharacterConfig } from '@/bridge/types';
import { bridge } from '@/bridge/WebViewBridge';
import type { RootState } from '@/store';
import { restoreDashboardSession } from '@/services/api';
import {
  fetchCharacterConfig,
  fetchDashboardCharacters,
  type DashboardCharacterDto,
} from '@/services/characterSettingsApi';
import {
  markChatUsed,
  setChatList,
  setSelectedChat,
  setSelectedCharacterId,
} from '@/store/chatSlice';

function needsNativeEnrichment(chat: CharacterConfig): boolean {
  return (
    !chat.avatarModelName ||
    chat.readOnly === undefined ||
    chat.prompt.trim().length === 0
  );
}

function mergeConfigIntoChat(
  chat: CharacterConfig,
  config: Awaited<ReturnType<typeof fetchCharacterConfig>>,
): CharacterConfig {
  return {
    ...chat,
    characterName: config.character_name || chat.characterName,
    prompt: config.prompt ?? chat.prompt,
    avatarModelName: config.avatar ?? chat.avatarModelName,
    readOnly: config.read_only,
    createdAt: config.create_datatime ?? chat.createdAt,
  };
}

function dashboardCharacterToChat(
  config: DashboardCharacterDto,
): CharacterConfig {
  return {
    id: config.character_id,
    characterId: config.character_id,
    characterName: config.character_name,
    prompt: config.prompt || '',
    avatarModelName: config.avatar || '',
    readOnly: config.read_only,
    sceneIndex: 0,
    modelIndex: 1,
    createdAt: config.create_datatime || '',
    updatedAt: '',
  };
}

/**
 * Subscribes to Web → RN chat list updates. Lives outside WebView so it runs
 * even when the user opens the Chats tab before visiting Home.
 */
export function useWebViewChatSync() {
  const dispatch = useDispatch();
  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);
  const userId = useSelector((state: RootState) => state.auth.userInfo.id);
  const email = useSelector((state: RootState) => state.auth.userInfo.email);
  const enrichRequestIdRef = useRef(0);

  useEffect(() => {
    if (!serverUrl || !userId || !email) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const loadDashboardChats = async (): Promise<
        CharacterConfig[] | null
      > => {
        try {
          const dashboardCharacters = await fetchDashboardCharacters(serverUrl);
          return dashboardCharacters.map(dashboardCharacterToChat);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (message.includes('401') || message.includes('Unauthorized')) {
            const restored = await restoreDashboardSession(serverUrl, email);
            if (restored) {
              const dashboardCharacters =
                await fetchDashboardCharacters(serverUrl);
              return dashboardCharacters.map(dashboardCharacterToChat);
            }
          }
          return null;
        }
      };

      const dashboardChats = await loadDashboardChats();
      if (!cancelled && dashboardChats && dashboardChats.length > 0) {
        dispatch(setChatList(dashboardChats));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, email, serverUrl, userId]);

  useEffect(() => {
    const unsub = bridge.on('chat:list:updated', (payload: unknown) => {
      const p = payload as {
        chats: CharacterConfig[];
        selectedCharacterId?: string | null;
      };
      dispatch(setChatList(p.chats));
      if (p.selectedCharacterId) {
        const sel = p.chats.find(c => c.characterId === p.selectedCharacterId);
        if (sel) {
          dispatch(setSelectedChat(sel));
        }
        dispatch(setSelectedCharacterId(p.selectedCharacterId));
        dispatch(markChatUsed({ characterId: p.selectedCharacterId }));
      } else if (p.chats.length === 0) {
        dispatch(setSelectedChat(null));
        dispatch(setSelectedCharacterId(null));
      }

      if (!serverUrl || !userId) {
        return;
      }

      const requestId = ++enrichRequestIdRef.current;
      const applySelectedChat = (items: CharacterConfig[]) => {
        if (!p.selectedCharacterId) {
          return;
        }
        const selected = items.find(
          chat => chat.characterId === p.selectedCharacterId,
        );
        if (selected) {
          dispatch(setSelectedChat(selected));
        }
      };

      void (async () => {
        const tryLoadDashboardChats = async (): Promise<
          CharacterConfig[] | null
        > => {
          try {
            const dashboardCharacters =
              await fetchDashboardCharacters(serverUrl);
            return dashboardCharacters.map(dashboardCharacterToChat);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            if (
              email &&
              (message.includes('401') || message.includes('Unauthorized'))
            ) {
              const restored = await restoreDashboardSession(serverUrl, email);
              if (restored) {
                const dashboardCharacters =
                  await fetchDashboardCharacters(serverUrl);
                return dashboardCharacters.map(dashboardCharacterToChat);
              }
            }
            return null;
          }
        };

        const dashboardChats = await tryLoadDashboardChats();
        if (requestId !== enrichRequestIdRef.current) {
          return;
        }
        if (dashboardChats && dashboardChats.length > 0) {
          dispatch(setChatList(dashboardChats));
          applySelectedChat(dashboardChats);
          return;
        }

        const chatsToEnrich = p.chats.filter(needsNativeEnrichment);
        if (chatsToEnrich.length === 0) {
          return;
        }

        const results = await Promise.allSettled(
          chatsToEnrich.map(chat =>
            fetchCharacterConfig(serverUrl, userId, chat.characterId),
          ),
        );
        if (requestId !== enrichRequestIdRef.current) {
          return;
        }

        const configsByCharacterId = new Map<string, CharacterConfig>();
        chatsToEnrich.forEach((chat, index) => {
          const result = results[index];
          if (result.status === 'fulfilled') {
            configsByCharacterId.set(
              chat.characterId,
              mergeConfigIntoChat(chat, result.value),
            );
          }
        });

        if (configsByCharacterId.size === 0) {
          return;
        }

        const enrichedChats = p.chats.map(
          chat => configsByCharacterId.get(chat.characterId) ?? chat,
        );
        dispatch(setChatList(enrichedChats));
        applySelectedChat(enrichedChats);
      })();
    });
    return unsub;
  }, [dispatch, email, serverUrl, userId]);

  useEffect(() => {
    const unsub = bridge.on('character:changed', (payload: unknown) => {
      const p = payload as { characterId?: string | null };
      if (!p?.characterId) {
        return;
      }
      dispatch(setSelectedCharacterId(p.characterId));
      dispatch(markChatUsed({ characterId: p.characterId }));
    });
    return unsub;
  }, [dispatch]);
}

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CharacterConfig } from '@/bridge/types';

function hasText(value?: string): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mergeChatConfig(
  existing: CharacterConfig | undefined,
  incoming: CharacterConfig,
): CharacterConfig {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    ...incoming,
    characterName: hasText(incoming.characterName)
      ? incoming.characterName
      : existing.characterName,
    prompt: hasText(incoming.prompt) ? incoming.prompt : existing.prompt,
    avatarModelName: hasText(incoming.avatarModelName)
      ? incoming.avatarModelName
      : existing.avatarModelName,
    readOnly:
      incoming.readOnly === undefined ? existing.readOnly : incoming.readOnly,
    createdAt: hasText(incoming.createdAt)
      ? incoming.createdAt
      : existing.createdAt,
    updatedAt: hasText(incoming.updatedAt)
      ? incoming.updatedAt
      : existing.updatedAt,
    wakeWord: hasText(incoming.wakeWord) ? incoming.wakeWord : existing.wakeWord,
  };
}

export interface ChatState {
  isChatStarting: boolean;
  selectedModelIndex: number;
  selectedCharacterId: string | null;
  settingsCharacterId: string | null;
  isCharacterLoading: boolean;
  loadingText: string;
  isSceneLoading: boolean;
  loadingProgress: number;
  chatList: CharacterConfig[];
  selectedChat: CharacterConfig | null;
  lastUsedAtByCharacterId: Record<string, number>;
}

const initialState: ChatState = {
  isChatStarting: false,
  selectedModelIndex: 1,
  selectedCharacterId: null,
  settingsCharacterId: null,
  isCharacterLoading: false,
  loadingText: 'Loading...',
  isSceneLoading: true,
  loadingProgress: 100,
  chatList: [],
  selectedChat: null,
  lastUsedAtByCharacterId: {},
};

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setIsChatStarting: (state, { payload }: PayloadAction<boolean>) => {
      state.isChatStarting = payload;
    },
    setSelectedModelIndex: (state, { payload }: PayloadAction<number>) => {
      state.selectedModelIndex = payload;
    },
    setSelectedCharacterId: (
      state,
      { payload }: PayloadAction<string | null>,
    ) => {
      state.selectedCharacterId = payload;
    },
    setSettingsCharacterId: (
      state,
      { payload }: PayloadAction<string | null>,
    ) => {
      state.settingsCharacterId = payload;
    },
    setIsCharacterLoading: (state, { payload }: PayloadAction<boolean>) => {
      state.isCharacterLoading = payload;
    },
    setLoadingText: (state, { payload }: PayloadAction<string>) => {
      state.loadingText = payload;
    },
    setIsSceneLoading: (state, { payload }: PayloadAction<boolean>) => {
      state.isSceneLoading = payload;
    },
    setLoadingProgress: (state, { payload }: PayloadAction<number>) => {
      state.loadingProgress = payload;
    },
    setChatList: (state, { payload }: PayloadAction<CharacterConfig[]>) => {
      const currentChatList = Array.isArray(state.chatList) ? state.chatList : [];
      const existingById = new Map(
        currentChatList.map(chat => [chat.characterId, chat]),
      );
      state.chatList = payload.map(chat =>
        mergeChatConfig(existingById.get(chat.characterId), chat),
      );
      if (state.selectedCharacterId) {
        state.selectedChat =
          state.chatList.find(
            chat => chat.characterId === state.selectedCharacterId,
          ) ?? state.selectedChat;
      }
    },
    setSelectedChat: (
      state,
      { payload }: PayloadAction<CharacterConfig | null>,
    ) => {
      const currentChatList = Array.isArray(state.chatList) ? state.chatList : [];
      state.selectedChat = payload
        ? mergeChatConfig(
            currentChatList.find(
              chat => chat.characterId === payload.characterId,
            ),
            payload,
          )
        : null;
    },
    markChatUsed: (
      state,
      { payload }: PayloadAction<{ characterId: string; usedAt?: number }>,
    ) => {
      if (!payload.characterId) {
        return;
      }
      if (
        !state.lastUsedAtByCharacterId ||
        typeof state.lastUsedAtByCharacterId !== 'object'
      ) {
        state.lastUsedAtByCharacterId = {};
      }
      state.lastUsedAtByCharacterId[payload.characterId] =
        payload.usedAt ?? Date.now();
    },
  },
  selectors: {
    getIsChatStarting: state => state.isChatStarting,
    getSelectedModelIndex: state => state.selectedModelIndex,
    getSelectedCharacterId: state => state.selectedCharacterId,
    getSettingsCharacterId: state => state.settingsCharacterId,
    getIsCharacterLoading: state => state.isCharacterLoading,
    getLoadingText: state => state.loadingText,
    getIsSceneLoading: state => state.isSceneLoading,
    getLoadingProgress: state => state.loadingProgress,
    getChatList: state => state.chatList,
    getSelectedChat: state => state.selectedChat,
    getLastUsedAtByCharacterId: state => state.lastUsedAtByCharacterId,
  },
});

export const {
  setIsChatStarting,
  setSelectedModelIndex,
  setSelectedCharacterId,
  setSettingsCharacterId,
  setIsCharacterLoading,
  setLoadingText,
  setIsSceneLoading,
  setLoadingProgress,
  setChatList,
  setSelectedChat,
  markChatUsed,
} = chatSlice.actions;

export const {
  getIsChatStarting,
  getSelectedModelIndex,
  getSelectedCharacterId,
  getSettingsCharacterId,
  getIsCharacterLoading,
  getLoadingText,
  getIsSceneLoading,
  getLoadingProgress,
  getChatList,
  getSelectedChat,
  getLastUsedAtByCharacterId,
} = chatSlice.selectors;

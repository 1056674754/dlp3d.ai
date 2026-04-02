import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CharacterConfig } from '@/bridge/types';

export interface ChatState {
  isChatStarting: boolean;
  selectedModelIndex: number;
  selectedCharacterId: string | null;
  isCharacterLoading: boolean;
  loadingText: string;
  isSceneLoading: boolean;
  loadingProgress: number;
  chatList: CharacterConfig[];
  selectedChat: CharacterConfig | null;
}

const initialState: ChatState = {
  isChatStarting: false,
  selectedModelIndex: 1,
  selectedCharacterId: null,
  isCharacterLoading: false,
  loadingText: 'Loading...',
  isSceneLoading: true,
  loadingProgress: 100,
  chatList: [],
  selectedChat: null,
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
      state.chatList = payload;
    },
    setSelectedChat: (
      state,
      { payload }: PayloadAction<CharacterConfig | null>,
    ) => {
      state.selectedChat = payload;
    },
  },
  selectors: {
    getIsChatStarting: state => state.isChatStarting,
    getSelectedModelIndex: state => state.selectedModelIndex,
    getSelectedCharacterId: state => state.selectedCharacterId,
    getIsCharacterLoading: state => state.isCharacterLoading,
    getLoadingText: state => state.loadingText,
    getIsSceneLoading: state => state.isSceneLoading,
    getLoadingProgress: state => state.loadingProgress,
    getChatList: state => state.chatList,
    getSelectedChat: state => state.selectedChat,
  },
});

export const {
  setIsChatStarting,
  setSelectedModelIndex,
  setSelectedCharacterId,
  setIsCharacterLoading,
  setLoadingText,
  setIsSceneLoading,
  setLoadingProgress,
  setChatList,
  setSelectedChat,
} = chatSlice.actions;

export const {
  getIsChatStarting,
  getSelectedModelIndex,
  getSelectedCharacterId,
  getIsCharacterLoading,
  getLoadingText,
  getIsSceneLoading,
  getLoadingProgress,
  getChatList,
  getSelectedChat,
} = chatSlice.selectors;

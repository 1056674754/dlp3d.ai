import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

export interface AppState {
  /** API / 业务后端（LLM 等） */
  serverUrl: string;
  /**
   * 角色 GLB 静态根 URL（与 `public/characters/` 同路径结构）。空字符串表示沿用 serverUrl。
   * 可与 API 不同机 / 不同 CDN。
   */
  characterAssetsBaseUrl: string;
  /**
   * 地面 GLB + HDR 静态根 URL（`public/models/ground/`、`public/img/hdr/`）。空则沿用 serverUrl。
   */
  sceneAssetsBaseUrl: string;
  language: 'en' | 'zh';
  theme: 'light' | 'dark';
  isWebViewReady: boolean;
  debugMode: boolean;
}

const initialState: AppState = {
  serverUrl: 'https://dlp3d.s-s.city',
  characterAssetsBaseUrl: '',
  sceneAssetsBaseUrl: '',
  language: 'en',
  theme: 'dark',
  isWebViewReady: false,
  debugMode: false,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setServerUrl: (state, { payload }: PayloadAction<string>) => {
      state.serverUrl = payload;
    },
    setCharacterAssetsBaseUrl: (state, { payload }: PayloadAction<string>) => {
      state.characterAssetsBaseUrl = payload;
    },
    setSceneAssetsBaseUrl: (state, { payload }: PayloadAction<string>) => {
      state.sceneAssetsBaseUrl = payload;
    },
    setLanguage: (state, { payload }: PayloadAction<'en' | 'zh'>) => {
      state.language = payload;
    },
    setTheme: (state, { payload }: PayloadAction<'light' | 'dark'>) => {
      state.theme = payload;
    },
    setIsWebViewReady: (state, { payload }: PayloadAction<boolean>) => {
      state.isWebViewReady = payload;
    },
    setDebugMode: (state, { payload }: PayloadAction<boolean>) => {
      state.debugMode = payload;
    },
  },
  extraReducers: builder => {
    /** 旧版持久化里没有新字段时合并 initialState，避免 characterAssetsBaseUrl 等为 undefined */
    builder.addCase(REHYDRATE, (state, action) => {
      const payload = (action as { payload?: { app?: Partial<AppState> } })
        .payload;
      const incoming = payload?.app;
      if (incoming) {
        return { ...initialState, ...incoming };
      }
      return state ?? initialState;
    });
  },
  selectors: {
    getServerUrl: state => state.serverUrl,
    getCharacterAssetsBaseUrl: state => state.characterAssetsBaseUrl,
    getSceneAssetsBaseUrl: state => state.sceneAssetsBaseUrl,
    getLanguage: state => state.language,
    getTheme: state => state.theme,
    getIsWebViewReady: state => state.isWebViewReady,
    getDebugMode: state => state.debugMode,
  },
});

export const {
  setServerUrl,
  setCharacterAssetsBaseUrl,
  setSceneAssetsBaseUrl,
  setLanguage,
  setTheme,
  setIsWebViewReady,
  setDebugMode,
} = appSlice.actions;
export const {
  getServerUrl,
  getCharacterAssetsBaseUrl,
  getSceneAssetsBaseUrl,
  getLanguage,
  getTheme,
  getIsWebViewReady,
  getDebugMode,
} = appSlice.selectors;

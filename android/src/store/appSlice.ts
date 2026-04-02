import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AppState {
  serverUrl: string;
  language: 'en' | 'zh';
  theme: 'light' | 'dark';
  isWebViewReady: boolean;
}

const initialState: AppState = {
  serverUrl: 'https://dlp3d.s-s.city',
  language: 'en',
  theme: 'dark',
  isWebViewReady: false,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setServerUrl: (state, { payload }: PayloadAction<string>) => {
      state.serverUrl = payload;
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
  },
  selectors: {
    getServerUrl: state => state.serverUrl,
    getLanguage: state => state.language,
    getTheme: state => state.theme,
    getIsWebViewReady: state => state.isWebViewReady,
  },
});

export const { setServerUrl, setLanguage, setTheme, setIsWebViewReady } =
  appSlice.actions;
export const { getServerUrl, getLanguage, getTheme, getIsWebViewReady } =
  appSlice.selectors;

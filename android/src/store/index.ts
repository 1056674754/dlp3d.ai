import { combineReducers } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authSlice } from './authSlice';
import { chatSlice } from './chatSlice';
import { appSlice } from './appSlice';
import { nativeAssetDownloadSlice } from './nativeAssetDownloadSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'app', 'chat'],
};

const rootReducer = combineReducers({
  auth: authSlice.reducer,
  chat: chatSlice.reducer,
  app: appSlice.reducer,
  nativeAssetDownload: nativeAssetDownloadSlice.reducer,
});

export const persistedReducer = persistReducer(persistConfig, rootReducer);

export type RootState = ReturnType<typeof rootReducer>;

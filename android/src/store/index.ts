import { combineReducers } from '@reduxjs/toolkit';
import { configureStore } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';
import { persistStore } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authSlice } from './authSlice';
import { chatSlice } from './chatSlice';
import { appSlice } from './appSlice';
import { nativeAssetDownloadSlice } from './nativeAssetDownloadSlice';
import { wakeWordSlice } from './wakeWordSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'app', 'chat', 'wakeWord'],
};

const rootReducer = combineReducers({
  auth: authSlice.reducer,
  chat: chatSlice.reducer,
  app: appSlice.reducer,
  nativeAssetDownload: nativeAssetDownloadSlice.reducer,
  wakeWord: wakeWordSlice.reducer,
});

export const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, UserInfo } from './authShared';

const initialState: AuthState = {
  isLogin: false,
  userInfo: {
    username: '',
    email: '',
    id: '',
  },
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setIsLogin: (state, action: PayloadAction<boolean>) => {
      state.isLogin = action.payload;
      if (!action.payload) {
        state.userInfo = { username: '', email: '', id: '' };
      }
    },
    setUserInfo: (state, action: PayloadAction<UserInfo>) => {
      state.userInfo = action.payload;
      state.isLogin = true;
    },
    setAuthState: (
      state,
      action: PayloadAction<{ isLogin: boolean; userInfo: UserInfo }>,
    ) => {
      state.isLogin = action.payload.isLogin;
      state.userInfo = action.payload.userInfo;
    },
    logout: state => {
      state.isLogin = false;
      state.userInfo = { username: '', email: '', id: '' };
    },
  },
  selectors: {
    getIsLogin: state => state.isLogin,
    getUserInfo: state => state.userInfo,
  },
});

export const { setIsLogin, setUserInfo, setAuthState, logout } =
  authSlice.actions;
export const { getIsLogin, getUserInfo } = authSlice.selectors;

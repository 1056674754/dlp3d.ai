export interface AuthState {
  isLogin: boolean;
  userInfo: UserInfo;
}

export interface UserInfo {
  username: string;
  email: string;
  id: string;
}

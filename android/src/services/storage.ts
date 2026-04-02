import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  AUTH_TOKEN: '@dlp3d:auth_token',
  USER_INFO: '@dlp3d:user_info',
  LANGUAGE: '@dlp3d:language',
  THEME: '@dlp3d:theme',
  SERVER_URL: '@dlp3d:server_url',
};

export const storage = {
  async set(key: string, value: unknown) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },

  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  },

  KEYS,
};

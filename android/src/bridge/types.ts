/**
 * Bridge message types for RN ↔ WebView communication.
 */

import type { NativeAssetManifest } from '@/services/nativeAssets';

// ─── Shared types ───────────────────────────────────────────────

export type { NativeAssetManifest };

export interface UserInfo {
  username: string;
  email: string;
  id: string;
}

export interface Character {
  id: string;
  name: string;
  modelIndex: number;
  avatarUrl?: string;
}

export interface CharacterConfig {
  id: string;
  characterId: string;
  characterName: string;
  prompt: string;
  sceneIndex: number;
  modelIndex: number;
  createdAt: string;
  updatedAt: string;
}

// ─── WebView → Native ──────────────────────────────────────────

export type WebViewToNativeEvent =
  | { type: 'auth:status'; payload: { isLoggedIn: boolean; user?: UserInfo } }
  | { type: 'chat:start'; payload: { characterId: string; sceneIndex: number } }
  | { type: 'chat:message'; payload: { role: string; content: string } }
  | { type: 'scene:changed'; payload: { sceneIndex: number } }
  | { type: 'character:changed'; payload: { characterId: string; modelIndex: number } }
  | { type: 'loading:state'; payload: { isLoading: boolean; progress?: number; text?: string } }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'ready'; payload: Record<string, never> }
  | { type: 'screenshot'; payload: { dataUrl: string } }
  | { type: 'settings:open'; payload: { panel: string } }
  | {
      type: 'chat:list:updated';
      payload: {
        chats: CharacterConfig[];
        selectedCharacterId?: string | null;
      };
    };

// ─── Native → WebView ──────────────────────────────────────────

export type NativeToWebViewEvent =
  | { type: 'auth:token'; payload: { token: string } }
  | { type: 'auth:logout'; payload: Record<string, never> }
  | { type: 'chat:select'; payload: { chatId: string } }
  | { type: 'chat:delete'; payload: { chatId: string } }
  | { type: 'config:update'; payload: Record<string, unknown> }
  | { type: 'language:change'; payload: { lang: string } }
  | { type: 'theme:change'; payload: { theme: 'light' | 'dark' } }
  | { type: 'webview:navigate'; payload: { path: string } }
  | { type: 'character:select'; payload: { characterId: string; modelIndex: number } }
  | { type: 'scene:select'; payload: { sceneIndex: number } }
  | { type: 'chat:requestNew'; payload: { modelIndex?: number } }
  | { type: 'assets:manifest'; payload: NativeAssetManifest }
  | { type: 'face:position'; payload: { x: number; y: number } };

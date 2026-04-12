/**
 * Backend character / LLM settings (same routes as web `app/request/api.ts`).
 */

import { pushDebugLog } from '@/store/debugLogStore';

function buildUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  return `${base}/api/v1/${path}`;
}

function buildConfigUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  return `${base}/api/v4/${path}`;
}

function buildDashboardUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  return `${base}/api/${path}`;
}

async function getJson<T>(serverUrl: string, path: string): Promise<T> {
  const t0 = Date.now();
  pushDebugLog('api', `GET ${path}`);
  const response = await fetch(buildUrl(serverUrl, path));
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const result = await response.json();
      message = result.detail?.error || result.message || message;
    } catch {
      /* ignore */
    }
    pushDebugLog('api', `✗ ${path} ${response.status} ${Date.now() - t0}ms`);
    throw new Error(message);
  }
  pushDebugLog('api', `✓ ${path} ${response.status} ${Date.now() - t0}ms`);
  return response.json() as Promise<T>;
}

async function postJson<T>(
  serverUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const t0 = Date.now();
  pushDebugLog('api', `POST ${path}`);
  const response = await fetch(buildUrl(serverUrl, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const result = await response.json();
      message = result.detail?.error || result.message || message;
    } catch {
      /* ignore */
    }
    pushDebugLog('api', `✗ ${path} ${response.status} ${Date.now() - t0}ms`);
    throw new Error(message);
  }
  const text = await response.text();
  pushDebugLog('api', `✓ ${path} ${response.status} ${Date.now() - t0}ms`);
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

async function getDashboardJson<T>(
  serverUrl: string,
  path: string,
): Promise<T> {
  const t0 = Date.now();
  pushDebugLog('api', `GET dashboard/${path}`);
  const response = await fetch(buildDashboardUrl(serverUrl, path), {
    credentials: 'include',
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const result = await response.json();
      message = result.error || result.detail?.error || result.message || message;
    } catch {
      /* ignore */
    }
    pushDebugLog(
      'api',
      `✗ dashboard/${path} ${response.status} ${Date.now() - t0}ms`,
    );
    throw new Error(message);
  }
  pushDebugLog(
    'api',
    `✓ dashboard/${path} ${response.status} ${Date.now() - t0}ms`,
  );
  return response.json() as Promise<T>;
}

async function patchDashboardJson<T>(
  serverUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const t0 = Date.now();
  pushDebugLog('api', `PATCH dashboard/${path}`);
  const response = await fetch(buildDashboardUrl(serverUrl, path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const result = await response.json();
      message = result.error || result.detail?.error || result.message || message;
    } catch {
      /* ignore */
    }
    pushDebugLog(
      'api',
      `✗ dashboard/${path} ${response.status} ${Date.now() - t0}ms`,
    );
    throw new Error(message);
  }
  const text = await response.text();
  pushDebugLog(
    'api',
    `✓ dashboard/${path} ${response.status} ${Date.now() - t0}ms`,
  );
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export interface LLMProviderDto {
  options: string[];
}

export interface AdapterChoicesDto {
  choices: string[];
}

export interface VoiceNamesDto {
  voice_names: Record<string, string>;
}

/** Subset of web `CharacterConfig` fields used in native settings. */
export interface CharacterConfigDto {
  character_id: string;
  character_name: string;
  read_only: boolean;
  create_datatime?: string;
  scene_name: string;
  prompt: string;
  avatar?: string;
  classification_adapter?: string;
  classification_model_override?: string;
  conversation_adapter: string;
  conversation_model_override?: string;
  reaction_adapter?: string;
  reaction_model_override?: string;
  memory_adapter?: string;
  memory_model_override?: string;
  asr_adapter: string;
  tts_adapter: string;
  voice: string;
  voice_speed: number;
  wake_word?: string;
}

export type DashboardCharacterDto = CharacterConfigDto;

export async function fetchAvailableLlm(
  serverUrl: string,
  userId: string,
): Promise<LLMProviderDto> {
  return getJson<LLMProviderDto>(serverUrl, `get_available_llm/${userId}`);
}

export async function fetchAvailableAsr(
  serverUrl: string,
  userId: string,
): Promise<LLMProviderDto> {
  return getJson<LLMProviderDto>(serverUrl, `get_available_asr/${userId}`);
}

export async function fetchConversationChoices(
  serverUrl: string,
): Promise<AdapterChoicesDto> {
  return fetchConfigChoices(serverUrl, 'conversation_adapter_choices');
}

export async function fetchReactionChoices(
  serverUrl: string,
): Promise<AdapterChoicesDto> {
  return fetchConfigChoices(serverUrl, 'reaction_adapter_choices');
}

export async function fetchClassificationChoices(
  serverUrl: string,
): Promise<AdapterChoicesDto> {
  return fetchConfigChoices(serverUrl, 'classification_adapter_choices');
}

export async function fetchMemoryChoices(
  serverUrl: string,
): Promise<AdapterChoicesDto> {
  return fetchConfigChoices(serverUrl, 'memory_adapter_choices');
}

async function fetchConfigChoices(
  serverUrl: string,
  path: string,
): Promise<AdapterChoicesDto> {
  const t0 = Date.now();
  pushDebugLog('api', `GET ${path}`);
  const response = await fetch(buildConfigUrl(serverUrl, path));
  if (!response.ok) {
    pushDebugLog(
      'api',
      `✗ ${path} ${response.status} ${Date.now() - t0}ms`,
    );
    throw new Error(`HTTP ${response.status}`);
  }
  pushDebugLog(
    'api',
    `✓ ${path} ${response.status} ${Date.now() - t0}ms`,
  );
  return response.json() as Promise<AdapterChoicesDto>;
}

export async function fetchAsrChoices(
  serverUrl: string,
): Promise<AdapterChoicesDto> {
  const t0 = Date.now();
  pushDebugLog('api', 'GET asr_adapter_choices');
  const response = await fetch(
    buildConfigUrl(serverUrl, 'asr_adapter_choices'),
  );
  if (!response.ok) {
    pushDebugLog(
      'api',
      `✗ asr_adapter_choices ${response.status} ${Date.now() - t0}ms`,
    );
    throw new Error(`HTTP ${response.status}`);
  }
  pushDebugLog(
    'api',
    `✓ asr_adapter_choices ${response.status} ${Date.now() - t0}ms`,
  );
  return response.json() as Promise<AdapterChoicesDto>;
}

export async function fetchTtsChoices(
  serverUrl: string,
): Promise<AdapterChoicesDto> {
  const t0 = Date.now();
  pushDebugLog('api', 'GET tts_adapter_choices');
  const response = await fetch(
    buildConfigUrl(serverUrl, 'tts_adapter_choices'),
  );
  if (!response.ok) {
    pushDebugLog(
      'api',
      `✗ tts_adapter_choices ${response.status} ${Date.now() - t0}ms`,
    );
    throw new Error(`HTTP ${response.status}`);
  }
  pushDebugLog(
    'api',
    `✓ tts_adapter_choices ${response.status} ${Date.now() - t0}ms`,
  );
  return response.json() as Promise<AdapterChoicesDto>;
}

export async function fetchAvailableTts(
  serverUrl: string,
  userId: string,
): Promise<LLMProviderDto> {
  return getJson<LLMProviderDto>(serverUrl, `get_available_tts/${userId}`);
}

export async function fetchTtsVoiceNames(
  serverUrl: string,
  ttsAdapter: string,
): Promise<VoiceNamesDto> {
  const t0 = Date.now();
  pushDebugLog('api', `GET tts_voice_names/${ttsAdapter}`);
  const response = await fetch(
    buildConfigUrl(
      serverUrl,
      `tts_voice_names/${encodeURIComponent(ttsAdapter)}`,
    ),
  );
  if (!response.ok) {
    pushDebugLog(
      'api',
      `✗ tts_voice_names/${ttsAdapter} ${response.status} ${Date.now() - t0}ms`,
    );
    throw new Error(`HTTP ${response.status}`);
  }
  pushDebugLog(
    'api',
    `✓ tts_voice_names/${ttsAdapter} ${response.status} ${Date.now() - t0}ms`,
  );
  return response.json() as Promise<VoiceNamesDto>;
}

export async function fetchCharacterConfig(
  serverUrl: string,
  userId: string,
  characterId: string,
): Promise<CharacterConfigDto> {
  return getJson<CharacterConfigDto>(
    serverUrl,
    `get_character_config/${userId}/${characterId}`,
  );
}

export async function fetchDashboardCharacters(
  serverUrl: string,
): Promise<DashboardCharacterDto[]> {
  const response = await getDashboardJson<{ characters: DashboardCharacterDto[] }>(
    serverUrl,
    'characters',
  );
  return response.characters ?? [];
}

export async function fetchDashboardCharacter(
  serverUrl: string,
  characterId: string,
): Promise<DashboardCharacterDto> {
  return getDashboardJson<DashboardCharacterDto>(
    serverUrl,
    `characters/${characterId}`,
  );
}

export async function patchDashboardCharacter(
  serverUrl: string,
  characterId: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean }> {
  return patchDashboardJson<{ success: boolean }>(
    serverUrl,
    `characters/${characterId}`,
    body,
  );
}

export async function saveConversationSettings(
  serverUrl: string,
  userId: string,
  characterId: string,
  conversation_adapter: string,
  conversation_model_override: string,
): Promise<{ success: boolean }> {
  return postJson(serverUrl, 'update_character_conversation', {
    user_id: userId,
    character_id: characterId,
    conversation_adapter,
    conversation_model_override,
  });
}

export async function saveTtsSettings(
  serverUrl: string,
  userId: string,
  characterId: string,
  tts_adapter: string,
  voice: string,
  voice_speed: number,
): Promise<{ success: boolean }> {
  return postJson(serverUrl, 'update_character_tts', {
    user_id: userId,
    character_id: characterId,
    tts_adapter,
    voice,
    voice_speed,
  });
}

export async function saveAsrSettings(
  serverUrl: string,
  userId: string,
  characterId: string,
  asr_adapter: string,
): Promise<{ success: boolean }> {
  return postJson(serverUrl, 'update_character_asr', {
    user_id: userId,
    character_id: characterId,
    asr_adapter,
  });
}

export async function savePrompt(
  serverUrl: string,
  userId: string,
  characterId: string,
  prompt: string,
): Promise<{ success: boolean }> {
  return postJson(serverUrl, 'update_character_prompt', {
    user_id: userId,
    character_id: characterId,
    prompt,
  });
}

export async function saveScene(
  serverUrl: string,
  userId: string,
  characterId: string,
  scene_name: string,
): Promise<{ success: boolean }> {
  return postJson(serverUrl, 'update_character_scene', {
    user_id: userId,
    character_id: characterId,
    scene_name,
  });
}

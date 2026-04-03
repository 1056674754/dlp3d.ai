/**
 * Backend character / LLM settings (same routes as web `app/request/api.ts`).
 */

function buildUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  return `${base}/api/v1/${path}`;
}

async function getJson<T>(serverUrl: string, path: string): Promise<T> {
  const response = await fetch(buildUrl(serverUrl, path));
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const result = await response.json();
      message = result.detail?.error || result.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(
  serverUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
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
    throw new Error(message);
  }
  const text = await response.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export interface LLMProviderDto {
  options: string[];
}

/** Subset of web `CharacterConfig` fields used in native settings. */
export interface CharacterConfigDto {
  character_id: string;
  character_name: string;
  read_only: boolean;
  scene_name: string;
  prompt: string;
  conversation_adapter: string;
  conversation_model_override?: string;
  tts_adapter: string;
  voice: string;
  voice_speed: number;
}

export async function fetchAvailableLlm(
  serverUrl: string,
  userId: string,
): Promise<LLMProviderDto> {
  return getJson<LLMProviderDto>(serverUrl, `get_available_llm/${userId}`);
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

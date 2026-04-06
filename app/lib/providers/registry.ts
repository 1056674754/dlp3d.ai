export type ProviderCategory = 'tts' | 'llm' | 'asr'

export interface MongoKeyField {
  field: string
  label: string
  labelZh: string
  required: boolean
  secret: boolean
}

export interface ProviderDefinition {
  id: string
  label: string
  labelZh: string
  categories: ProviderCategory[]
  mongoKeys: MongoKeyField[]
  adapterIds: Partial<Record<ProviderCategory, string>>
  suggestedModels?: Partial<Record<ProviderCategory, string[]>>
  iconPath?: string
}

export const PROVIDER_REGISTRY: Record<string, ProviderDefinition> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    labelZh: 'OpenAI',
    categories: ['llm', 'asr'],
    mongoKeys: [
      {
        field: 'openai_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'openai_agent', asr: 'openai_realtime' },
    suggestedModels: {
      llm: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'o4-mini',
        'o3',
        'o3-mini',
      ],
    },
  },
  sensenova: {
    id: 'sensenova',
    label: 'SenseNova',
    labelZh: '商汤日日新',
    categories: ['tts', 'llm'],
    mongoKeys: [
      {
        field: 'sensenova_ak',
        label: 'Access Key (AK)',
        labelZh: '访问密钥 (AK)',
        required: true,
        secret: false,
      },
      {
        field: 'sensenova_sk',
        label: 'Secret Key (SK)',
        labelZh: '秘密密钥 (SK)',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'sensenova', tts: 'sensenova' },
    iconPath: '/img/llm/sensenova.png',
  },
  sensechat: {
    id: 'sensechat',
    label: 'SenseChat',
    labelZh: '商汤 SenseChat',
    categories: ['llm'],
    mongoKeys: [
      {
        field: 'sensechat_ak',
        label: 'Access Key (AK)',
        labelZh: '访问密钥 (AK)',
        required: true,
        secret: false,
      },
      {
        field: 'sensechat_sk',
        label: 'Secret Key (SK)',
        labelZh: '秘密密钥 (SK)',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'sensechat' },
    iconPath: '/img/llm/sensenova.png',
  },
  sensenovaomni: {
    id: 'sensenovaomni',
    label: 'SenseNova Omni',
    labelZh: '商汤日日新 Omni',
    categories: ['llm'],
    mongoKeys: [
      {
        field: 'sensenovaomni_ak',
        label: 'Access Key (AK)',
        labelZh: '访问密钥 (AK)',
        required: true,
        secret: false,
      },
      {
        field: 'sensenovaomni_sk',
        label: 'Secret Key (SK)',
        labelZh: '秘密密钥 (SK)',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'sensenovaomni' },
    iconPath: '/img/llm/sensenova.png',
  },
  volcengine: {
    id: 'volcengine',
    label: 'Volcengine (Huoshan)',
    labelZh: '火山引擎',
    categories: ['tts', 'asr'],
    mongoKeys: [
      {
        field: 'huoshan_app_id',
        label: 'App ID',
        labelZh: '应用 ID',
        required: true,
        secret: false,
      },
      {
        field: 'huoshan_token',
        label: 'Access Token',
        labelZh: '访问令牌',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { tts: 'huoshan', asr: 'huoshan' },
    iconPath: '/img/llm/huoshan.png',
  },
  volcengine_icl: {
    id: 'volcengine_icl',
    label: 'Volcengine ICL (Voice Clone)',
    labelZh: '火山引擎 语音克隆',
    categories: ['tts'],
    mongoKeys: [
      {
        field: 'huoshan_app_id',
        label: 'App ID',
        labelZh: '应用 ID',
        required: true,
        secret: false,
      },
      {
        field: 'huoshan_token',
        label: 'Access Token',
        labelZh: '访问令牌',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { tts: 'huoshan_icl' },
    iconPath: '/img/llm/huoshan.png',
  },
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    labelZh: 'ElevenLabs',
    categories: ['tts'],
    mongoKeys: [
      {
        field: 'elevenlabs_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { tts: 'elevenlabs' },
    suggestedModels: {
      tts: ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5'],
    },
  },
  sense_tts: {
    id: 'sense_tts',
    label: 'SenseNova TTS',
    labelZh: '商汤 TTS',
    categories: ['tts'],
    mongoKeys: [
      {
        field: 'sense_tts_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { tts: 'sense_tts' },
    iconPath: '/img/llm/sensenova.png',
  },
  nova_tts: {
    id: 'nova_tts',
    label: 'Nova TTS',
    labelZh: 'Nova TTS',
    categories: ['tts'],
    mongoKeys: [
      {
        field: 'nova_tts_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { tts: 'nova_tts' },
  },
  softsugar: {
    id: 'softsugar',
    label: 'SoftSugar',
    labelZh: '绵白糖',
    categories: ['tts'],
    mongoKeys: [
      {
        field: 'softsugar_app_id',
        label: 'App ID',
        labelZh: '应用 ID',
        required: true,
        secret: false,
      },
      {
        field: 'softsugar_app_key',
        label: 'App Key',
        labelZh: '应用密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { tts: 'softsugar' },
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    labelZh: 'DeepSeek',
    categories: ['llm'],
    mongoKeys: [
      {
        field: 'deepseek_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'deepseek' },
    suggestedModels: {
      llm: ['deepseek-chat', 'deepseek-reasoner'],
    },
  },
  xai: {
    id: 'xai',
    label: 'xAI (Grok)',
    labelZh: 'xAI (Grok)',
    categories: ['llm'],
    mongoKeys: [
      {
        field: 'xai_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'xai' },
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    labelZh: 'Anthropic (Claude)',
    categories: ['llm'],
    mongoKeys: [
      {
        field: 'anthropic_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'anthropic' },
    suggestedModels: {
      llm: ['claude-sonnet-4-20250514', 'claude-4-opus-20250514'],
    },
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    labelZh: 'Google Gemini',
    categories: ['llm'],
    mongoKeys: [
      {
        field: 'gemini_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'gemini' },
  },
} as const

export function getProvidersForCategory(
  category: ProviderCategory,
): ProviderDefinition[] {
  return Object.values(PROVIDER_REGISTRY).filter(p =>
    p.categories.includes(category),
  )
}

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDER_REGISTRY[id]
}

export function getSuggestedModels(
  providerId: string,
  category: ProviderCategory,
): string[] {
  const provider = PROVIDER_REGISTRY[providerId]
  return provider?.suggestedModels?.[category] ?? []
}

/** Get all unique MongoDB field names needed by all providers */
export function getAllMongoKeyFields(): string[] {
  const fields = new Set<string>()
  for (const p of Object.values(PROVIDER_REGISTRY)) {
    for (const k of p.mongoKeys) {
      fields.add(k.field)
    }
  }
  return Array.from(fields)
}

/** Given a UserConfigs document, determine which providers are fully configured */
export function getConfiguredProviders(
  userConfig: Record<string, string>,
): string[] {
  const configured: string[] = []
  for (const p of Object.values(PROVIDER_REGISTRY)) {
    const allFilled = p.mongoKeys
      .filter(k => k.required)
      .every(k => {
        const val = userConfig[k.field]
        return val != null && val !== ''
      })
    if (allFilled) {
      configured.push(p.id)
    }
  }
  return configured
}

/** Resolve adapter ID to provider ID (reverse mapping) */
export function adapterToProvider(
  adapterId: string,
  category: ProviderCategory,
): ProviderDefinition | undefined {
  return Object.values(PROVIDER_REGISTRY).find(
    p => p.adapterIds[category] === adapterId,
  )
}

/** Get all adapter IDs for a given category from configured providers */
export function getConfiguredAdapters(
  userConfig: Record<string, string>,
  category: ProviderCategory,
): { adapterId: string; provider: ProviderDefinition }[] {
  const configured = getConfiguredProviders(userConfig)
  const result: { adapterId: string; provider: ProviderDefinition }[] = []
  for (const pid of configured) {
    const p = PROVIDER_REGISTRY[pid]
    const aid = p?.adapterIds[category]
    if (aid) {
      result.push({ adapterId: aid, provider: p })
    }
  }
  return result
}

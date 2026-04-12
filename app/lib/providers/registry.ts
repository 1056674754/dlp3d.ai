export type ProviderCategory = 'tts' | 'llm' | 'asr'
export type LlmFeature = 'conversation' | 'reaction' | 'memory' | 'classification'

export interface ProviderAdapterOption {
  adapterId: string
  label?: string
  labelZh?: string
}

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
  docsUrl: string
  mongoKeys: MongoKeyField[]
  adapterIds: Partial<Record<ProviderCategory, string>>
  adapterOptions?: Partial<Record<ProviderCategory, ProviderAdapterOption[]>>
  llmFeatureAdapters?: Partial<Record<LlmFeature, string>>
  llmFeatureAdapterOptions?: Partial<Record<LlmFeature, ProviderAdapterOption[]>>
  suggestedModels?: Partial<Record<ProviderCategory, string[]>>
  iconPath?: string
}

export const PROVIDER_REGISTRY: Record<string, ProviderDefinition> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    labelZh: 'OpenAI',
    categories: ['llm', 'asr'],
    docsUrl: 'https://platform.openai.com/docs/overview',
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
    llmFeatureAdapters: {
      conversation: 'openai_agent',
      reaction: 'openai_reaction',
      memory: 'openai_memory',
      classification: 'openai_classification',
    },
    llmFeatureAdapterOptions: {
      conversation: [
        {
          adapterId: 'openai_agent',
          label: 'Text Chat',
          labelZh: '文本对话',
        },
        {
          adapterId: 'openai_audio_agent',
          label: 'Realtime Audio',
          labelZh: '实时语音对话',
        },
      ],
    },
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
    docsUrl: 'https://platform.sensenova.cn/product/APIService/document',
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
    llmFeatureAdapters: {
      conversation: 'sensenova_agent',
      reaction: 'sensenova_reaction',
      memory: 'sensenova_memory',
      classification: 'sensenova_classification',
    },
    iconPath: '/img/llm/sensenova.png',
  },
  sensechat: {
    id: 'sensechat',
    label: 'SenseChat',
    labelZh: '商汤 SenseChat',
    categories: ['llm'],
    docsUrl: 'https://platform.sensenova.cn/product/APIService/document',
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
    llmFeatureAdapters: {
      conversation: 'sensechat_agent',
      reaction: 'sensechat_reaction',
      memory: 'sensechat_memory',
      classification: 'sensechat_classification',
    },
    iconPath: '/img/llm/sensenova.png',
  },
  sensenovaomni: {
    id: 'sensenovaomni',
    label: 'SenseNova Omni',
    labelZh: '商汤日日新 Omni',
    categories: ['llm'],
    docsUrl: 'https://platform.sensenova.cn/product/APIService/document',
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
    llmFeatureAdapters: {
      conversation: 'sensenovaomni_agent',
      reaction: 'sensenovaomni_reaction',
      memory: 'sensenovaomni_memory',
      classification: 'sensenovaomni_classification',
    },
    iconPath: '/img/llm/sensenova.png',
  },
  doubao: {
    id: 'doubao',
    label: 'Doubao Speech',
    labelZh: '豆包语音',
    categories: ['tts', 'asr'],
    docsUrl: 'https://www.volcengine.com/docs/6561/120572',
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
      {
        field: 'huoshan_secret_key',
        label: 'Secret Key (Optional)',
        labelZh: '密钥（可选）',
        required: false,
        secret: true,
      },
    ],
    adapterIds: { tts: 'doubao', asr: 'doubao_realtime_asr' },
    iconPath: '/img/llm/huoshan.png',
  },
  volcengine_realtime_voice: {
    id: 'volcengine_realtime_voice',
    label: 'Volcengine Realtime Dialogue',
    labelZh: '火山引擎实时语音',
    categories: ['llm'],
    docsUrl: 'https://www.volcengine.com/docs/6561/1594356?lang=zh',
    mongoKeys: [
      {
        field: 'volcengine_app_id',
        label: 'App ID',
        labelZh: '应用 ID',
        required: true,
        secret: false,
      },
      {
        field: 'volcengine_token',
        label: 'Access Token',
        labelZh: '访问令牌',
        required: true,
        secret: true,
      },
      {
        field: 'volcengine_secret_key',
        label: 'Secret Key (Optional)',
        labelZh: '密钥（可选）',
        required: false,
        secret: true,
      },
    ],
    adapterIds: { llm: 'volcengine_realtime_voice_agent' },
    llmFeatureAdapters: {
      conversation: 'volcengine_realtime_voice_agent',
    },
    llmFeatureAdapterOptions: {
      conversation: [
        {
          adapterId: 'volcengine_realtime_voice_agent',
          label: 'Realtime Dialogue',
          labelZh: '实时语音对话',
        },
      ],
    },
    suggestedModels: {
      llm: ['platform-managed-dialogue-bot'],
    },
    iconPath: '/img/llm/huoshan.png',
  },
  doubao_icl: {
    id: 'doubao_icl',
    label: 'Doubao Speech Clone',
    labelZh: '豆包语音克隆',
    categories: ['tts'],
    docsUrl: 'https://www.volcengine.com/docs/6561/120572',
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
    adapterIds: { tts: 'doubao_icl' },
    iconPath: '/img/llm/huoshan.png',
  },
  volcengine: {
    id: 'volcengine',
    label: 'Volcengine ASR',
    labelZh: '火山引擎 ASR',
    categories: ['asr'],
    docsUrl: 'https://www.volcengine.com/docs/6561/1354869?lang=zh',
    mongoKeys: [
      {
        field: 'volcengine_app_id',
        label: 'App ID',
        labelZh: '应用 ID',
        required: true,
        secret: false,
      },
      {
        field: 'volcengine_token',
        label: 'Access Token',
        labelZh: '访问令牌',
        required: true,
        secret: true,
      },
      {
        field: 'volcengine_secret_key',
        label: 'Secret Key (Optional)',
        labelZh: '密钥（可选）',
        required: false,
        secret: true,
      },
    ],
    adapterIds: { asr: 'volcengine_bigasr' },
    iconPath: '/img/llm/huoshan.png',
  },
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    labelZh: 'ElevenLabs',
    categories: ['tts'],
    docsUrl: 'https://elevenlabs.io/docs/introduction',
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
    docsUrl: 'https://platform.sensenova.cn/product/APIService/document',
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
    docsUrl: 'https://platform.sensenova.cn/product/APIService/document',
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
    docsUrl:
      'https://aigc.softsugar.com/html/help/en-US/9-%E8%AF%AD%E9%9F%B3%E5%A4%84%E7%90%86.html',
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
    docsUrl: 'https://api-docs.deepseek.com/',
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
    llmFeatureAdapters: {
      conversation: 'deepseek_agent',
      reaction: 'deepseek_reaction',
      memory: 'deepseek_memory',
      classification: 'deepseek_classification',
    },
    suggestedModels: {
      llm: ['deepseek-chat', 'deepseek-reasoner'],
    },
  },
  xai: {
    id: 'xai',
    label: 'xAI (Grok)',
    labelZh: 'xAI (Grok)',
    categories: ['llm'],
    docsUrl: 'https://docs.x.ai/docs/overview',
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
    llmFeatureAdapters: {
      conversation: 'xai_agent',
      reaction: 'xai_reaction',
      memory: 'xai_memory',
      classification: 'xai_classification',
    },
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    labelZh: 'Anthropic (Claude)',
    categories: ['llm'],
    docsUrl: 'https://docs.anthropic.com/en/api/overview',
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
    llmFeatureAdapters: {
      conversation: 'anthropic_agent',
    },
    suggestedModels: {
      llm: ['claude-sonnet-4-20250514', 'claude-4-opus-20250514'],
    },
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    labelZh: 'Google Gemini',
    categories: ['llm'],
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
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
    llmFeatureAdapters: {
      conversation: 'gemini_agent',
      reaction: 'gemini_reaction',
      memory: 'gemini_memory',
      classification: 'gemini_classification',
    },
  },
  alibaba_bailian: {
    id: 'alibaba_bailian',
    label: 'Alibaba Bailian (DashScope)',
    labelZh: '阿里百炼',
    categories: ['llm', 'asr'],
    docsUrl: 'https://help.aliyun.com/zh/model-studio/use-qwen-by-calling-api',
    mongoKeys: [
      {
        field: 'qwen_api_key',
        label: 'API Key',
        labelZh: 'API 密钥',
        required: true,
        secret: true,
      },
    ],
    adapterIds: { llm: 'qwen_agent', asr: 'qwen_realtime_asr' },
    adapterOptions: {
      asr: [
        {
          adapterId: 'qwen_realtime_asr',
          label: 'Qwen ASR Realtime',
          labelZh: 'Qwen 实时语音识别',
        },
      ],
    },
    llmFeatureAdapters: {
      conversation: 'qwen_agent',
      reaction: 'qwen_reaction',
      memory: 'qwen_memory',
      classification: 'qwen_classification',
    },
    llmFeatureAdapterOptions: {
      conversation: [
        {
          adapterId: 'qwen_agent',
          label: 'Text Chat',
          labelZh: '文本对话',
        },
        {
          adapterId: 'qwen_omni_realtime_agent',
          label: 'Qwen Omni Realtime',
          labelZh: 'Qwen Omni 实时语音对话',
        },
      ],
    },
    suggestedModels: {
      llm: [
        'qwen-turbo-latest',
        'qwen-plus',
        'qwen-max',
        'qwen-omni-turbo',
        'qwen3-omni-flash',
        'qwen3.5-omni-plus-realtime',
      ],
      asr: ['qwen-asr-realtime'],
    },
  },
} as const

function providerHasCategoryAdapter(
  provider: ProviderDefinition,
  category: ProviderCategory,
  adapterId: string,
): boolean {
  return (
    provider.adapterIds[category] === adapterId ||
    (provider.adapterOptions?.[category] ?? []).some(
      option => option.adapterId === adapterId,
    )
  )
}

function providerHasLlmFeatureAdapter(
  provider: ProviderDefinition,
  adapterId: string,
): boolean {
  return (
    Object.values(provider.llmFeatureAdapters ?? {}).includes(adapterId) ||
    Object.values(provider.llmFeatureAdapterOptions ?? {}).some(options =>
      (options ?? []).some(option => option.adapterId === adapterId),
    )
  )
}

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
    p =>
      providerHasCategoryAdapter(p, category, adapterId) ||
      (category === 'llm' && providerHasLlmFeatureAdapter(p, adapterId)),
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
    const options = p?.adapterOptions?.[category]
    if (options && options.length > 0) {
      for (const option of options) {
        result.push({ adapterId: option.adapterId, provider: p })
      }
      continue
    }
    const adapterId = p?.adapterIds[category]
    if (adapterId) {
      result.push({ adapterId, provider: p })
    }
  }
  return result
}

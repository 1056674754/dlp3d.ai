import { Logger } from '@/library/babylonjs/utils'
import { getEnv } from '@/utils/env'
/**
 * Exception thrown when an invalid configuration key is used.
 */
export class InvalidConfigKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidConfigKey'
  }
}

/**
 * Synchronous configuration from env variables.
 */
export class ConfigSync {
  /**
   * Default configuration values.
   */
  private _config: Record<string, any> = {
    appName: 'babylon',
    orchestratorHost: '',
    orchestratorPort: 0,
    orchestratorPathPrefix: '/dlp3d-ai/orchestrator',
    orchestratorAudioChatPath: 'audio_chat_with_text_llm',
    orchestratorRealtimeAudioChatPath: 'audio_chat_with_audio_llm',
    orchestratorTextChatPath: 'text_chat_with_text_llm',
    orchestratorDirectStreamingPath: 'text_generate',
    orchestratorMotionSettingsPath: 'get_motion_settings',
    orchestratorVoiceSettingsPath: 'get_voice_settings',
    orchestratorTimeout: 0,
    motionFileHost: '',
    motionFilePort: 0,
    motionFilePathPrefix: '/dlp3d-ai/backend',
    motionFilePath: 'motion_file_download',
    motionFileTimeout: 0,
    maxFrontExtensionDuration: 0,
    maxRearExtensionDuration: 0.0,
    voiceSpeed: 1.0,
    faceModel: 'unitalker_emo_base_v0.4.0',
    firstBodyFastResponse: false,
    userId: 'default_user',
    characterId: 'default_character_1',
    conversationAdapter: '',
    language: 'zh',
  }

  constructor() {
    this._updateFromEnv()
  }

  private _isSameOrigin(envHost: string): boolean {
    return !envHost || envHost === '__SAME_ORIGIN__'
  }

  /**
   * In native WebView (file:// protocol), window.location has no hostname/port.
   * Fall back to the injected origin globals set by the RN host.
   */
  private _getNativeOrigin(
    kind: 'orchestrator' | 'backend',
  ): { hostname: string; port: number } | null {
    if (typeof window === 'undefined') return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const raw: string | undefined =
      kind === 'orchestrator'
        ? w.__DLP3D_ORCHESTRATOR_ORIGIN__
        : w.__DLP3D_SERVER_ORIGIN__
    if (!raw) return null
    try {
      const u = new URL(raw)
      const defaultPort = u.protocol === 'http:' ? 80 : 443
      return {
        hostname: u.hostname,
        port: u.port ? parseInt(u.port, 10) : defaultPort,
      }
    } catch {
      return null
    }
  }

  private _resolveHost(envHost: string, kind: 'orchestrator' | 'backend'): string {
    if (this._isSameOrigin(envHost)) {
      if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        return this._getNativeOrigin(kind)?.hostname || ''
      }
      return typeof window !== 'undefined' ? window.location.hostname : ''
    }
    return envHost
  }

  private _resolvePort(
    envHost: string,
    envPort: string,
    kind: 'orchestrator' | 'backend',
  ): number {
    if (this._isSameOrigin(envHost)) {
      if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        return this._getNativeOrigin(kind)?.port || 443
      }
      if (typeof window !== 'undefined' && window.location.port) {
        return parseInt(window.location.port, 10)
      }
      return window?.location?.protocol === 'http:' ? 80 : 443
    }
    return parseInt(envPort || '443', 10)
  }

  private _updateFromEnv(): void {
    const orchHost = getEnv('NEXT_PUBLIC_ORCHESTRATOR_HOST')
    this._config.orchestratorHost = this._resolveHost(orchHost, 'orchestrator')
    this._config.orchestratorPort = this._resolvePort(
      orchHost,
      getEnv('NEXT_PUBLIC_ORCHESTRATOR_PORT'),
      'orchestrator',
    )
    this._config.orchestratorPathPrefix = getEnv(
      'NEXT_PUBLIC_ORCHESTRATOR_PATH_PREFIX',
    )
    this._config.orchestratorTimeout = getEnv('NEXT_PUBLIC_ORCHESTRATOR_TIMEOUT')
    const backendHost = getEnv('NEXT_PUBLIC_BACKEND_HOST')
    this._config.motionFileHost = this._resolveHost(backendHost, 'backend')
    this._config.motionFilePort = this._resolvePort(
      backendHost,
      getEnv('NEXT_PUBLIC_BACKEND_PORT'),
      'backend',
    )
    this._config.motionFilePathPrefix = getEnv('NEXT_PUBLIC_BACKEND_PATH_PREFIX')
    this._config.motionFileTimeout = parseInt(
      getEnv('NEXT_PUBLIC_MOTION_FILE_TIMEOUT') || '600',
      10,
    )
    this._config.maxFrontExtensionDuration = parseFloat(
      getEnv('NEXT_PUBLIC_MAX_FRONT_EXTENSION_DURATION') || '0.0',
    )
    this._config.maxRearExtensionDuration = parseFloat(
      getEnv('NEXT_PUBLIC_MAX_REAR_EXTENSION_DURATION') || '0.0',
    )
    if (typeof window !== 'undefined' && window.localStorage) {
      this._config.language = window.localStorage.getItem('i18nextLng')
    }
  }

  /**
   * Read configuration file content.
   *
   * @returns Configuration content as a dictionary.
   */
  public read(): Record<string, any> {
    return this._config
  }

  /**
   * Write configuration content to file.
   *
   * @param config Configuration content dictionary to write.
   */
  public write(config: Record<string, any>): void {
    const inputKeys = Object.keys(config)
    const requiredKeys = Object.keys(this._config)
    const missingKeys = requiredKeys.filter(x => !inputKeys.includes(x))
    const additionalKeys = inputKeys.filter(x => !requiredKeys.includes(x))

    if (additionalKeys.length > 0) {
      Logger.warn(`Extra configuration items will be ignored: ${additionalKeys}`)
    }

    if (missingKeys.length > 0) {
      const msg = `Cannot update configuration, missing required keys: ${missingKeys}`
      Logger.error(msg)
      throw new InvalidConfigKeyError(msg)
    }

    // Remove additional keys
    for (const key of additionalKeys) {
      delete config[key]
    }

    this._config = { ...config }
  }

  /**
   * Get value for specified key from configuration.
   *
   * @param key Configuration key name.
   * @returns Value corresponding to the configuration key.
   * @throws {InvalidConfigKeyError} When key doesn't exist in configuration.
   */
  public getItem(key: string): any {
    if (!(key in this._config)) {
      const msg = `${key} is not a valid key in the configuration.`
      Logger.error(msg)
      throw new InvalidConfigKeyError(msg)
    }

    return this._config[key]
  }

  /**
   * Set value for specified key in configuration.
   *
   * @param key Configuration key name.
   * @param value Value to set.
   * @throws {InvalidConfigKeyError} When key doesn't exist in configuration.
   */
  public setItem(key: string, value: any): void {
    if (!(key in this._config)) {
      const msg = `${key} is not a valid key in the configuration.`
      Logger.error(msg)
      throw new InvalidConfigKeyError(msg)
    }
    this._config[key] = value
  }
}

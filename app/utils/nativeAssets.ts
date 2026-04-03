/**
 * 3D 资源路径：在原生 App 中必须由 RN 注入 manifest（file://），Web 不自行拼 APK/远程模型 URL。
 */

import { isNativeApp } from '@/utils/nativeBridge'
import { DEFAULT_CHARACTER_MODEL_INDEX } from '@/constants'

const CHARACTER_FILENAMES = [
  'Ani-default_481.glb',
  'KQ-default_420.glb',
  'HT-default_214.glb',
  'FNN-default_296.glb',
  'KL-default_214.glb',
  'NXD-default_321.glb',
] as const

export type NativeAssetManifest = {
  characterByModelIndex: Record<string, string>
  groundBaseUrl: string
  hdrBaseUrl: string
}

declare global {
  interface Window {
    __DLP3D_NATIVE_ASSETS__?: NativeAssetManifest
    __DLP3D_REMOTE_CHARACTER_ASSET_BASE__?: string
    __DLP3D_REMOTE_SCENE_ASSET_BASE__?: string
  }
}

/** 当前页是否已具备 RN 下发的 3D 资源 manifest（Android 瘦包/正式包） */
export function hasNativeAssetManifest(): boolean {
  if (typeof window === 'undefined') return false
  const m = window.__DLP3D_NATIVE_ASSETS__
  return (
    !!m &&
    typeof m.groundBaseUrl === 'string' &&
    typeof m.hdrBaseUrl === 'string' &&
    typeof m.characterByModelIndex === 'object'
  )
}

function getWebFallbackBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  if (window.location.protocol === 'file:') {
    const href = window.location.href
    const i = href.lastIndexOf('/')
    return href.slice(0, i + 1)
  }
  return `${window.location.origin}/`
}

function shouldPreferPackagedFileAssets(): boolean {
  if (typeof window === 'undefined') return false
  return isNativeApp() && window.location.protocol === 'file:'
}

function getInjectedRemoteBaseUrl(kind: 'character' | 'scene'): string {
  if (typeof window === 'undefined') return ''
  const base =
    kind === 'character'
      ? window.__DLP3D_REMOTE_CHARACTER_ASSET_BASE__
      : window.__DLP3D_REMOTE_SCENE_ASSET_BASE__
  if (!base) return ''
  return `${base.replace(/\/+$/, '')}/`
}

/**
 * 在原生壳内且无 manifest 时视为配置错误（Android 应在 WebView 展示前准备好资源）。
 */
function assertNativeOrBrowser(): void {
  if (
    isNativeApp() &&
    !hasNativeAssetManifest() &&
    !getInjectedRemoteBaseUrl('character') &&
    !getInjectedRemoteBaseUrl('scene')
  ) {
    console.warn(
      '[nativeAssets] Running in native WebView without __DLP3D_NATIVE_ASSETS__. 3D loads may fail until RN injects the manifest.',
    )
  }
}

/** 角色 GLB 完整 URL（原生：RN file://；浏览器：同源或 file 页目录） */
export function getCharacterModelUrl(modelIndex: number): string {
  assertNativeOrBrowser()
  const fn = CHARACTER_FILENAMES[modelIndex]
  if (!fn) {
    throw new Error(`Unknown character model index: ${modelIndex}`)
  }
  if (hasNativeAssetManifest()) {
    const m = window.__DLP3D_NATIVE_ASSETS__!
    let u = m.characterByModelIndex[String(modelIndex)]
    if (!u) {
      u = m.characterByModelIndex[String(DEFAULT_CHARACTER_MODEL_INDEX)]
    }
    if (!u) {
      const first = Object.values(m.characterByModelIndex)[0]
      if (first) return first
      throw new Error(
        `[nativeAssets] Native manifest missing character index ${modelIndex}`,
      )
    }
    return u
  }
  if (shouldPreferPackagedFileAssets()) {
    return `${getWebFallbackBaseUrl()}characters/${fn}`
  }
  const remoteBase = getInjectedRemoteBaseUrl('character')
  if (isNativeApp() && remoteBase) {
    return `${remoteBase}characters/${fn}`
  }
  return `${getWebFallbackBaseUrl()}characters/${fn}`
}

export function getGroundRootUrl(): string {
  assertNativeOrBrowser()
  if (hasNativeAssetManifest()) {
    return window.__DLP3D_NATIVE_ASSETS__!.groundBaseUrl
  }
  if (shouldPreferPackagedFileAssets()) {
    return `${getWebFallbackBaseUrl()}models/ground/`
  }
  const remoteBase = getInjectedRemoteBaseUrl('scene')
  if (isNativeApp() && remoteBase) {
    return `${remoteBase}models/ground/`
  }
  return `${getWebFallbackBaseUrl()}models/ground/`
}

export function getHdrRootUrl(): string {
  assertNativeOrBrowser()
  if (hasNativeAssetManifest()) {
    return window.__DLP3D_NATIVE_ASSETS__!.hdrBaseUrl
  }
  if (shouldPreferPackagedFileAssets()) {
    return `${getWebFallbackBaseUrl()}img/hdr/`
  }
  const remoteBase = getInjectedRemoteBaseUrl('scene')
  if (isNativeApp() && remoteBase) {
    return `${remoteBase}img/hdr/`
  }
  return `${getWebFallbackBaseUrl()}img/hdr/`
}

export function resolveHdriUrl(hdriFileName: string): string {
  return `${getHdrRootUrl()}${hdriFileName}`
}

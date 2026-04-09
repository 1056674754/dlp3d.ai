/**
 * 3D 资源路径：在原生 App 中必须由 RN 注入 manifest（file://），Web 不自行拼 APK/远程模型 URL。
 */

import { isNativeApp } from '@/utils/nativeBridge'
import { DEFAULT_CHARACTER_MODEL_INDEX } from '@/constants'
import { resolvePublicUrl } from '@/utils/publicUrl'

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

const nativeBabylonBlobUrlCache = new Map<string, Promise<string>>()

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

function resolveNativeManifestUrl(url: string): string {
  if (typeof window === 'undefined') return url
  const apkAssetPrefix = 'file:///android_asset/web/'
  if (window.location.protocol === 'file:' && url.startsWith(apkAssetPrefix)) {
    return resolvePublicUrl(`/${url.slice(apkAssetPrefix.length)}`)
  }
  return url
}

function shouldUseNativeBabylonBlobUrl(url: string): boolean {
  if (typeof window === 'undefined') return false
  return (
    isNativeApp() &&
    window.location.protocol === 'file:' &&
    url.startsWith('file:///android_asset/web/')
  )
}

export async function resolveBabylonAssetUrl(
  url: string,
  mimeType?: string,
  transport: 'blobUrl' | 'dataUrl' = 'blobUrl',
): Promise<string> {
  if (!shouldUseNativeBabylonBlobUrl(url)) {
    return url
  }

  const cacheKey = `${transport}:${url}`
  const existing = nativeBabylonBlobUrlCache.get(cacheKey)
  if (existing) {
    return existing
  }

  const pending = new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('GET', url, true)
    request.responseType = 'blob'
    request.onload = () => {
      if (request.status !== 0 && (request.status < 200 || request.status >= 300)) {
        reject(
          new Error(
            `Failed to load Babylon asset via XHR: ${request.status} ${request.statusText}`,
          ),
        )
        return
      }

      const responseBlob = request.response
      const blob =
        responseBlob instanceof Blob && (!mimeType || responseBlob.type)
          ? responseBlob
          : new Blob([responseBlob], {
              type: mimeType ?? responseBlob?.type ?? undefined,
            })

      if (transport === 'dataUrl') {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result)
            return
          }
          reject(new Error('Failed to convert Babylon asset blob to data URL'))
        }
        reader.onerror = () => {
          reject(new Error('Failed to convert Babylon asset blob to data URL'))
        }
        reader.readAsDataURL(blob)
        return
      }

      resolve(URL.createObjectURL(blob))
    }
    request.onerror = () => {
      reject(new Error('Failed to load Babylon asset via XHR'))
    }
    request.send()
  })

  nativeBabylonBlobUrlCache.set(cacheKey, pending)

  try {
    return await pending
  } catch (error) {
    nativeBabylonBlobUrlCache.delete(cacheKey)
    throw error
  }
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
      if (first) return resolveNativeManifestUrl(first)
      throw new Error(
        `[nativeAssets] Native manifest missing character index ${modelIndex}`,
      )
    }
    return resolveNativeManifestUrl(u)
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
    return resolveNativeManifestUrl(window.__DLP3D_NATIVE_ASSETS__!.groundBaseUrl)
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
    return resolveNativeManifestUrl(window.__DLP3D_NATIVE_ASSETS__!.hdrBaseUrl)
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

import { isNativeApp, sendToNative } from '@/utils/nativeBridge'

/**
 * Build-time / runtime flags for the **static export** used inside the React Native
 * WebView (`file:///android_asset/web/`). This is **not** the same deployment as the
 * server-hosted Next site: APK 内嵌页只应使用随包静态资源做渲染；业务 API 仍走用户配置的远端。
 *
 * Set by `NEXT_PUBLIC_OFFLINE_WEBVIEW=1` (see `scripts/build-android-web.sh`).
 */
export function isPackagedWebviewExport(): boolean {
  return process.env.NEXT_PUBLIC_OFFLINE_WEBVIEW === '1'
}

/**
 * Map a Next-style path like `/babylon?scene=3` to the corresponding static
 * HTML file name for the packaged WebView export.
 */
function resolvePackagedHtmlUrl(path: string): string {
  let normalized = path.trim()
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  const qIdx = normalized.indexOf('?')
  const pathOnly = qIdx >= 0 ? normalized.slice(0, qIdx) : normalized
  const search = qIdx >= 0 ? normalized.slice(qIdx) : ''
  const slug = pathOnly.replace(/^\/+/, '').replace(/\/$/, '')
  const lastSegment = slug.split('/').pop() || ''
  const file = slug === '' || slug === 'index' ? 'index.html' : `${lastSegment}.html`
  return new URL(file + search, window.location.href).href
}

/**
 * Navigate inside the embedded WebView.
 *
 * In native app (file:// protocol), `window.location.href = ...` does NOT work
 * in Android WebView. Instead we ask the React Native host to drive the
 * navigation via `webview:navigate` bridge event.
 */
export function navigateInPackagedWebview(path: string): void {
  if (typeof window === 'undefined') return

  if (isNativeApp() && window.location.protocol === 'file:') {
    const url = resolvePackagedHtmlUrl(path)
    sendToNative({ type: 'webview:navigate', payload: { url } })
    return
  }

  let normalized = path.trim()
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  window.location.href = normalized
}

import { isNativeApp } from '@/utils/nativeBridge'

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
 * Navigate inside the embedded WebView. For `file://` static export, Next emits
 * `debug.html` for `/debug` (not a SPA router), so map paths to sibling `*.html` files.
 */
export function navigateInPackagedWebview(path: string): void {
  if (typeof window === 'undefined') return
  let normalized = path.trim()
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  if (isNativeApp() && window.location.protocol === 'file:') {
    const slug = normalized.replace(/^\/+/, '').replace(/\/$/, '')
    const file =
      slug === '' || slug === 'index'
        ? 'index.html'
        : `${slug.split('/').pop()}.html`
    window.location.href = new URL(file, window.location.href).href
    return
  }
  window.location.href = normalized
}

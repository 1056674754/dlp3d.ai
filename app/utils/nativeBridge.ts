/**
 * Native bridge utilities for WebView ↔ React Native communication.
 */

/**
 * Check if the web app is running inside a React Native WebView.
 */
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ReactNativeWebView
}

/**
 * 内嵌 RN WebView 时不展示 Web 顶栏（登录 / 语言等），由原生负责。
 * - 静态导出预渲染（无 `window`）：用 `NEXT_PUBLIC_OFFLINE_WEBVIEW=1` 与 HTML 一致。
 * - 运行时：仅用 `window.__DLP3D_EMBEDDED_IN_RN__`（layout 内联脚本或 RN 注入）或 `ReactNativeWebView`；
 *   不再仅凭 `NEXT_PUBLIC_OFFLINE_WEBVIEW`，否则在普通浏览器打开 export 会误判，且易与 hydration 不一致。
 */
export function shouldHideWebAuthChrome(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_OFFLINE_WEBVIEW === '1'
  }
  const w = window as unknown as { __DLP3D_EMBEDDED_IN_RN__?: boolean }
  if (w.__DLP3D_EMBEDDED_IN_RN__) {
    return true
  }
  return isNativeApp()
}

/**
 * Check if the native API bridge is ready (injected by the RN layer).
 */
export function isNativeReady(): boolean {
  return typeof window !== 'undefined' && !!(window as any).NativeAPI
}

/**
 * Send a message to the React Native host via the WebView bridge.
 *
 * @param event Event object with a `type` and optional `payload`.
 */
export function sendToNative(event: { type: string; payload?: any }): void {
  if (isNativeApp()) {
    ;(window as any).ReactNativeWebView.postMessage(JSON.stringify(event))
  }
}

/**
 * Subscribe to messages dispatched by the React Native layer.
 *
 * The native side should dispatch `nativeMessage` CustomEvents on `window`.
 *
 * @param callback Handler invoked with the event detail.
 * @returns Cleanup function to remove the listener.
 */
export function onNativeMessage(callback: (event: any) => void): () => void {
  const handler = ((e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail) callback(detail)
  }) as EventListener
  window.addEventListener('nativeMessage', handler)
  return () => window.removeEventListener('nativeMessage', handler)
}

/**
 * Override `window.open` so that internal (same-origin, relative) URLs
 * navigate within the same WebView instead of opening a new browser tab.
 *
 * This is idempotent — calling it multiple times is safe.
 */
export function patchWindowOpen(): void {
  if (isNativeApp() && !(window as any).__openPatched) {
    const originalOpen = window.open.bind(window)
    window.open = ((
      url?: string | URL | undefined,
      target?: string,
      features?: string,
    ) => {
      if (
        url &&
        typeof url === 'string' &&
        !url.startsWith('http') &&
        !url.startsWith('//')
      ) {
        // Internal navigation — change location within the WebView
        window.location.href = url
        return null
      }
      return originalOpen(url, target, features)
    }) as typeof window.open
    ;(window as any).__openPatched = true
  }
}

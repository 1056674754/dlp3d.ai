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

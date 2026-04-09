/**
 * Resolves root-relative public asset paths for Next static export and Android WebView
 * (`file:///android_asset/web/index.html`). A path like `/img/foo.png` would otherwise resolve
 * to `file:///img/foo.png` instead of next to the HTML document.
 *
 * Chrome 远程调试：若见请求落在 `file:///img/...` 而非 `.../web/img/...`，即属此类问题。
 */
export function resolvePublicUrl(path: string): string {
  if (typeof window === 'undefined') return path
  if (
    !path ||
    /^https?:\/\//i.test(path) ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path
  }
  if (!path.startsWith('/')) return path
  if (window.location.protocol === 'file:') {
    try {
      return new URL('.' + path, window.location.href).href
    } catch {
      return path
    }
  }
  return path
}

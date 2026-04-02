// mobile-inject.js — Loaded when running inside a native WebView
// Sets up communication with the React Native layer
(function () {
  if (!window.ReactNativeWebView) return;

  // Listen for custom events dispatched by the web app and relay to native
  window.addEventListener('nativeMessage', function (e) {
    var detail = e.detail;
    if (detail && detail.type) {
      if (detail.type === 'auth:token' && detail.payload) {
        // Native app provided auth token — inject into web app's auth system
        if (window.__DLP3D_onNativeMessage) {
          window.__DLP3D_onNativeMessage(detail);
        }
      }
      if (detail.type === 'language:change' && detail.payload) {
        // TODO: handle language change from native
      }
      if (detail.type === 'theme:change' && detail.payload) {
        // TODO: handle theme change from native
      }
    }
  });

  // Override window.open to stay in same WebView for internal routes
  if (!window.__openPatched) {
    var originalOpen = window.open.bind(window);
    window.open = function (url, target, features) {
      if (url && typeof url === 'string' && url.charAt(0) === '/') {
        window.location.href = url;
        return null;
      }
      return originalOpen(url, target, features);
    };
    window.__openPatched = true;
  }
})();

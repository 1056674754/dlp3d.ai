/**
 * JavaScript injected into WebView to establish bridge communication.
 * This runs after the page loads and sets up window.NativeAPI.
 */
export function createInjectedJavaScript(config: {
  authToken?: string;
  serverUrl: string;
  language: string;
  theme: 'light' | 'dark';
}): string {
  return `
    (function() {
      // Mark that we're running inside a native app
      window.__DLP3D_NATIVE__ = true;

      // Native API object for web app to call
      window.NativeAPI = {
        platform: '${config.theme}',
        authToken: ${JSON.stringify(config.authToken || null)},
        language: ${JSON.stringify(config.language)},
        theme: ${JSON.stringify(config.theme)},

        // Send event to React Native
        sendEvent: function(type, payload) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: type, payload: payload || {} })
          );
        },

        // Convenience methods
        notifyReady: function() {
          this.sendEvent('ready', {});
        },
        notifyLoading: function(isLoading, progress, text) {
          this.sendEvent('loading:state', {
            isLoading: isLoading,
            progress: progress || 0,
            text: text || ''
          });
        },
        notifyError: function(message, code) {
          this.sendEvent('error', { message: message, code: code || '' });
        },
        notifyAuthStatus: function(isLoggedIn, user) {
          this.sendEvent('auth:status', {
            isLoggedIn: isLoggedIn,
            user: user || null
          });
        },
        notifySceneChanged: function(sceneIndex) {
          this.sendEvent('scene:changed', { sceneIndex: sceneIndex });
        },
        notifyCharacterChanged: function(characterId, modelIndex) {
          this.sendEvent('character:changed', {
            characterId: characterId,
            modelIndex: modelIndex
          });
        },
        openSettings: function(panel) {
          this.sendEvent('settings:open', { panel: panel });
        },
        notifyChatListUpdated: function(chats) {
          this.sendEvent('chat:list:updated', { chats: chats });
        },
      };

      // Listen for messages from React Native
      window.addEventListener('nativeMessage', function(e) {
        var detail = e.detail;
        if (detail && detail.type) {
          // Dispatch to web app's event system
          if (window.__DLP3D_onNativeMessage) {
            window.__DLP3D_onNativeMessage(detail);
          }
        }
      });

      // Notify RN that bridge is ready
      window.NativeAPI.notifyReady();
    })();
    true;
  `;
}

import type { NativeToWebViewEvent, WebViewToNativeEvent } from './types';
import type { WebView } from 'react-native-webview';
import { Platform } from 'react-native';

type EventHandler<T = unknown> = (payload: T) => void;

/**
 * Manages bidirectional communication between React Native and WebView.
 */
class WebViewBridge {
  private ref: WebView | null = null;
  private listeners: Map<string, EventHandler[]> = new Map();

  setRef(ref: WebView | null) {
    this.ref = ref;
  }

  /**
   * Send event from RN → WebView
   */
  send(event: NativeToWebViewEvent) {
    const js = `
      (function() {
        window.dispatchEvent(new CustomEvent('nativeMessage', {
          detail: ${JSON.stringify(event)}
        }));
      })();
      true;
    `;
    this.ref?.injectJavaScript(js);
  }

  /**
   * Handle incoming message from WebView → RN
   */
  handleMessage(data: string) {
    try {
      const event: WebViewToNativeEvent = JSON.parse(data);
      const handlers = this.listeners.get(event.type) || [];
      handlers.forEach(handler => handler(event.payload));
    } catch (e) {
      console.warn('[WebViewBridge] Failed to parse message:', e);
    }
  }

  /**
   * Subscribe to events from WebView
   */
  on(type: string, handler: EventHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * One-time event listener
   */
  once(type: string, handler: EventHandler) {
    const unsubscribe = this.on(type, (payload: unknown) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }
}

// Singleton instance
export const bridge = new WebViewBridge();

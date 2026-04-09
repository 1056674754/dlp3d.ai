import type { NativeToWebViewEvent, WebViewToNativeEvent } from './types';
import type { WebView } from 'react-native-webview';
import { pushDebugLog } from '@/store/debugLogStore';

type EventHandler<T = unknown> = (payload: T) => void;

/**
 * Manages bidirectional communication between React Native and WebView.
 */
class WebViewBridge {
  private ref: WebView | null = null;
  private listeners: Map<string, EventHandler[]> = new Map();
  private pendingOutbound: NativeToWebViewEvent[] = [];

  setRef(ref: WebView | null) {
    this.ref = ref;
    if (ref) {
      this.flushPending();
    }
  }

  private flushPending() {
    while (this.ref && this.pendingOutbound.length > 0) {
      const ev = this.pendingOutbound.shift();
      if (ev) {
        this.injectEvent(ev);
      }
    }
  }

  private injectEvent(event: NativeToWebViewEvent) {
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
   * Send event from RN → WebView
   */
  send(event: NativeToWebViewEvent) {
    pushDebugLog('rn', `→ ${event.type} ${JSON.stringify(event.payload).slice(0, 80)}`);
    if (!this.ref) {
      this.pendingOutbound.push(event);
      return;
    }
    this.injectEvent(event);
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

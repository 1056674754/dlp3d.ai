/**
 * AudioStreamService
 *
 * Manages native audio recording via AudioStreamModule.
 * Receives batched PCM data and VAD events, forwards them to the WebView
 * via the bridge for WebSocket transmission to the orchestrator.
 *
 * Architecture:
 *   Native AudioRecord(16kHz) → AudioStreamModule → onPCMData/onVad* events
 *   → bridge.send('audio:pcm'/'audio:vad') → WebView → WebSocket → orchestrator
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { bridge } from '@/bridge/WebViewBridge';
import { pushDebugLog } from '@/store/debugLogStore';

const { AudioStream } = NativeModules;

type VadState = 'silence' | 'speech';

let emitter: NativeEventEmitter | null = null;
let subscriptions: Array<{ remove: () => void }> = [];
let vadState: VadState = 'silence';
let isStreaming = false;

export function isNativeAudioAvailable(): boolean {
  return Platform.OS === 'android' && AudioStream != null;
}

export async function startNativeAudioStream(): Promise<void> {
  if (!isNativeAudioAvailable()) {
    pushDebugLog('audio', 'Native audio stream not available on this platform');
    return;
  }
  if (isStreaming) return;

  subscribeToNativeEvents();

  try {
    await AudioStream.start();
    isStreaming = true;
    vadState = 'silence';
    pushDebugLog('audio', 'Native audio stream started');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushDebugLog('audio', `Failed to start native audio: ${msg}`);
    throw e;
  }
}

export async function stopNativeAudioStream(): Promise<void> {
  if (!isNativeAudioAvailable()) return;
  if (!isStreaming) return;

  try {
    await AudioStream.stop();
  } catch {
    // Ignore — may already be stopped
  }

  unsubscribeFromNativeEvents();
  isStreaming = false;
  pushDebugLog('audio', 'Native audio stream stopped');
}

export function isNativeAudioStreaming(): boolean {
  return isStreaming;
}

export function getNativeVadState(): VadState {
  return vadState;
}

function subscribeToNativeEvents(): void {
  unsubscribeFromNativeEvents();

  if (!emitter) {
    emitter = new NativeEventEmitter(AudioStream as any);
  }

  subscriptions.push(
    emitter.addListener('onPCMData', (base64Data: string) => {
      if (!isStreaming) return;
      bridge.send({
        type: 'audio:pcm',
        payload: { data: base64Data },
      });
    }),
  );

  subscriptions.push(
    emitter.addListener('onVadSpeech', () => {
      vadState = 'speech';
      bridge.send({
        type: 'audio:vad',
        payload: { state: 'speech' },
      });
    }),
  );

  subscriptions.push(
    emitter.addListener('onVadSilence', () => {
      vadState = 'silence';
      bridge.send({
        type: 'audio:vad',
        payload: { state: 'silence' },
      });
    }),
  );
}

function unsubscribeFromNativeEvents(): void {
  subscriptions.forEach(s => {
    try {
      s.remove();
    } catch {
      // Ignore
    }
  });
  subscriptions = [];
}

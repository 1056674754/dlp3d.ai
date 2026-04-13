/**
 * WakeWordService
 *
 * Manages wake word detection using Sherpa-ONNX Keyword Spotter (KWS).
 * Loads a small zipformer transducer model trained on WenetSpeech for Chinese
 * keyword spotting, runs continuous AudioRecord in a native background thread,
 * and forwards detected wake words to the WebView layer via the bridge.
 *
 * Architecture:
 *   Mic → Sherpa-ONNX KWS (native) → onKwsDetected event → bridge.send('voice:wake') → WebView
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { bridge } from '@/bridge/WebViewBridge';
import { store } from '@/store';
import {
  setWakeWordListening,
  setWakeWordModelLoaded,
  setWakeWordError,
  setWakeWordDetected,
  type WakeWordState,
} from '@/store/wakeWordSlice';
import { pushDebugLog } from '@/store/debugLogStore';
import {
  startNativeAudioStream,
  stopNativeAudioStream,
  isNativeAudioAvailable,
} from '@/services/audioStreamService';

/** Sherpa-ONNX KWS native module. */
const { Kws } = NativeModules;

/** Event emitter for KWS detection events. */
let kwsEmitter: NativeEventEmitter | null = null;
let detectionSubscription: { remove: () => void } | null = null;

/** Watchdog timer handle. */
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

/** How long (ms) KWS listens before auto-restarting to mitigate memory leaks. */
const WATCHDOG_TIMEOUT_MS = 3 * 60 * 1000;

/** Whether the service is currently in the process of starting (to prevent double-start). */
let isStarting = false;

// ---------------------------------------------------------------------------
// Pre-encoded keyword mapping
// ---------------------------------------------------------------------------

/**
 * Map of Chinese wake words to their ppinyin-encoded format for the
 * Sherpa-ONNX KWS zipformer wenetspeech model.
 *
 * Format: space-separated pinyin initials + finals with tone marks, separated by spaces
 * Multiple keywords separated by "/" (slash) per sherpa-onnx convention.
 *
 * The @ symbol followed by Chinese text is the display name returned on detection.
 */
const KEYWORD_ENCODING_MAP: Record<string, string> = {
  '嘿你好': 'h ēi n ǐ h ǎo @嘿你好',
  '你好': 'n ǐ h ǎo @你好',
};

/**
 * Encode a list of Chinese keywords into the ppinyin format expected by the KWS model.
 * Keywords that are not in the pre-encoded map are silently skipped.
 */
function encodeKeywords(keywords: string[]): string {
  const encoded: string[] = [];
  for (const kw of keywords) {
    const trimmed = kw.trim();
    if (KEYWORD_ENCODING_MAP[trimmed]) {
      encoded.push(KEYWORD_ENCODING_MAP[trimmed]);
    } else {
      pushDebugLog('wake', `Keyword "${trimmed}" has no ppinyin encoding, skipping`);
    }
  }
  return encoded.join('/');
}

// ---------------------------------------------------------------------------
// Wake word resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective wake word list for the currently selected character.
 * Priority: per-character wakeWord → global default keywords from Settings.
 */
function resolveEffectiveKeywords(): string[] {
  const { wakeWord } = store.getState();
  const { selectedChat } = store.getState().chat;

  if (selectedChat?.wakeWord && selectedChat.wakeWord.trim().length > 0) {
    const characterWords = selectedChat.wakeWord
      .split(/[,，\n]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    if (characterWords.length > 0) {
      return characterWords;
    }
  }

  return wakeWord.keywords;
}

// ---------------------------------------------------------------------------
// Public API (same interface as before)
// ---------------------------------------------------------------------------

/**
 * Load the Sherpa-ONNX KWS model. Must be called before `startListening`.
 * The model is loaded from assets by the native module.
 */
export async function loadWakeWordModel(): Promise<void> {
  if (Platform.OS !== 'android') {
    pushDebugLog('wake', 'Wake word only supported on Android');
    return;
  }
  if (!Kws) {
    pushDebugLog('wake', 'KWS native module not available');
    store.dispatch(setWakeWordError('KWS native module not available'));
    return;
  }

  try {
    pushDebugLog('wake', 'Loading Sherpa-ONNX KWS model...');
    await Kws.loadModel();
    store.dispatch(setWakeWordModelLoaded(true));
    pushDebugLog('wake', 'Sherpa-ONNX KWS model loaded successfully');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.dispatch(setWakeWordError(msg));
    store.dispatch(setWakeWordModelLoaded(false));
    pushDebugLog('wake', `Failed to load KWS model: ${msg}`);
  }
}

/**
 * Start continuous wake word listening.
 * Keywords are encoded to ppinyin format and passed to the native KWS module.
 * Detection events are forwarded via NativeEventEmitter.
 */
export async function startWakeWordListening(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!Kws) return;
  if (isStarting) return;

  const state = store.getState().wakeWord;
  if (!state.modelLoaded) {
    store.dispatch(setWakeWordError('Model not loaded'));
    return;
  }
  if (state.isListening) return;

  isStarting = true;

  try {
    const wakeWords = resolveEffectiveKeywords();
    const encodedKeywords = encodeKeywords(wakeWords);

    if (!encodedKeywords) {
      pushDebugLog('wake', 'No valid encoded keywords available, cannot start listening');
      store.dispatch(setWakeWordError('No valid keywords'));
      return;
    }

    pushDebugLog('wake', `Starting KWS detection: [${wakeWords.join(', ')}] (encoded: ${encodedKeywords})`);

    // Subscribe to detection events before starting
    subscribeToDetectionEvents();

    await Kws.startListening(encodedKeywords);

    store.dispatch(setWakeWordListening(true));
    store.dispatch(setWakeWordError(null));
    startWatchdog();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.dispatch(setWakeWordError(msg));
    store.dispatch(setWakeWordListening(false));
    pushDebugLog('wake', `Failed to start KWS listening: ${msg}`);
  } finally {
    isStarting = false;
  }
}

/**
 * Stop wake word listening and clean up resources.
 */
export function stopWakeWordListening(): void {
  clearWatchdog();
  unsubscribeFromDetectionEvents();
  if (Kws) {
    Kws.stopListening().catch(() => {
      // Ignore — may already be stopped
    });
  }
  store.dispatch(setWakeWordListening(false));
  isStarting = false;
  pushDebugLog('wake', 'Wake word detection stopped');
}

/**
 * Unload the KWS model and release all resources.
 */
export function unloadWakeWordModel(): void {
  stopWakeWordListening();
  if (Kws) {
    Kws.unload().catch(() => {
      // Ignore
    });
  }
  store.dispatch(setWakeWordModelLoaded(false));
  pushDebugLog('wake', 'KWS model unloaded');
}

/**
 * Resume wake word listening after a conversation ends.
 * Stops the native audio stream first, then restarts KWS if enabled.
 */
export async function resumeAfterConversation(): Promise<void> {
  await stopNativeAudioStream();

  // Wait 1 second for character audio to stop playing and mic to settle.
  // Without this delay, KWS can falsely detect residual speaker audio or
  // transition noise as a wake word.
  await new Promise(resolve => setTimeout(resolve, 1000));

  const state = store.getState().wakeWord;
  if (state.isEnabled && state.modelLoaded) {
    await startWakeWordListening();
  }
}

// ---------------------------------------------------------------------------
// Detection event handling
// ---------------------------------------------------------------------------

function subscribeToDetectionEvents(): void {
  unsubscribeFromDetectionEvents();

  if (!Kws) return;

  if (!kwsEmitter) {
    kwsEmitter = new NativeEventEmitter(Kws);
  }

  detectionSubscription = kwsEmitter.addListener(
    'onKwsDetected',
    (event: { keyword: string }) => {
      handleKwsDetection(event.keyword);
    },
  );
}

function unsubscribeFromDetectionEvents(): void {
  if (detectionSubscription) {
    detectionSubscription.remove();
    detectionSubscription = null;
  }
}

/**
 * Handle a detected keyword from the KWS native module.
 *
 * 1. Dispatch to Redux
 * 2. Stop KWS (release microphone)
 * 3. Wait 300ms for mic handoff
 * 4. Start native audio stream for conversation
 * 5. Send bridge event to WebView
 */
async function handleKwsDetection(keyword: string): Promise<void> {
  const state = store.getState().wakeWord;
  if (!state.isListening) return;

  pushDebugLog('wake', `Wake word detected: "${keyword}"`);

  store.dispatch(setWakeWordDetected(keyword));

  // Send bridge event FIRST so the FSM transitions to WAITING_FOR_USER_STOP_RECORDING
  // before any NATIVE_VAD_SILENCE events arrive from the audio stream.
  bridge.send({
    type: 'voice:wake',
    payload: { keyword, confidence: 1.0 },
  });

  // Stop KWS and start native audio stream for conversation
  // KWS and AudioStream share the microphone — can't run both
  stopWakeWordListening();

  // Wait for KWS to fully release the microphone before starting AudioRecord.
  await new Promise(resolve => setTimeout(resolve, 300));

  if (isNativeAudioAvailable()) {
    startNativeAudioStream().catch(e => {
      pushDebugLog('wake', `Failed to start native audio: ${e}`);
    });
  }
}

// ---------------------------------------------------------------------------
// Watchdog — periodic restart to mitigate potential memory leaks
// ---------------------------------------------------------------------------

function startWatchdog(): void {
  clearWatchdog();
  watchdogTimer = setTimeout(() => {
    pushDebugLog('wake', 'Watchdog triggered — restarting KWS');
    restartListening();
  }, WATCHDOG_TIMEOUT_MS);
}

function clearWatchdog(): void {
  if (watchdogTimer !== null) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

async function restartListening(): Promise<void> {
  const state = store.getState().wakeWord;
  if (!state.isListening) return;

  // Stop current session
  stopWakeWordListening();

  // Brief pause to allow cleanup
  await new Promise(resolve => setTimeout(resolve, 300));

  // Restart if still enabled
  if (store.getState().wakeWord.isEnabled && store.getState().wakeWord.modelLoaded) {
    await startWakeWordListening();
  }
}

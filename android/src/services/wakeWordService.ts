/**
 * WakeWordService
 *
 * Manages wake word detection using Vosk grammar mode.
 * Loads the Chinese Vosk model, starts continuous listening with a configurable
 * grammar, and forwards detected wake words to the WebView layer via the bridge.
 *
 * Architecture:
 *   Mic → Vosk (grammar mode) → onResult → bridge.send('voice:wake') → WebView
 *
 * References:
 *   - Vosk grammar mode: https://github.com/alphacep/vosk-api/issues/107
 *   - openclaw-assistant production implementation: github.com/yuga-hashimoto/openclaw-assistant
 */

import { Platform } from 'react-native';
import * as Vosk from 'react-native-vosk';
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

/** Model name used with StorageService.unpack (assets subfolder name). */
const VOSK_MODEL_NAME = 'model-small-cn-0.22';

/** How long (ms) Vosk listens before auto-restarting to mitigate memory leaks.
 *  openclaw-assistant uses 5 minutes; we use 3 minutes for safety margin.
 */
const WATCHDOG_TIMEOUT_MS = 3 * 60 * 1000;

/** Minimum confidence threshold for a wake word detection to be accepted. */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

/** Subscriptions to Vosk events, cleaned up on stop. */
let subscriptions: Array<{ remove: () => void }> = [];

/** Watchdog timer handle. */
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

/** Whether the service is currently in the process of starting (to prevent double-start). */
let isStarting = false;

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
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the Vosk model. Must be called before `startListening`.
 * The model is unpacked from assets to the app's internal storage by Vosk's
 * StorageService.
 */
export async function loadWakeWordModel(): Promise<void> {
  if (Platform.OS !== 'android') {
    pushDebugLog('wake', 'Wake word only supported on Android');
    return;
  }

  try {
    pushDebugLog('wake', `Loading Vosk model: ${VOSK_MODEL_NAME}`);
    await Vosk.loadModel(VOSK_MODEL_NAME);
    store.dispatch(setWakeWordModelLoaded(true));
    pushDebugLog('wake', 'Vosk model loaded successfully');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.dispatch(setWakeWordError(msg));
    store.dispatch(setWakeWordModelLoaded(false));
    pushDebugLog('wake', `Failed to load Vosk model: ${msg}`);
  }
}

/**
 * Start continuous wake word listening in grammar mode.
 * Only the configured wake words will be recognised; everything else
 * is absorbed by the `[unk]` token.
 */
export async function startWakeWordListening(): Promise<void> {
  if (Platform.OS !== 'android') return;
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
    const grammar = [...wakeWords, '[unk]'];

    pushDebugLog(
      'wake',
      `Starting wake word detection: [${wakeWords.join(', ')}]`,
    );

    // Subscribe to Vosk events before starting
    subscribeToVoskEvents();

    await Vosk.start({
      grammar,
      // No timeout — we manage our own watchdog
    });

    store.dispatch(setWakeWordListening(true));
    store.dispatch(setWakeWordError(null));
    startWatchdog();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.dispatch(setWakeWordError(msg));
    store.dispatch(setWakeWordListening(false));
    pushDebugLog('wake', `Failed to start listening: ${msg}`);
  } finally {
    isStarting = false;
  }
}

/**
 * Stop wake word listening and clean up resources.
 */
export function stopWakeWordListening(): void {
  clearWatchdog();
  unsubscribeFromVoskEvents();
  try {
    Vosk.stop();
  } catch {
    // Ignore — may already be stopped
  }
  store.dispatch(setWakeWordListening(false));
  isStarting = false;
  pushDebugLog('wake', 'Wake word detection stopped');
}

/**
 * Unload the Vosk model and release all resources.
 */
export function unloadWakeWordModel(): void {
  stopWakeWordListening();
  try {
    Vosk.unload();
  } catch {
    // Ignore
  }
  store.dispatch(setWakeWordModelLoaded(false));
  pushDebugLog('wake', 'Vosk model unloaded');
}

export async function resumeAfterConversation(): Promise<void> {
  await stopNativeAudioStream();

  const state = store.getState().wakeWord;
  if (state.isEnabled && state.modelLoaded) {
    await startWakeWordListening();
  }
}

// ---------------------------------------------------------------------------
// Vosk event handling
// ---------------------------------------------------------------------------

function subscribeToVoskEvents(): void {
  // Clean up any existing subscriptions first
  unsubscribeFromVoskEvents();

  // Result event — fired when a complete utterance is recognised
  subscriptions.push(
    Vosk.onResult((resultText: string) => {
      handleVoskResult(resultText);
    }),
  );

  // Partial result — useful for debug but we don't act on partials
  subscriptions.push(
    Vosk.onPartialResult((partial: string) => {
      // Only log in debug mode to avoid spamming
      if (__DEV__) {
        pushDebugLog('wake', `Partial: ${partial}`);
      }
    }),
  );

  // Error handling
  subscriptions.push(
    Vosk.onError((error: string) => {
      pushDebugLog('wake', `Vosk error: ${error}`);
      store.dispatch(setWakeWordError(error));
    }),
  );

  // Timeout — restart if we're still supposed to be listening
  subscriptions.push(
    Vosk.onTimeout(() => {
      pushDebugLog('wake', 'Vosk timeout — restarting');
      restartListening();
    }),
  );
}

function unsubscribeFromVoskEvents(): void {
  subscriptions.forEach(s => {
    try {
      s.remove();
    } catch {
      // Ignore
    }
  });
  subscriptions = [];
}

/**
 * Parse a Vosk result string and check if a configured wake word was detected.
 *
 * Vosk grammar mode returns JSON like: {"text": "你好小智"}
 * Confidence is also embedded when available: {"text": "你好 小智", "confidence": 0.87}
 */
async function handleVoskResult(resultText: string): Promise<void> {
  const state = store.getState().wakeWord;
  if (!state.isListening) return;

  // The Kotlin layer (VoskModule.onResult) already extracts the "text" field
  // from the Vosk hypothesis JSON — resultText is the plain recognised string,
  // e.g. "嘿你好" or "[unk]", NOT raw JSON.
  const text = resultText.trim();
  if (!text || text === '[unk]') return;

  const effectiveKeywords = resolveEffectiveKeywords();
  const lowerText = text.toLowerCase().replace(/\s+/g, '');
  const matchedKeyword = effectiveKeywords.find(kw =>
    lowerText.includes(kw.toLowerCase().replace(/\s+/g, '')),
  );

  if (!matchedKeyword) return;

  pushDebugLog(
    'wake',
    `Wake word detected: "${matchedKeyword}" (raw: "${text}")`,
  );

  store.dispatch(setWakeWordDetected(matchedKeyword));

  // Stop Vosk and start native audio stream for conversation
  // Vosk and AudioStream share the microphone — can't run both
  stopWakeWordListening();

  // Wait for Vosk to fully release the microphone before starting AudioRecord.
  // Without this delay, AudioRecord may capture stale data from Vosk's buffer
  // or fail to initialize properly because the mic hardware is still in transition.
  await new Promise(resolve => setTimeout(resolve, 300));

  if (isNativeAudioAvailable()) {
    startNativeAudioStream().catch(e => {
      pushDebugLog('wake', `Failed to start native audio: ${e}`);
    });
  }

  bridge.send({
    type: 'voice:wake',
    payload: { keyword: matchedKeyword, confidence: 1.0 },
  });
}

// ---------------------------------------------------------------------------
// Watchdog — periodic restart to mitigate Vosk memory leaks
// ---------------------------------------------------------------------------

function startWatchdog(): void {
  clearWatchdog();
  watchdogTimer = setTimeout(() => {
    pushDebugLog('wake', 'Watchdog triggered — restarting Vosk');
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
  try {
    Vosk.stop();
  } catch {
    // Ignore
  }
  unsubscribeFromVoskEvents();

  // Brief pause to allow cleanup
  await new Promise(resolve => setTimeout(resolve, 300));

  // Restart if still enabled
  if (store.getState().wakeWord.isEnabled && store.getState().wakeWord.modelLoaded) {
    await startWakeWordListening();
  }
}

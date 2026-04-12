import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

export interface WakeWordState {
  /** Whether wake word detection is enabled (user toggle). */
  isEnabled: boolean;
  /** Whether the Vosk model has been loaded into memory. */
  modelLoaded: boolean;
  /** Whether the recognizer is actively listening. */
  isListening: boolean;
  /** Last wake word keyword that was detected (cleared after consumption). */
  lastDetectedKeyword: string | null;
  /** Custom wake word keywords configured by the user. */
  keywords: string[];
  /** Last error message, or null. */
  error: string | null;
}

const initialState: WakeWordState = {
  isEnabled: false,
  modelLoaded: false,
  isListening: false,
  lastDetectedKeyword: null,
  keywords: ['嘿你好'],
  error: null,
};

export const wakeWordSlice = createSlice({
  name: 'wakeWord',
  initialState,
  reducers: {
    setWakeWordEnabled: (state, { payload }: PayloadAction<boolean>) => {
      state.isEnabled = payload;
    },
    setWakeWordModelLoaded: (state, { payload }: PayloadAction<boolean>) => {
      state.modelLoaded = payload;
    },
    setWakeWordListening: (state, { payload }: PayloadAction<boolean>) => {
      state.isListening = payload;
    },
    setWakeWordDetected: (state, { payload }: PayloadAction<string>) => {
      state.lastDetectedKeyword = payload;
    },
    clearWakeWordDetected: state => {
      state.lastDetectedKeyword = null;
    },
    setWakeWordKeywords: (state, { payload }: PayloadAction<string[]>) => {
      state.keywords = payload.filter(k => k.trim().length > 0);
    },
    setWakeWordError: (state, { payload }: PayloadAction<string | null>) => {
      state.error = payload;
    },
  },
  extraReducers: builder => {
    builder.addCase(REHYDRATE, (state, action) => {
      const payload = (
        action as { payload?: { wakeWord?: Partial<WakeWordState> } }
      ).payload;
      const incoming = payload?.wakeWord;
      if (incoming) {
        return { ...initialState, ...incoming, modelLoaded: false, isListening: false, lastDetectedKeyword: null, error: null };
      }
      return state ?? initialState;
    });
  },
});

export const {
  setWakeWordEnabled,
  setWakeWordModelLoaded,
  setWakeWordListening,
  setWakeWordDetected,
  clearWakeWordDetected,
  setWakeWordKeywords,
  setWakeWordError,
} = wakeWordSlice.actions;

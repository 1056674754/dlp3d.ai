import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { setWakeWordEnabled } from '@/store/wakeWordSlice';
import {
  loadWakeWordModel,
  startWakeWordListening,
  stopWakeWordListening,
  unloadWakeWordModel,
} from '@/services/wakeWordService';

export function useWakeWord() {
  const dispatch = useDispatch();
  const { isEnabled, isListening, modelLoaded, lastDetectedKeyword, keywords, error } =
    useSelector((state: RootState) => state.wakeWord);
  const selectedCharacterId = useSelector(
    (state: RootState) => state.chat.selectedCharacterId,
  );
  const selectedCharacterWakeWord = useSelector(
    (state: RootState) => state.chat.selectedChat?.wakeWord ?? '',
  );
  const hasInitialized = useRef(false);
  const lastWakeConfig = useRef('');

  useEffect(() => {
    if (!isEnabled) {
      if (isListening) {
        stopWakeWordListening();
      }
      if (modelLoaded) {
        unloadWakeWordModel();
      }
      hasInitialized.current = false;
      lastWakeConfig.current = '';
      return;
    }

    const wakeConfigKey = JSON.stringify({
      selectedCharacterId,
      selectedCharacterWakeWord,
      keywords,
    });

    if (hasInitialized.current) {
      if (wakeConfigKey !== lastWakeConfig.current) {
        lastWakeConfig.current = wakeConfigKey;
        if (isListening) {
          stopWakeWordListening();
          void startWakeWordListening();
        } else if (modelLoaded) {
          void startWakeWordListening();
        }
      }
      return;
    }
    hasInitialized.current = true;
    lastWakeConfig.current = wakeConfigKey;

    let cancelled = false;

    (async () => {
      if (!modelLoaded) {
        await loadWakeWordModel();
      }
      if (!cancelled) {
        await startWakeWordListening();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isEnabled,
    modelLoaded,
    isListening,
    selectedCharacterId,
    selectedCharacterWakeWord,
    keywords,
  ]);

  const toggleWakeWord = (enabled: boolean) => {
    dispatch(setWakeWordEnabled(enabled));
  };

  return {
    isEnabled,
    isListening,
    modelLoaded,
    lastDetectedKeyword,
    keywords,
    error,
    toggleWakeWord,
  };
}

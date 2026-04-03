import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  PERMISSIONS,
  request,
  requestNotifications,
} from 'react-native-permissions';

/**
 * One-shot runtime prompts for mic (ASR / voice) and post notifications (Android 13+).
 * Does not block UI; failures are logged only.
 */
export function useAndroidRuntimePermissions() {
  const ran = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || ran.current) {
      return;
    }
    ran.current = true;

    void (async () => {
      try {
        await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
        if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
          await requestNotifications([]);
        }
      } catch (e) {
        console.warn('[useAndroidRuntimePermissions]', e);
      }
    })();
  }, []);
}

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isNativeApp, onNativeMessage } from '@/utils/nativeBridge'

/**
 * Applies native → Web settings: language, and refreshes character when RN saves config.
 */
export function useNativeSettingsBridge(
  refreshSelectedCharacter: () => Promise<void>,
) {
  const { i18n } = useTranslation()
  const refreshRef = useRef(refreshSelectedCharacter)
  refreshRef.current = refreshSelectedCharacter

  useEffect(() => {
    if (!isNativeApp()) return
    return onNativeMessage(detail => {
      if (!detail?.type) return
      if (detail.type === 'language:change' && detail.payload?.lang) {
        const lng = detail.payload.lang === 'zh' ? 'zh' : 'en'
        void i18n.changeLanguage(lng)
      }
      if (detail.type === 'theme:change' && detail.payload?.theme) {
        const dark = detail.payload.theme === 'dark'
        if (typeof document !== 'undefined') {
          document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
        }
      }
      if (
        detail.type === 'config:update' &&
        detail.payload &&
        (detail.payload as { source?: string }).source === 'native-settings'
      ) {
        void refreshRef.current()
      }
    })
  }, [i18n])
}

'use client'

import { useEffect } from 'react'
import { isNativeApp, onNativeMessage } from '@/utils/nativeBridge'
import { navigateInPackagedWebview } from '@/utils/packagedWebview'

/**
 * React Native WebView：处理原生下发的 `webview:navigate`（如设置里打开 /debug）。
 */
export function NativeWebBridge() {
  useEffect(() => {
    if (!isNativeApp()) return
    return onNativeMessage(detail => {
      if (!detail?.type || detail.type !== 'webview:navigate') return
      const path = (detail.payload as { path?: string })?.path
      if (path) navigateInPackagedWebview(path)
    })
  }, [])

  return null
}

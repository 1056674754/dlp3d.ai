'use client'

import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { isNativeApp, onNativeMessage } from '@/utils/nativeBridge'
import { navigateInPackagedWebview } from '@/utils/packagedWebview'
import { logout } from '@/features/auth/authStore'

/**
 * React Native WebView：处理原生下发的 `webview:navigate`、`auth:logout` 等。
 */
export function NativeWebBridge() {
  const dispatch = useDispatch()

  useEffect(() => {
    if (!isNativeApp()) return
    return onNativeMessage(detail => {
      if (!detail?.type) return
      if (detail.type === 'webview:navigate') {
        const path = (detail.payload as { path?: string })?.path
        if (path) navigateInPackagedWebview(path)
        return
      }
      if (detail.type === 'auth:logout') {
        dispatch(logout())
      }
    })
  }, [dispatch])

  return null
}

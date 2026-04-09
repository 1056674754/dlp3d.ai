'use client'
import { useState, useEffect } from 'react'
import { BabylonJSProvider } from '../contexts/BabylonJSContext'
import SceneLayout from '../layouts/scene'
import Navigation from '../components/layout/Navigation'
import AuthGuard from '../components/auth/AuthGuard'
import ScreenshotOverlay from '../components/ui/ScreenshotOverlay'
import MobileConversationHUD from '../components/native/MobileConversationHUD'
import { CssBaseline, ThemeProvider } from '@mui/material'
import appTheme from '@/themes/theme'
import '@/styles/components.css'
import { useDispatch } from 'react-redux'
import { useSelector } from 'react-redux'
import { setAuthState, loadAuthStateFromStorage } from '@/features/auth/authStore'
import { setIsChatStarting } from '@/features/chat/chat'
import { isNativeApp } from '@/utils/nativeBridge'
import { getIsLogin } from '@/features/auth/authStore'
import { usePromptingSettings } from '@/hooks/usePromptingSettings'

export default function BabylonPage() {
  const dispatch = useDispatch()
  const isLogin = useSelector(getIsLogin)
  const { loadUserCharacters } = usePromptingSettings()
  const [showScreenshotOverlay, setShowScreenshotOverlay] = useState(true)
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [native] = useState(() => isNativeApp())

  useEffect(() => {
    dispatch(setAuthState(loadAuthStateFromStorage()))
  }, [dispatch])

  useEffect(() => {
    dispatch(setIsChatStarting(true))
  }, [dispatch])

  useEffect(() => {
    if (!isLogin) {
      return
    }
    void loadUserCharacters()
    // `loadUserCharacters` is recreated by the hook; we only want to prime
    // chat data when login state becomes available on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogin])

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = localStorage.getItem('dlp_current_session_id')
    setCurrentSessionId(sessionId)
  }, [])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const characterIdFromUrl = urlParams.get('character_id')

    if (characterIdFromUrl) {
      localStorage.setItem('dlp_selected_character_id', characterIdFromUrl)
      setCharacterId(characterIdFromUrl)
    } else {
      const storedCharacterId = localStorage.getItem('dlp_selected_character_id')
      if (storedCharacterId) {
        setCharacterId(storedCharacterId)
      }
    }
  }, [])

  const handleScreenshotOverlayClose = () => {
    setShowScreenshotOverlay(false)
  }

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline enableColorScheme />
      {!native && <Navigation />}
      <AuthGuard redirectTo="/">
        <BabylonJSProvider characterId={characterId}>
          <SceneLayout />
          <MobileConversationHUD />
        </BabylonJSProvider>
      </AuthGuard>

      {showScreenshotOverlay && !native && (
        <ScreenshotOverlay
          onClose={handleScreenshotOverlayClose}
          sessionId={currentSessionId}
        />
      )}
    </ThemeProvider>
  )
}

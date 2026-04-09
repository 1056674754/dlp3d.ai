'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { TFunction } from 'i18next'
import { HDRI_SCENES } from '@/library/babylonjs/config/scene'
import Navigation from './components/layout/Navigation'

import Footer from './components/layout/Footer'

import MobileNoticePanel from './components/ui/MobileNoticePanel'
import { useDevice } from './contexts/DeviceContext'
import BabylonViewer, { BabylonViewerRef } from './components/ui/BabylonViewer'
import LoadingScreen from './components/LoadingScreen'
import '@/styles/components.css'
import { captureScreenshot, saveScreenshotToStorage } from '@/utils/screenshot'
import {
  isNativeApp,
  patchWindowOpen,
  shouldHideWebAuthChrome,
} from '@/utils/nativeBridge'
import { navigateInPackagedWebview } from '@/utils/packagedWebview'

import ConfigSidebar from './components/sidebar'
import NativeScenePicker from './components/layout/NativeScenePicker'
import LeftSidebar from './components/setting'
import { useSelector, useDispatch } from 'react-redux'
import {
  getIsChatStarting,
  setIsChatStarting,
  getSelectedModelIndex,
  getSelectedCharacterId,
  setIsCharacterLoading,
  getIsCharacterLoading,
  getLoadingText,
  setLoadingText,
  getIsSceneLoading,
  setIsSceneLoading,
  getLoadingProgress,
  setLoadingProgress,
  getSelectedChat,
} from '@/features/chat/chat'

import {
  getIsLogin,
  loadAuthStateFromStorage,
  setAuthState,
  getUserInfo,
} from '@/features/auth/authStore'
import { usePromptingSettings } from '@/hooks/usePromptingSettings'
import { useNativeChatBridge } from '@/hooks/useNativeChatBridge'
import { useNativeSettingsBridge } from '@/hooks/useNativeSettingsBridge'
import { checkLocation, isSensetimeOrchestrator } from '@/utils/location'
import { ConfirmDialog } from './components/common/Dialog'
import { useTranslation } from 'react-i18next'
import { fetchGetMissingSecret } from '@/request/api'
import {
  logStartupEvent,
  STARTUP_EVENT_NAME,
  type StartupEventPayload,
} from '@/utils/startupProfiler'

const link = {
  href: 'https://github.com/dlp3d-ai/dlp3d.ai',
  className: 'peper',
  title: 'GitHub',
  label: 'GitHub',
}

interface StartupLoadingStep {
  progress: number
  text: string
}

/**
 * Map startup event stages to loading progress.
 *
 * Character loading and scene/HDR/ground loading run IN PARALLEL.
 * Progress values are absolute "at-least" marks; applyLoadingState
 * uses Math.max so they never regress regardless of arrival order.
 * The trickle effect fills visual gaps during long async waits.
 */
function getStartupLoadingStep(
  stage: string,
  t: TFunction,
): StartupLoadingStep | null {
  switch (stage) {
    // --- Boot ---
    case 'home.component-mounted':
    case 'babylon.viewer-mounted':
      return { progress: 5, text: t('loading.bootingApp') }

    case 'babylon.scene-change':
      return {
        progress: 8,
        text: t('loading.initializeScene', { ns: 'client' }),
      }

    // --- Parallel: character track (typically fast with cache) ---
    case 'babylon.character-load:start':
      return {
        progress: 10,
        text: t('loading.loadEnvironment', { ns: 'client' }),
      }

    case 'babylon.character-load:end':
    case 'home.character-loaded':
      return {
        progress: 25,
        text: t('loading.loadEnvironment', { ns: 'client' }),
      }

    // --- Parallel: scene track (HDR + ground — the real bottleneck) ---
    case 'babylon.scene.startup-ground-ready':
      return {
        progress: 12,
        text: t('loading.loadEnvironment', { ns: 'client' }),
      }

    case 'babylon.scene.hdr:start':
      return {
        progress: 15,
        text: t('loading.loadEnvironment', { ns: 'client' }),
      }

    case 'babylon.scene.hdr:end':
      return {
        progress: 55,
        text: t('loading.loadEnvironment', { ns: 'client' }),
      }

    case 'babylon.scene.ground:start':
      return {
        progress: 60,
        text: t('loading.finalizingScene'),
      }

    case 'babylon.scene.ground:end':
      return { progress: 88, text: t('loading.finalizingScene') }

    case 'babylon.scene.visual-ready':
      return {
        progress: 14,
        text: t('loading.loadEnvironment', { ns: 'client' }),
      }

    // --- Both tracks done ---
    case 'babylon.scene.fully-ready':
    case 'home.scene-fully-ready':
      return { progress: 95, text: t('loading.finalizingScene') }

    case 'home.loading-overlay-hidden':
      return {
        progress: 100,
        text: t('loading.systemReady', { ns: 'client' }),
      }

    default:
      return null
  }
}

/**
 * Home component.
 *
 * The main page component that manages the 3D scene viewer, chat initialization,
 * character loading, and scene management. Handles user authentication, loading states,
 * and navigation to the chat interface.
 */
export default function Home() {
  const dispatch = useDispatch()
  const selectedChat = useSelector(getSelectedChat)
  const { t } = useTranslation()
  const babylonViewerRef = useRef<BabylonViewerRef>(null)

  const isChatStarting = useSelector(getIsChatStarting)
  const isLogin = useSelector(getIsLogin)
  const user = useSelector(getUserInfo)
  const selectedModelIndex = useSelector(getSelectedModelIndex)
  const selectedCharacterId = useSelector(getSelectedCharacterId)
  const isCharacterLoading = useSelector(getIsCharacterLoading)
  const loadingText = useSelector(getLoadingText)
  const isSceneLoading = useSelector(getIsSceneLoading)
  const loadingProgress = useSelector(getLoadingProgress)

  const [sceneName, setSceneName] = useState(HDRI_SCENES[3].name)
  const initialSceneNameRef = useRef(sceneName)
  const initialModelIndexRef = useRef(selectedModelIndex)
  const isSensetimeTAServer = isSensetimeOrchestrator()

  const [chatAvailable, setChatAvailable] = useState(false) // Whether Chat should be enabled for current character
  const [characterChangeKey, setCharacterChangeKey] = useState(0) // Track character selection changes

  const [uiFadeOut, setUiFadeOut] = useState(false) // Controls fade-out animation
  const [isLoading, setIsLoading] = useState(true) // Loading state
  const [isGlobalLoading, setIsGlobalLoading] = useState(
    isLoading || isSceneLoading || isCharacterLoading,
  )
  const [currentTtsType, setCurrentTtsType] = useState<string | null>(null)
  const [showUnsupportedTtsNotice, setShowUnsupportedTtsNotice] = useState(false)
  const { isMobile } = useDevice()
  const [loadingHint, setLoadingHint] = useState('')
  const loadingProgressRef = useRef(0)
  const {
    loadUserCharacters,
    characters,
    selectCharacter,
    deleteCharacter,
    createChatFromTemplate,
    refreshSelectedCharacter,
  } = usePromptingSettings()
  useNativeChatBridge({
    characters,
    selectCharacter,
    deleteCharacter,
    createChatFromTemplate,
  })
  useNativeSettingsBridge(refreshSelectedCharacter)
  const [selectedScene, setSelectedScene] = useState(3) // Parameter for scene navigation
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [missingSecretDialogOpen, setMissingSecretDialogOpen] = useState(false)
  const [missingSecret, setMissingSecret] = useState<{
    llm_requirements: string[]
    tts_requirements: string[]
    asr_requirements: string[]
  }>({
    llm_requirements: [],
    tts_requirements: [],
    asr_requirements: [],
  })

  useEffect(() => {
    dispatch(setIsSceneLoading(true))
    dispatch(setIsCharacterLoading(true))
    logStartupEvent('home.component-mounted', {
      initialSceneName: initialSceneNameRef.current,
      initialModelIndex: initialModelIndexRef.current,
    })
  }, [])

  const applyLoadingState = useCallback(
    (nextProgress: number, nextText: string, nextHint?: string) => {
      const normalizedProgress = Math.min(
        100,
        Math.max(loadingProgressRef.current, Math.round(nextProgress)),
      )

      loadingProgressRef.current = normalizedProgress
      dispatch(setLoadingProgress(normalizedProgress))
      dispatch(setLoadingText(nextText))

      if (typeof nextHint === 'string') {
        setLoadingHint(nextHint)
      }
    },
    [dispatch],
  )

  const beginLoadingCycle = useCallback(
    (nextProgress: number, nextText: string, nextHint?: string) => {
      const normalizedProgress = Math.max(0, Math.min(100, Math.round(nextProgress)))

      loadingProgressRef.current = normalizedProgress
      dispatch(setLoadingProgress(normalizedProgress))
      dispatch(setLoadingText(nextText))

      if (typeof nextHint === 'string') {
        setLoadingHint(nextHint)
      }
    },
    [dispatch],
  )

  useEffect(() => {
    if (loadingProgressRef.current === 0) {
      beginLoadingCycle(6, t('loading.bootingApp'), t('loading.firstLaunchHint'))
      return
    }

    if (isGlobalLoading) {
      setLoadingHint(t('loading.firstLaunchHint'))
    }
  }, [beginLoadingCycle, isGlobalLoading, t])

  useEffect(() => {
    const handleStartupEvent = (event: Event) => {
      const { detail } = event as CustomEvent<StartupEventPayload>
      const step = getStartupLoadingStep(detail.stage, t)

      if (!step) {
        return
      }

      applyLoadingState(
        step.progress,
        step.text,
        detail.stage === 'home.loading-overlay-hidden'
          ? t('loading.readyHint')
          : t('loading.firstLaunchHint'),
      )
    }

    window.addEventListener(STARTUP_EVENT_NAME, handleStartupEvent as EventListener)

    return () => {
      window.removeEventListener(
        STARTUP_EVENT_NAME,
        handleStartupEvent as EventListener,
      )
    }
  }, [applyLoadingState, t])

  useEffect(() => {
    if (!isGlobalLoading) return

    const TRICKLE_START = 15
    const TRICKLE_END = 88
    const TRICKLE_INTERVAL_MS = 600

    const id = setInterval(() => {
      const cur = loadingProgressRef.current
      if (cur < TRICKLE_START || cur >= TRICKLE_END) return

      const remaining = TRICKLE_END - cur
      const step = Math.max(1, Math.round(remaining * 0.06))
      const text = t('loading.loadEnvironment', { ns: 'client' })
      applyLoadingState(cur + step, text)
    }, TRICKLE_INTERVAL_MS)

    return () => clearInterval(id)
  }, [applyLoadingState, isGlobalLoading, t])

  useEffect(() => {
    setIsGlobalLoading(isSceneLoading || isCharacterLoading)
  }, [isSceneLoading, isCharacterLoading])

  useEffect(() => {
    if (!isGlobalLoading) {
      logStartupEvent('home.loading-overlay-hidden', {
        isLoading,
        isSceneLoading,
        isCharacterLoading,
      })
    }
  }, [isGlobalLoading, isLoading, isSceneLoading, isCharacterLoading])

  useEffect(() => {
    if (!isGlobalLoading) return
    const SAFETY_TIMEOUT_MS = 30_000
    const id = setTimeout(() => {
      console.warn('[page] Safety timeout: force-dismissing loading overlay', {
        isSceneLoading,
        isCharacterLoading,
      })
      dispatch(setIsSceneLoading(false))
      dispatch(setIsCharacterLoading(false))
    }, SAFETY_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [isGlobalLoading, dispatch, isSceneLoading, isCharacterLoading])

  useEffect(() => {
    ;(window as any).babylonViewerRef = babylonViewerRef
    return () => {
      delete (window as any).babylonViewerRef
    }
  }, [])
  useEffect(() => {
    if (isLogin) {
      ;(async () => {
        try {
          await loadUserCharacters()
        } catch (e) {
          console.warn('[loadUserCharacters]', e)
        }
      })()
      setChatAvailable(true)
    }
  }, [isLogin])

  useEffect(() => {
    dispatch(setAuthState(loadAuthStateFromStorage()))
  }, [])

  useEffect(() => {
    if (isNativeApp()) {
      patchWindowOpen()
    }
  }, [])

  useEffect(() => {
    if (selectedChat) {
      const name = HDRI_SCENES.find(
        (scene: any) => scene.name === selectedChat.scene_name,
      )?.name

      if (selectedChat.scene_name && name !== sceneName) {
        const index = HDRI_SCENES.findIndex(
          (scene: any) => scene.name === selectedChat.scene_name,
        )
        if (index !== -1) {
          dispatch(setIsSceneLoading(true))
          beginLoadingCycle(
            20,
            t('loading.initializeScene', { ns: 'client' }),
            t('loading.firstLaunchHint'),
          )
          setSceneName(HDRI_SCENES[index].name)
          setSelectedScene(index)
        }
      }
    }
  }, [beginLoadingCycle, dispatch, sceneName, selectedChat, t])

  /**
   * Handle character loaded event.
   *
   * Dispatches actions to update loading state and triggers a custom event
   * after a delay to ensure all components are initialized.
   *
   * @returns void
   */
  const handleCharacterLoaded = useCallback(() => {
    logStartupEvent('home.character-loaded')
    dispatch(setIsCharacterLoading(false))
    // Delay event trigger to ensure all components are initialized
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('character-loaded'))
      }
    }, 1000)
  }, [dispatch])

  /**
   * Handle scene change.
   *
   * @param scene The name of the scene to switch to.
   *
   * @returns void
   */
  const handleSceneChange = (scene: string) => {
    dispatch(setIsSceneLoading(true))
    beginLoadingCycle(
      20,
      t('loading.initializeScene', { ns: 'client' }),
      t('loading.firstLaunchHint'),
    )

    setSceneName(scene)
    const index = HDRI_SCENES.findIndex((scene: any) => scene.name === scene)
    setSelectedScene(index)
  }

  /**
   * Handle scene loaded event.
   *
   * Dispatches actions to update loading state when the scene has finished loading.
   *
   * @returns void
   */
  const handleSceneLoaded = useCallback(() => {
    logStartupEvent('home.scene-fully-ready')
    dispatch(setIsSceneLoading(false))
  }, [dispatch])

  /**
   * Handle starting a conversation.
   *
   * Validates prerequisites, saves camera and scene state, captures a screenshot,
   * and opens a new window with the chat interface. Handles TTS compatibility checks
   * and location-based warnings for specific server hosts.
   *
   * @returns Promise<void> Resolves after the new window is opened or a notice is shown.
   */
  const handleStartConversation = useCallback(async () => {
    console.error('[handleStartConversation] called', {
      isCharacterLoading,
      isSceneLoading,
      chatAvailable,
      isNative: isNativeApp(),
      selectedScene,
      selectedCharacterId,
    })

    if (isCharacterLoading || isSceneLoading) {
      console.error('[handleStartConversation] blocked: still loading')
      return
    }

    if (!chatAvailable) {
      console.error('[handleStartConversation] blocked: chatAvailable=false')
      return
    }

    // Native WebView: skip secret checks, screenshots, location checks — just navigate
    if (isNativeApp()) {
      const url = `/babylon?scene=${selectedScene}${
        selectedCharacterId ? `&character_id=${selectedCharacterId}` : ''
      }`
      console.error('[handleStartConversation] navigating to:', url)
      navigateInPackagedWebview(url)
      return
    }

    // Block unsupported TTS for specific server host
    const unsupportedList = [
      'sensenova_v2',
      'sense_v2',
      'softsugar_v2',
      'zoetrope_v2',
    ]
    if (currentTtsType && unsupportedList.includes(currentTtsType)) {
      setShowUnsupportedTtsNotice(true)
      return
    }

    try {
      const cameraState = babylonViewerRef.current?.getCameraState?.()
      if (cameraState) {
        localStorage.setItem('dlp_camera_state', JSON.stringify(cameraState))
      }
      if (selectedChat?.scene_name) {
        const idx = HDRI_SCENES.findIndex(
          scene => scene.name === selectedChat.scene_name,
        )
        localStorage.setItem('dlp_scene_index', idx === -1 ? '3' : String(idx))
      }
      const isInMainlandChinaOrHongKong = checkLocation()
      const enterWrongLocation = localStorage.getItem('dlp_enter_wrong_location')
      if (
        !isInMainlandChinaOrHongKong &&
        !enterWrongLocation &&
        isSensetimeTAServer
      ) {
        setLocationDialogOpen(true)
        return
      }

      try {
        dispatch(setIsChatStarting(true))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('chat-starting'))
        }
        await new Promise(r => setTimeout(r, 100))

        if (!selectedCharacterId) {
          await loadUserCharacters()
        }
        await new Promise(r => setTimeout(r, 800))
        const missingSecret = await fetchGetMissingSecret(
          user!.id,
          selectedCharacterId!,
        )
        if (
          missingSecret.llm_requirements.length > 0 ||
          missingSecret.tts_requirements.length > 0 ||
          missingSecret.asr_requirements.length > 0
        ) {
          const data = {
            llm_requirements: missingSecret.llm_requirements.sort(),
            tts_requirements: missingSecret.tts_requirements.sort(),
            asr_requirements: missingSecret.asr_requirements.sort(),
          }
          setMissingSecret(data)
          setMissingSecretDialogOpen(true)
          return
        }

        if (babylonViewerRef.current?.takeScreenshot) {
          const screenshotData = await captureScreenshot()
          const sessionId = `chat_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`
          try {
            await saveScreenshotToStorage(screenshotData, sessionId)
            localStorage.setItem('dlp_current_session_id', sessionId)
          } catch (screenshotError) {
            console.error(
              'Failed to save screenshot, continuing without it:',
              screenshotError,
            )
            localStorage.setItem('dlp_current_session_id', sessionId)
          }
        }
        const url = `/babylon?scene=${selectedScene}${
          selectedCharacterId ? `&character_id=${selectedCharacterId}` : ''
        }`
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch (error) {
        console.error('Screenshot failed:', error)
        const url = `/babylon?scene=${selectedScene}${
          selectedCharacterId ? `&character_id=${selectedCharacterId}` : ''
        }`
        window.open(url, '_blank', 'noopener,noreferrer')
      } finally {
        dispatch(setIsChatStarting(false))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('chat-screenshot-done'))
        }
      }
    } catch (error) {
      console.error('Failed to open new tab: ', error)
      const fallbackUrl = `/babylon?scene=${selectedScene}`
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
    }
  }, [
    isCharacterLoading,
    isSceneLoading,
    currentTtsType,
    chatAvailable,
    selectedChat,
    isSensetimeTAServer,
    dispatch,
    selectedCharacterId,
    selectedScene,
    loadUserCharacters,
    user,
  ])
  useEffect(() => {
    // Listen for route changes and reset chat state when returning to homepage
    const handleRouteChange = () => {
      if (window.location.pathname === '/') {
        dispatch(setIsChatStarting(false))
        setUiFadeOut(false)
      }
    }

    // Check current path on page load
    handleRouteChange()

    // Listen for browser back/forward events
    window.addEventListener('popstate', handleRouteChange)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [dispatch])
  /**
   * Chat action button.
   *
   * Renders the primary CTA to start a conversation, disabled when prerequisites
   * are not met.
   *
   * @returns JSX.Element | null The button or null when hidden on mobile during startup.
   */
  const ChatButton = useCallback(() => {
    if (isChatStarting) {
      return null
    }
    if (isMobile && isLogin && !isNativeApp()) {
      return null
    }
    if (shouldHideWebAuthChrome() && !isNativeApp()) {
      return null
    }
    return (
      <div className="button-group-container">
        <button
          className="start-conversation-btn"
          onClick={handleStartConversation}
          disabled={
            !chatAvailable || isCharacterLoading || isSceneLoading || !isLogin
          }
          style={{
            opacity:
              chatAvailable && !isCharacterLoading && !isSceneLoading ? 1 : 0.6,
            cursor:
              chatAvailable && !isCharacterLoading && !isSceneLoading
                ? 'pointer'
                : 'not-allowed',
            borderRadius: '30px 0 0 30px', // Only round the left side
          }}
        >
          {chatAvailable && !isCharacterLoading && !isSceneLoading && isLogin
            ? t('chat.chat')
            : t('chat.loginToChat')}
        </button>
      </div>
    )
  }, [
    isChatStarting,
    isMobile,
    isLogin,
    handleStartConversation,
    chatAvailable,
    isCharacterLoading,
    isSceneLoading,
    t,
  ])
  /**
   * Missing secret requirements renderer.
   *
   * Displays lists of required secrets for LLM/TTS/ASR providers if any are missing.
   *
   * @returns JSX.Element The message content for the dialog.
   */
  const MissingSecretMessage = () => {
    return (
      <>
        {missingSecret.llm_requirements.length > 0 && (
          <div>
            {t('missingSecret.message_llm')}
            <div
              style={{
                padding: '20px 10px 20px 30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              {missingSecret.llm_requirements.map(requirement => (
                <div key={requirement}>
                  <span style={{ fontWeight: 'bold' }}>•</span> {requirement}
                </div>
              ))}
            </div>
          </div>
        )}
        {missingSecret.tts_requirements.length > 0 && (
          <div>
            {t('missingSecret.message_tts')}
            <div
              style={{
                padding: '20px 10px 20px 30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              {missingSecret.tts_requirements.map(requirement => (
                <div key={requirement}>
                  <span style={{ fontWeight: 'bold' }}>•</span> {requirement}
                </div>
              ))}
            </div>
          </div>
        )}

        {missingSecret.asr_requirements.length > 0 && (
          <div>
            {t('missingSecret.message_asr')}
            <div
              style={{
                padding: '20px 10px 20px 30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              {missingSecret.asr_requirements.map(requirement => (
                <div key={requirement}>
                  <span style={{ fontWeight: 'bold' }}>•</span> {requirement}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {/* Loading Screen */}
      <LoadingScreen
        isLoading={isGlobalLoading}
        message={loadingText || t('loading.message')}
        hint={loadingHint}
        onComplete={() => setIsLoading(false)}
        progress={loadingProgress}
      />
      {/* Fullscreen Babylon.js Background */}
      <BabylonViewer
        ref={babylonViewerRef}
        width="100vw"
        height="100vh"
        className="fullscreen-babylon-viewer"
        sceneName={sceneName}
        selectedCharacter={selectedModelIndex}
        characterChangeKey={characterChangeKey}
        onCharacterLoaded={handleCharacterLoaded}
        onSceneLoaded={handleSceneLoaded}
      />
      {/* Navigation */}
      <Navigation />

      {/* Main Content Container */}
      <div className={`main-content-container${uiFadeOut ? ' fade-out' : ''}`}>
        {/* Only show UI when not isChatStarting */}
        {!isChatStarting && (
          <>
            {/* Hero Section */}
            <div className="hero-section">
              <div className="hero-content"> </div>
            </div>
          </>
        )}

        {/* Hidden DOM for billboard screenshot */}
        <div
          id="dlp-billboard-capture"
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            pointerEvents: 'none',
          }}
        >
          <div className="hero-content"> </div>
        </div>
      </div>
      {!isChatStarting && isLogin && !isNativeApp() && (
        <>
          <LeftSidebar />
          <ConfigSidebar
            handleStartConversation={handleStartConversation}
            chatAvailable={chatAvailable}
            isCharacterLoading={isCharacterLoading}
            isSceneLoading={isSceneLoading}
            onSceneChange={handleSceneChange}
          />
        </>
      )}
      {!isChatStarting && isLogin && isNativeApp() && (
        <NativeScenePicker
          onSceneChange={handleSceneChange}
          chatAvailable={chatAvailable}
          isCharacterLoading={isCharacterLoading}
          isSceneLoading={isSceneLoading}
        />
      )}
      {/* Unsupported TTS Notice */}
      <MobileNoticePanel
        isOpen={showUnsupportedTtsNotice}
        onClose={() => setShowUnsupportedTtsNotice(false)}
        title="TTS Unsupported"
        message={`The selected TTS (“${
          currentTtsType ?? ''
        }”) is not available on the current server. Please switch to a different TTS in Character Settings.`}
        autoDismissDuration={null}
      />
      {/* Location Dialog */}
      <ConfirmDialog
        isOpen={locationDialogOpen}
        onCancel={() => {
          window.open(link.href, '_blank')
        }}
        onClose={() => {
          setLocationDialogOpen(false)
        }}
        cancelText={
          <a
            key={link.className}
            href={link.href}
            target="_blank"
            title={link.title}
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',

              color: '#ffffff',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>{link.label}</span>
          </a>
        }
        onConfirm={() => {
          setLocationDialogOpen(false)
          localStorage.setItem('dlp_enter_wrong_location', 'true')
          handleStartConversation()
        }}
        title={t('networkLatencyWarning.title')}
        message={t('networkLatencyWarning.message')}
        confirmText={t('networkLatencyWarning.confirmText')}
      />
      {/* Missing Secret Dialog */}
      <ConfirmDialog
        isOpen={missingSecretDialogOpen}
        onClose={() => {
          setMissingSecretDialogOpen(false)
        }}
        showCloseButton={false}
        showCancelButton={false}
        message={<MissingSecretMessage />}
        confirmText={t('missingSecret.confirmText')}
        onConfirm={() => {
          setMissingSecretDialogOpen(false)
        }}
      />
      {/* Footer */}
      {!isChatStarting && !isLogin && !shouldHideWebAuthChrome() && (
        <footer className={uiFadeOut ? 'fade-out' : ''}>
          <Footer />
        </footer>
      )}

      <ChatButton />
    </>
  )
}

'use client'

import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './MobileConversationHUD.module.css'
import useBabylonJS from '@/hooks/useBabylonJS'
import { isNativeApp } from '@/utils/nativeBridge'
import { AudioRecordState } from '@/data_structures/audioStreamState'
import {
  ConditionedMessage,
  Conditions,
  StateMachine,
  States,
} from '@/library/babylonjs/runtime/fsm'
import { setIsChatStarting } from '@/features/chat/chatStore'
import type { RootState } from '@/store'

type HudPhase =
  | 'booting'
  | 'ready'
  | 'pressing'
  | 'recording'
  | 'thinking'
  | 'speaking'
  | 'error'

type HudDescriptor = {
  phase: HudPhase
  statusLabel: string
  eyebrow: string
  title: string
  hint: string
  accent: string
}

function getDescriptor(args: {
  hasStateMachine: boolean
  stateValue: States | null
  audioRecordState: AudioRecordState
  isUserStreaming: boolean
  isPressing: boolean
}): HudDescriptor {
  const {
    hasStateMachine,
    stateValue,
    audioRecordState,
    isUserStreaming,
    isPressing,
  } = args

  if (
    audioRecordState === AudioRecordState.PERMISSION_DENIED ||
    audioRecordState === AudioRecordState.MICROPHONE_NOT_FOUND ||
    audioRecordState === AudioRecordState.UNKNOWN_ERROR
  ) {
    return {
      phase: 'error',
      statusLabel: 'MIC OFF',
      eyebrow: 'Voice Input',
      title: '麦克风暂不可用',
      hint: '请检查权限或录音设备，然后再试一次。',
      accent: '#ff8d8d',
    }
  }

  if (!hasStateMachine || stateValue === null) {
    return {
      phase: 'booting',
      statusLabel: 'CONNECT',
      eyebrow: 'Conversation',
      title: '正在进入对话',
      hint: '场景、语音和角色正在准备，请稍等。',
      accent: '#8fd1ff',
    }
  }

  if (isUserStreaming || stateValue === States.WAITING_FOR_USER_STOP_RECORDING) {
    return {
      phase: 'recording',
      statusLabel: 'REC',
      eyebrow: 'Listening',
      title: '正在聆听你说话',
      hint: '松开后发送，本轮内容会立即开始处理。',
      accent: '#ff8da1',
    }
  }

  if (isPressing) {
    return {
      phase: 'pressing',
      statusLabel: 'REC',
      eyebrow: 'Listening',
      title: '正在开始聆听',
      hint: '继续说，松开后发送，本轮内容会立即开始处理。',
      accent: '#ff8da1',
    }
  }

  switch (stateValue) {
    case States.INIT:
    case States.WAITING_FOR_FRONTEND_READY:
    case States.SPAWN_CHARACTER:
    case States.SPAWN_ENVIRONMENT:
    case States.CHECK_AND_UPDATE_ASSETS:
    case States.WAITING_FOR_ALGORITHM_READY_ON_START:
    case States.ALGORITHM_NOT_READY_ON_START:
    case States.WAITING_FOR_USER_START_GAME:
      return {
        phase: 'booting',
        statusLabel: 'CONNECT',
        eyebrow: 'Conversation',
        title: '正在进入对话',
        hint: '第一次进入会稍慢一点，准备完成后就可以直接开聊。',
        accent: '#8fd1ff',
      }
    case States.WAITING_FOR_ACTOR_RESPOND_GENERATION_FINISHED:
    case States.WAITING_FOR_ACTOR_DIRECT_GENERATION_FINISHED:
    case States.WAITING_FOR_STREAMED_ANIMATION_INTERRUPTED:
    case States.WAITING_FOR_LOCAL_ANIMATION_INTERRUPTED:
      return {
        phase: 'thinking',
        statusLabel: 'THINKING',
        eyebrow: 'Thinking',
        title: '她正在理解你的话',
        hint: '稍等一下，回复内容和动作正在生成。',
        accent: '#ffd47a',
      }
    case States.ACTOR_ANIMATION_STREAMING:
    case States.WAITING_FOR_ACTOR_ANIMATION_FINISHED:
    case States.WAITING_FOR_ACTOR_APOLOGIZE_FINISHED:
    case States.WAITING_FOR_ACTOR_LEAVING_FINISHED:
      return {
        phase: 'speaking',
        statusLabel: 'LIVE',
        eyebrow: 'Responding',
        title: '她正在回应你',
        hint: '可以点一下主按钮打断，直接说下一句。',
        accent: '#9fe8ac',
      }
    case States.ALGORITHM_GENERATION_FAILED:
    case States.EXIT:
      return {
        phase: 'error',
        statusLabel: 'ERROR',
        eyebrow: 'Conversation',
        title: '这轮对话没有顺利完成',
        hint: '你可以再试一次，不需要重新进入页面。',
        accent: '#ff8d8d',
      }
    case States.IDLE:
    default:
      return {
        phase: 'ready',
        statusLabel: 'READY',
        eyebrow: 'Ready',
        title: '按住说话，松开发送',
        hint: '现在可以直接开始对话了。',
        accent: '#8be39a',
      }
  }
}

export default function MobileConversationHUD() {
  const dispatch = useDispatch()
  const { globalState } = useBabylonJS()
  const selectedChat = useSelector((state: RootState) => state.chat.selectedChat)
  const [stateValue, setStateValue] = useState<States | null>(null)
  const [audioRecordState, setAudioRecordState] = useState<AudioRecordState>(
    AudioRecordState.NOT_RECORDING,
  )
  const [isUserStreaming, setIsUserStreaming] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [isPressing, setIsPressing] = useState(false)
  const actionButtonRef = useRef<HTMLButtonElement | null>(null)
  const hasStartedRecordingRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateMachineRef = useRef<StateMachine | null>(null)
  const activePointerIdRef = useRef<number | null>(null)

  const native = isNativeApp()
  const androidNative =
    native &&
    (typeof navigator === 'undefined'
      ? process.env.NEXT_PUBLIC_OFFLINE_WEBVIEW === '1'
      : /Android/i.test(navigator.userAgent))

  useEffect(() => {
    if (!native || !globalState) {
      return
    }

    let cancelled = false
    let unsubscribeStateMachine: (() => void) | null = null

    const attachStateMachine = () => {
      if (cancelled || !globalState.stateMachine) {
        return false
      }
      if (stateMachineRef.current === globalState.stateMachine) {
        return true
      }

      if (unsubscribeStateMachine) {
        unsubscribeStateMachine()
      }

      const stateMachine = globalState.stateMachine
      stateMachineRef.current = stateMachine
      setStateValue(stateMachine.stateValue)

      const onStateChanged = () => {
        setStateValue(stateMachine.stateValue)
      }

      stateMachine.onStateChangedObservable.add(onStateChanged)
      unsubscribeStateMachine = () => {
        stateMachine.onStateChangedObservable.removeCallback(onStateChanged)
      }
      return true
    }

    attachStateMachine()
    const pollId = window.setInterval(() => {
      if (attachStateMachine()) {
        window.clearInterval(pollId)
      }
    }, 250)

    const onAudioStateChanged = (next: AudioRecordState) => {
      setAudioRecordState(next)
    }
    const onUserStreamingChanged = (next: boolean) => {
      setIsUserStreaming(next)
    }
    const onMicLevelChanged = (next: number) => {
      setMicLevel(next)
    }

    setAudioRecordState(
      globalState.audioStreamState?.recordState ?? AudioRecordState.NOT_RECORDING,
    )
    setIsUserStreaming(globalState.isUserStreaming)
    setMicLevel(globalState.micLevel)

    globalState.onAudioStreamStateChangedObservable.add(onAudioStateChanged)
    globalState.onUserStreamingStateChangedObservable.add(onUserStreamingChanged)
    globalState.onMicLevelChangedObservable.add(onMicLevelChanged)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      if (unsubscribeStateMachine) {
        unsubscribeStateMachine()
      }
      globalState.onAudioStreamStateChangedObservable.removeCallback(
        onAudioStateChanged,
      )
      globalState.onUserStreamingStateChangedObservable.removeCallback(
        onUserStreamingChanged,
      )
      globalState.onMicLevelChangedObservable.removeCallback(onMicLevelChanged)
    }
  }, [globalState, native])

  useEffect(() => {
    if (!native) {
      return
    }
    if (
      stateValue !== null &&
      stateValue !== States.INIT &&
      stateValue !== States.WAITING_FOR_FRONTEND_READY
    ) {
      dispatch(setIsChatStarting(false))
    }
  }, [dispatch, native, stateValue])

  useEffect(() => {
    if (!native) {
      return
    }
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
      }
    }
  }, [native])

  useEffect(() => {
    if (!native) {
      return
    }

    const forceFinishHold = () => {
      clearHoldTimer()
      setIsPressing(false)
      if (hasStartedRecordingRef.current) {
        stateMachineRef.current?.putConditionedMessage(
          new ConditionedMessage(Conditions.USER_STOP_RECORDING, null),
        )
        hasStartedRecordingRef.current = false
      }
      const activePointerId = activePointerIdRef.current
      if (activePointerId !== null) {
        try {
          actionButtonRef.current?.releasePointerCapture(activePointerId)
        } catch {
          // Ignore capture release failures from partially-cancelled pointers.
        }
        activePointerIdRef.current = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        forceFinishHold()
      }
    }

    window.addEventListener('pointerup', forceFinishHold)
    window.addEventListener('pointercancel', forceFinishHold)
    window.addEventListener('mouseup', forceFinishHold)
    window.addEventListener('touchend', forceFinishHold)
    window.addEventListener('touchcancel', forceFinishHold)
    window.addEventListener('blur', forceFinishHold)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pointerup', forceFinishHold)
      window.removeEventListener('pointercancel', forceFinishHold)
      window.removeEventListener('mouseup', forceFinishHold)
      window.removeEventListener('touchend', forceFinishHold)
      window.removeEventListener('touchcancel', forceFinishHold)
      window.removeEventListener('blur', forceFinishHold)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [native])

  const descriptor = useMemo(
    () =>
      getDescriptor({
        hasStateMachine: !!stateMachineRef.current,
        stateValue,
        audioRecordState,
        isUserStreaming,
        isPressing,
      }),
    [audioRecordState, isPressing, isUserStreaming, stateValue],
  )

  const characterName = selectedChat?.character_name || '当前角色'

  const canInterrupt = descriptor.phase === 'speaking'
  const canHoldToTalk =
    descriptor.phase === 'ready' ||
    descriptor.phase === 'pressing' ||
    descriptor.phase === 'recording'

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const beginHold = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      !stateMachineRef.current ||
      !canHoldToTalk ||
      descriptor.phase === 'recording'
    ) {
      return
    }

    clearHoldTimer()
    hasStartedRecordingRef.current = false
    setIsPressing(true)
    if (event) {
      activePointerIdRef.current = event.pointerId
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Android WebView may fail to capture in edge cases; global listeners still backstop release.
      }
    }
    holdTimerRef.current = setTimeout(() => {
      stateMachineRef.current?.putConditionedMessage(
        new ConditionedMessage(Conditions.USER_START_RECORDING, null),
      )
      hasStartedRecordingRef.current = true
      holdTimerRef.current = null
    }, 180)
  }

  const finishHold = () => {
    clearHoldTimer()
    setIsPressing(false)
    if (hasStartedRecordingRef.current) {
      stateMachineRef.current?.putConditionedMessage(
        new ConditionedMessage(Conditions.USER_STOP_RECORDING, null),
      )
      hasStartedRecordingRef.current = false
    }
    const activePointerId = activePointerIdRef.current
    if (activePointerId !== null) {
      try {
        actionButtonRef.current?.releasePointerCapture(activePointerId)
      } catch {
        // Ignore release failures caused by cancelled or already-released pointers.
      }
      activePointerIdRef.current = null
    }
  }

  const handleActionPress = () => {
    if (canInterrupt) {
      stateMachineRef.current?.putConditionedMessage(
        new ConditionedMessage(Conditions.USER_INTERRUPT_ANIMATION, null),
      )
    }
  }

  if (!native) {
    return null
  }

  const buttonLabel =
    descriptor.phase === 'recording' || descriptor.phase === 'pressing'
      ? '松开'
      : canInterrupt
        ? '打断'
        : descriptor.phase === 'thinking' || descriptor.phase === 'booting'
          ? '等待中'
          : descriptor.phase === 'error'
            ? '重试'
            : '说话'

  const buttonGlyph =
    descriptor.phase === 'recording' || descriptor.phase === 'pressing'
      ? '●'
      : canInterrupt
        ? '×'
        : descriptor.phase === 'thinking'
          ? '…'
          : '🎤'

  const androidButtonLabel =
    descriptor.phase === 'recording' || descriptor.phase === 'pressing'
      ? '松开'
      : canInterrupt
        ? '打断'
        : descriptor.phase === 'thinking' || descriptor.phase === 'booting'
          ? '等待'
          : descriptor.phase === 'error'
            ? '异常'
            : '说话'

  const androidButtonGlyph =
    descriptor.phase === 'recording' || descriptor.phase === 'pressing'
      ? '●'
      : canInterrupt
        ? '×'
        : descriptor.phase === 'thinking' || descriptor.phase === 'booting'
          ? '··'
          : descriptor.phase === 'error'
            ? '!'
            : '◉'

  const buttonClassName = [
    styles.actionButton,
    (descriptor.phase === 'recording' || descriptor.phase === 'pressing') &&
      styles.actionButtonRecording,
    descriptor.phase === 'ready' && styles.actionButtonReady,
    canInterrupt && styles.actionButtonInterrupt,
    isPressing && styles.actionButtonPressed,
    (descriptor.phase === 'booting' || descriptor.phase === 'thinking') &&
      styles.actionButtonDisabled,
  ]
    .filter(Boolean)
    .join(' ')

  const androidButtonClassName = [
    styles.floatingActionButton,
    (descriptor.phase === 'recording' || descriptor.phase === 'pressing') &&
      styles.floatingActionButtonRecording,
    descriptor.phase === 'ready' && styles.floatingActionButtonReady,
    canInterrupt && styles.floatingActionButtonInterrupt,
    isPressing && styles.floatingActionButtonPressed,
    (descriptor.phase === 'booting' ||
      descriptor.phase === 'thinking' ||
      descriptor.phase === 'error') &&
      styles.floatingActionButtonDisabled,
  ]
    .filter(Boolean)
    .join(' ')

  const statusAnimated =
    descriptor.phase === 'booting' ||
    descriptor.phase === 'thinking' ||
    descriptor.phase === 'speaking'
  const recordingMicLevel =
    descriptor.phase === 'recording' || descriptor.phase === 'pressing'
      ? micLevel
      : 0

  const buttonDisabled = !canInterrupt && !canHoldToTalk

  return (
    <div
      className={styles.hudRoot}
      style={{
        ['--hud-accent' as string]: descriptor.accent,
        ['--hud-mic-level' as string]: recordingMicLevel.toFixed(3),
      }}
    >
      {androidNative ? (
        <>
          <div className={styles.androidTopBar}>
            <div className={styles.androidStatusLine}>
              <div
                className={`${styles.statusGlow} ${
                  statusAnimated ? styles.statusGlowActive : ''
                } ${
                  descriptor.phase === 'recording' || descriptor.phase === 'pressing'
                    ? styles.statusGlowLive
                    : ''
                }`}
              />
              <div className={styles.androidStatusLabel}>
                {descriptor.statusLabel}
              </div>
            </div>
            <div className={styles.androidCharacterName}>{characterName}</div>
          </div>

          <div className={styles.androidActionDock}>
            <button
              ref={actionButtonRef}
              type="button"
              className={androidButtonClassName}
              disabled={buttonDisabled}
              onPointerDown={canHoldToTalk ? beginHold : undefined}
              onPointerUp={canHoldToTalk ? finishHold : undefined}
              onPointerCancel={canHoldToTalk ? finishHold : undefined}
              onPointerLeave={canHoldToTalk ? finishHold : undefined}
              onContextMenu={event => event.preventDefault()}
              onClick={handleActionPress}
              aria-label={androidButtonLabel}
            >
              <span className={styles.androidButtonGlyph}>{androidButtonGlyph}</span>
            </button>
            <div className={styles.androidActionLabel}>{androidButtonLabel}</div>
          </div>
        </>
      ) : (
        <>
          <div className={styles.topBar}>
            <div className={styles.statusCard}>
              <div className={styles.statusGlow} />
              <div className={styles.statusText}>
                <div className={styles.eyebrow}>{descriptor.eyebrow}</div>
                <div className={styles.headline}>{characterName}</div>
                <div className={styles.subline}>{descriptor.title}</div>
              </div>
            </div>
          </div>

          <div className={styles.bottomDock}>
            <div className={styles.actionPanel}>
              <div className={styles.actionTitle}>{descriptor.title}</div>
              <div className={styles.actionHint}>{descriptor.hint}</div>
              <button
                ref={actionButtonRef}
                type="button"
                className={buttonClassName}
                onPointerDown={canHoldToTalk ? beginHold : undefined}
                onPointerUp={canHoldToTalk ? finishHold : undefined}
                onPointerCancel={canHoldToTalk ? finishHold : undefined}
                onPointerLeave={canHoldToTalk ? finishHold : undefined}
                onContextMenu={event => event.preventDefault()}
                onClick={handleActionPress}
              >
                <span className={styles.buttonContent}>
                  <span className={styles.buttonGlyph}>{buttonGlyph}</span>
                  <span className={styles.buttonLabel}>{buttonLabel}</span>
                </span>
              </button>
              <div className={styles.supportingRow}>
                <span
                  className={`${styles.pulseDot} ${
                    descriptor.phase === 'recording' ||
                    descriptor.phase === 'pressing' ||
                    descriptor.phase === 'thinking' ||
                    descriptor.phase === 'speaking'
                      ? styles.pulseActive
                      : ''
                  }`}
                />
                <span>
                  {canInterrupt
                    ? '她说话时也可以立刻打断'
                    : '主操作保持在拇指最容易触到的位置'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

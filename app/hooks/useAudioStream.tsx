'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  AudioStreamState,
  AudioRecordState,
  StreamedAudioEventPayloads,
  StreamedAudioEvents,
} from '@/data_structures/audioStreamState'
import { EventEmitter } from './eventEmitter'
import { errorBus } from '../utils/errorBus'
import i18n from '@/i18n/config'
import { resolvePublicUrl } from '@/utils/publicUrl'

type PCMChunkMeta = {
  level: number
}

type WorkletAudioMessage = {
  buffer: ArrayBuffer
  level?: number
}

/**
 * PCMStreamHook
 *
 * A type describing a React hook that captures microphone audio, streams
 * 16-bit PCM frames via a callback, and returns recording controls and state.
 */
type PCMStreamHook = (
  onPCMData: (pcm: Int16Array, meta: PCMChunkMeta) => void,
) => AudioStreamState

/**
 * useAudioStream
 *
 * React hook to record microphone audio, process it with an AudioWorklet,
 * and deliver 16 kHz 16-bit PCM frames to a consumer callback.
 * It also exposes helpers to start/stop recording and to observe record state.
 *
 * @param onPCMData Callback invoked for each emitted PCM frame (Int16Array).
 *
 * @returns AudioStreamState with current recordState, control methods
 * (startRecord, stopRecord, checkDevice) and subscription helpers
 * (onRecordStateChange, offRecordStateChange).
 */
export const useAudioStream: PCMStreamHook = onPCMData => {
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const [recordState, setRecordState] = useState<AudioRecordState>(
    AudioRecordState.NOT_RECORDING,
  )
  const [micLevel, setMicLevel] = useState(0)
  const micLevelRef = useRef(0)
  const lastMicLevelEmitAtRef = useRef(0)

  const eventEmitter = useRef(
    new EventEmitter<StreamedAudioEvents, StreamedAudioEventPayloads>(),
  ).current

  const updateMicLevel = useCallback(
    (rawLevel: number) => {
      const normalizedLevel =
        rawLevel > 0 ? Math.min(1, Math.sqrt(Math.min(1, rawLevel * 18))) : 0
      const previousLevel = micLevelRef.current
      const nextLevel =
        normalizedLevel > previousLevel
          ? previousLevel * 0.45 + normalizedLevel * 0.55
          : previousLevel * 0.82 + normalizedLevel * 0.18
      const clampedLevel = nextLevel < 0.015 ? 0 : Math.min(1, nextLevel)

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (
        now - lastMicLevelEmitAtRef.current >= 48 ||
        clampedLevel === 0 ||
        Math.abs(clampedLevel - previousLevel) >= 0.08
      ) {
        lastMicLevelEmitAtRef.current = now
        setMicLevel(clampedLevel)
        eventEmitter.emit(StreamedAudioEvents.MIC_LEVEL, clampedLevel)
      }
      micLevelRef.current = clampedLevel
    },
    [eventEmitter],
  )

  const resetMicLevel = useCallback(() => {
    micLevelRef.current = 0
    lastMicLevelEmitAtRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    setMicLevel(0)
    eventEmitter.emit(StreamedAudioEvents.MIC_LEVEL, 0)
  }, [eventEmitter])

  /**
   * Check microphone device availability and permission state.
   * Requests getUserMedia with audio=true and immediately stops the stream
   * to infer the effective permission/device status without keeping it open.
   *
   * @returns Promise<AudioRecordState> effective state inferred from the attempt.
   */
  const checkDevice = useCallback(async (): Promise<AudioRecordState> => {
    try {
      console.log('[AudioStream] checking microphone availability')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Immediately stop the stream since we only needed to check permissions
      stream.getTracks().forEach(track => track.stop())
      console.log('[AudioStream] microphone is available')
      return AudioRecordState.NOT_RECORDING
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? 'UnknownError'
      console.error(`[AudioStream] checkDevice failed: ${name}`)
      if (name === 'NotAllowedError') {
        return AudioRecordState.PERMISSION_DENIED
      } else if (name === 'NotFoundError') {
        return AudioRecordState.MICROPHONE_NOT_FOUND
      } else {
        return AudioRecordState.UNKNOWN_ERROR
      }
    }
  }, [])

  /**
   * Start capturing microphone audio and emit PCM frames via onPCMData.
   * Sets up an AudioContext at 16 kHz and an AudioWorklet "pcm-processor".
   * Emits record state changes through the internal event emitter.
   * No-op if already recording.
   *
   * @returns Promise<void>
   */
  const startRecord = useCallback(async () => {
    if (recordState === AudioRecordState.RECORDING) return

    try {
      console.log('[AudioStream] startRecord requested')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new AudioContext({
        sampleRate: 16000,
      })
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      const workletUrl = resolvePublicUrl('/StreamedAudioProcessor.js')
      console.log(`[AudioStream] loading worklet: ${workletUrl}`)
      await audioContext.audioWorklet.addModule(workletUrl)

      const source = audioContext.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor')
      workletNode.port.onmessage = (event: MessageEvent<WorkletAudioMessage>) => {
        const payload = event.data
        if (!payload?.buffer) {
          return
        }
        const rawLevel = payload.level ?? 0
        updateMicLevel(rawLevel)
        const newBuffer = new Int16Array(payload.buffer)
        onPCMData(newBuffer, { level: rawLevel })
      }

      source.connect(workletNode).connect(audioContext.destination)

      audioContextRef.current = audioContext
      mediaStreamRef.current = stream
      workletNodeRef.current = workletNode

      resetMicLevel()
      setRecordState(AudioRecordState.RECORDING)
      eventEmitter.emit(StreamedAudioEvents.RECORD_STATE, AudioRecordState.RECORDING)
      console.log('[AudioStream] recording started')
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string }
      const name = errorObj.name ?? 'UnknownError'
      const message = errorObj.message ?? 'Unknown error'
      console.error(`[AudioStream] startRecord failed: ${name}: ${message}`)
      if (name === 'NotAllowedError') {
        setRecordState(AudioRecordState.PERMISSION_DENIED)
        eventEmitter.emit(
          StreamedAudioEvents.RECORD_STATE,
          AudioRecordState.PERMISSION_DENIED,
        )
        errorBus.emit('error', {
          message: i18n.t('audio.microphoneState.permissionDenied', {
            ns: 'client',
          }),
          severity: 'error',
          durationMs: 6000,
        })
      } else if (name === 'NotFoundError') {
        setRecordState(AudioRecordState.MICROPHONE_NOT_FOUND)
        eventEmitter.emit(
          StreamedAudioEvents.RECORD_STATE,
          AudioRecordState.MICROPHONE_NOT_FOUND,
        )
        errorBus.emit('error', {
          message: i18n.t('audio.microphoneState.microphoneNotFound', {
            ns: 'client',
          }),
          severity: 'error',
          durationMs: 6000,
        })
      } else {
        setRecordState(AudioRecordState.UNKNOWN_ERROR)
        eventEmitter.emit(
          StreamedAudioEvents.RECORD_STATE,
          AudioRecordState.UNKNOWN_ERROR,
        )
        errorBus.emit('error', {
          message:
            i18n.t('audio.microphoneState.unknownError', { ns: 'client' }) +
            ': ' +
            message,
          severity: 'error',
          durationMs: 6000,
        })
      }
    }
  }, [eventEmitter, onPCMData, recordState, resetMicLevel, updateMicLevel])

  /**
   * Stop capturing microphone audio and release resources.
   * Stops media tracks, disconnects the worklet node, and closes the AudioContext.
   * Emits a NOT_RECORDING state at the end.
   *
   * @returns Promise<void>
   */
  const stopRecord = useCallback(async () => {
    console.log('[AudioStream] stopRecord requested')
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          await audioContextRef.current.close()
        }
      } catch (err) {
        console.warn(
          i18n.t('audio.closeAudioContextFailed', { ns: 'client' }) + ': ' + err,
        )
      }
      audioContextRef.current = null
    }

    resetMicLevel()
    setRecordState(AudioRecordState.NOT_RECORDING)
    eventEmitter.emit(
      StreamedAudioEvents.RECORD_STATE,
      AudioRecordState.NOT_RECORDING,
    )
    console.log('[AudioStream] recording stopped')
  }, [eventEmitter, resetMicLevel])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecord()
    }
  }, [stopRecord])

  const onRecordStateChange = useCallback(
    (cb: (state: AudioRecordState) => void) =>
      eventEmitter.on(StreamedAudioEvents.RECORD_STATE, cb),
    [eventEmitter],
  )
  const offRecordStateChange = useCallback(
    (cb: (state: AudioRecordState) => void) =>
      eventEmitter.off(StreamedAudioEvents.RECORD_STATE, cb),
    [eventEmitter],
  )
  const onMicLevelChange = useCallback(
    (cb: (level: number) => void) =>
      eventEmitter.on(StreamedAudioEvents.MIC_LEVEL, cb),
    [eventEmitter],
  )
  const offMicLevelChange = useCallback(
    (cb: (level: number) => void) =>
      eventEmitter.off(StreamedAudioEvents.MIC_LEVEL, cb),
    [eventEmitter],
  )

  return {
    recordState: recordState,
    micLevel: micLevel,
    startRecord: startRecord,
    stopRecord: stopRecord,
    checkDevice: checkDevice,
    onRecordStateChange: onRecordStateChange,
    offRecordStateChange: offRecordStateChange,
    onMicLevelChange: onMicLevelChange,
    offMicLevelChange: offMicLevelChange,
  }
}

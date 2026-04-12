'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Scene,
  Engine,
  HavokPlugin,
  Vector3,
  UtilityLayerRenderer,
} from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import onRender from '@/library/babylonjs/onRender'
import onSceneReady from '@/library/babylonjs/onSceneReady'
import { BabylonJSContextType } from '@/types/babylonjs'
import { GlobalState } from '@/library/babylonjs/core'
import useWebSocket from '@/hooks/useWebSocket'
import { resolvePublicUrl } from '@/utils/publicUrl'
import { useAudioStream } from '@/hooks/useAudioStream'
import { AudioRecordState } from '@/data_structures/audioStreamState'
import { WebSocketConnectionState } from '@/data_structures/webSocketState'
import * as orchestrator_v4 from '@/library/babylonjs/runtime/io/orchestrator_v4_pb'
import { uint8Array2ArrayBuffer } from '@/library/babylonjs/utils/array'
import {
  Conditions,
  ConditionedMessage,
} from '@/library/babylonjs/runtime/fsm/conditions'

/**
 * React context carrying BabylonJS canvas ref and global state.
 *
 * Exposes `canvas` (HTMLCanvasElement ref) and `globalState` for consumers
 * to interact with the Babylon scene and shared runtime data.
 */
const BabylonJSContext = React.createContext<BabylonJSContextType | null>(null)

/**
 * BabylonJSProvider
 *
 * Initializes and manages a BabylonJS engine/scene lifecycle and related runtime states,
 * providing them via React context to descendant components.
 *
 * @param children React.ReactNode React children to render inside the provider
 * @param characterId string | null Optional character ID used to configure scene content
 *
 * @returns JSX.Element Provider element exposing BabylonJS context values
 */
function BabylonJSProvider({
  children,
  characterId,
}: {
  children: React.ReactNode
  characterId?: string | null
}) {
  const canvas = useRef(null)
  const [globalState, setGlobalState] = useState<GlobalState>()
  const webSocketState = useWebSocket()
  const [isSceneInitialized, setIsSceneInitialized] = useState(false)

  // Add PCM queue to store audio data when websocket is not ready
  type QueuedPCMChunk = {
    buffer: ArrayBuffer
    durationSeconds: number
  }
  const pcmQueue = useRef<QueuedPCMChunk[]>([])
  const isFlushingQueue = useRef(false)
  const currentFlushPromise = useRef<Promise<void> | null>(null)
  const isUserStreamingRef = useRef<boolean>(false)
  /**
   * Pre-stream buffer for native PCM chunks that arrive while isUserStreaming
   * is still false (WebSocket still connecting).  Flushed into sendOrQueuePCM
   * the moment streaming starts so no audio from the beginning of the utterance
   * is lost.
   */
  const preStreamPcmBuffer = useRef<QueuedPCMChunk[]>([])
  const havokWasmBlobUrlRef = useRef<string | null>(null)
  const recentPcmBufferRef = useRef<
    Array<{ buffer: ArrayBuffer; level: number; durationSeconds: number }>
  >([])
  const currentUtteranceStatsRef = useRef({
    chunkCount: 0,
    prebufferedChunkCount: 0,
    totalLevel: 0,
    maxLevel: 0,
  })
  const isEmbeddedAndroidAssetWebView =
    typeof window !== 'undefined' &&
    window.location.protocol === 'file:' &&
    window.location.pathname.startsWith('/android_asset/web/') &&
    Boolean(
      (
        window as Window & {
          __DLP3D_EMBEDDED_IN_RN__?: boolean
        }
      ).__DLP3D_EMBEDDED_IN_RN__,
    )
  const useHavokPhysics =
    typeof window !== 'undefined' &&
    (window.location.protocol !== 'file:' || isEmbeddedAndroidAssetWebView)
  // Retain a modest rolling window of PCM so we can preserve the start of speech
  // without flooding realtime backends with a large burst on connect.
  const maxRecentPcmChunks = 128

  const createHavokModuleConfig = async () => {
    if (!isEmbeddedAndroidAssetWebView) {
      return undefined
    }

    if (!havokWasmBlobUrlRef.current) {
      const wasmUrl = resolvePublicUrl('/scripts/HavokPhysics.wasm')
      const wasmBlob = await new Promise<Blob>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('GET', wasmUrl, true)
        request.responseType = 'blob'
        request.onload = () => {
          if (
            request.status === 0 ||
            (request.status >= 200 && request.status < 300)
          ) {
            resolve(request.response)
            return
          }
          reject(
            new Error(
              `Failed to load Havok wasm via XHR: ${request.status} ${request.statusText}`,
            ),
          )
        }
        request.onerror = () => {
          reject(new Error('Failed to load Havok wasm via XHR'))
        }
        request.send()
      })
      havokWasmBlobUrlRef.current = URL.createObjectURL(wasmBlob)
    }

    return {
      locateFile: (path: string) =>
        path.endsWith('.wasm') && havokWasmBlobUrlRef.current
          ? havokWasmBlobUrlRef.current
          : path,
    }
  }

  const appendRecentPcmBuffer = (
    buffer: ArrayBuffer,
    level: number,
    durationSeconds: number,
  ) => {
    recentPcmBufferRef.current.push({ buffer, level, durationSeconds })
    if (recentPcmBufferRef.current.length > maxRecentPcmChunks) {
      recentPcmBufferRef.current.splice(
        0,
        recentPcmBufferRef.current.length - maxRecentPcmChunks,
      )
    }
  }

  const resetUtteranceStats = (prebufferedChunkCount: number = 0) => {
    currentUtteranceStatsRef.current = {
      chunkCount: 0,
      prebufferedChunkCount,
      totalLevel: 0,
      maxLevel: 0,
    }
  }

  const trackUtteranceChunk = (level: number) => {
    const stats = currentUtteranceStatsRef.current
    stats.chunkCount += 1
    stats.totalLevel += level
    stats.maxLevel = Math.max(stats.maxLevel, level)
  }

  const logUtteranceStats = () => {
    const stats = currentUtteranceStatsRef.current
    if (stats.chunkCount === 0) {
      console.warn('[AudioStream] no PCM chunks were streamed during this utterance')
      return
    }
    const averageLevel = stats.totalLevel / stats.chunkCount
    console.log(
      `[AudioStream] streamed ${stats.chunkCount} pcm chunks (${stats.prebufferedChunkCount} prebuffered), avgLevel=${averageLevel.toFixed(3)}, maxLevel=${stats.maxLevel.toFixed(3)}`,
    )
  }

  // Initialize Babylon scene
  useEffect(() => {
    const { current: sceneCanvas } = canvas
    if (!sceneCanvas || isSceneInitialized) return undefined

    const babylonEngine = new Engine(sceneCanvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      disableWebGL2Support: false,
      antialias: true,
      powerPreference: 'high-performance',
      adaptToDeviceRatio: true,
    })

    const babylonScene = new Scene(babylonEngine)
    const babylonGlobalState = new GlobalState()
    babylonGlobalState.scene = babylonScene
    // Set WebSocket state before setting global state
    babylonGlobalState.webSocketState = webSocketState
    setGlobalState(babylonGlobalState)
    if (useHavokPhysics) {
      createHavokModuleConfig()
        .then(havokModuleConfig => HavokPhysics(havokModuleConfig))
        .then(havokInterface => {
          // Havok is now available
          const havokPlugin = new HavokPlugin(true, havokInterface)
          babylonScene.enablePhysics(new Vector3(0, -9.8 * 1, 0), havokPlugin)
        })
        .catch(error => {
          console.error('Failed to initialize Havok physics:', error)
        })
      babylonGlobalState.utilityLayer = new UtilityLayerRenderer(babylonScene)
    }

    // Scene ready logic executes only once
    babylonScene.onReadyObservable.addOnce(() => {
      setIsSceneInitialized(true)
      // onSceneReady(babylonGlobalState, characterId || undefined).catch(error => {
      //   console.error('Failed to initialize scene:', error)
      // })
      onSceneReady(babylonGlobalState).catch(error => {
        console.error('Failed to initialize scene:', error)
      })
    })

    babylonEngine.runRenderLoop(() => {
      onRender(babylonScene)
      babylonScene.render()
    })

    const resize = () => babylonScene.getEngine().resize()
    if (window) window.addEventListener('resize', resize)

    return () => {
      if (havokWasmBlobUrlRef.current) {
        URL.revokeObjectURL(havokWasmBlobUrlRef.current)
        havokWasmBlobUrlRef.current = null
      }
      babylonScene.getEngine().dispose()
      if (window) window.removeEventListener('resize', resize)
      setIsSceneInitialized(false)
    }
  }, [])

  // Update WebSocket state in globalState when it changes
  useEffect(() => {
    if (!globalState) return

    const onConnectionChange = (connectionState: WebSocketConnectionState) => {
      globalState.updateWebSocketConnectionState(connectionState)
    }

    const onDataBlock = (dataBlock: ArrayBuffer) => {
      globalState.updateStreamDataBlock(dataBlock)
    }

    webSocketState.onConnectionStateChanged(onConnectionChange)
    webSocketState.onDataBlock(onDataBlock)

    return () => {
      webSocketState.offConnectionStateChanged(onConnectionChange)
      webSocketState.offDataBlock(onDataBlock)
    }
  }, [globalState, webSocketState])

  /**
   * Send or enqueue PCM data depending on WebSocket readiness.
   * If the socket is open and there is no backlog, the buffer is sent immediately;
   * otherwise it is queued for later flushing.
   *
   * @param buffer ArrayBuffer PCM payload to send to the server
   */
  const sendOrQueuePCM = (chunk: QueuedPCMChunk) => {
    // Check actual websocket readyState in addition to connectionState
    const actualWsState = webSocketState.wsRef.current?.readyState
    const isActuallyConnected = actualWsState === WebSocket.OPEN

    if (
      isActuallyConnected &&
      pcmQueue.current.length === 0 &&
      !isFlushingQueue.current
    ) {
      // Websocket is ready and no queue backlog, send immediately
      webSocketState.sendMessage(chunk.buffer)
    } else {
      // Queue the data for later sending
      pcmQueue.current.push(chunk)
      // Try to flush if websocket is ready
      if (isActuallyConnected) {
        flushPCMQueue()
      }
    }
  }

  /**
   * Flush the queued PCM buffers when the WebSocket is ready.
   * Ensures single-flight flushing using an internal promise and flag.
   *
   * @returns Promise<void> Resolves when all queued buffers are sent
   * @throws {Error} Re-throws if sending any buffer fails during flushing
   */
  const flushPCMQueue = async (): Promise<void> => {
    if (isFlushingQueue.current) {
      // If already flushing, return the current promise
      return currentFlushPromise.current ?? Promise.resolve()
    }
    if (pcmQueue.current.length === 0) {
      return Promise.resolve()
    }

    isFlushingQueue.current = true
    currentFlushPromise.current = (async () => {
      try {
        while (pcmQueue.current.length > 0) {
          const queuedChunk = pcmQueue.current.shift()
          if (queuedChunk) {
            webSocketState.sendMessage(queuedChunk.buffer)
            if (queuedChunk.durationSeconds > 0) {
              await new Promise(resolve =>
                window.setTimeout(resolve, queuedChunk.durationSeconds * 1000),
              )
            }
          }
        }
      } catch (error) {
        console.error('Error flushing PCM queue:', error)
        throw error
      } finally {
        isFlushingQueue.current = false
        currentFlushPromise.current = null
      }
    })()
    return currentFlushPromise.current
  }

  const audioStreamState = useAudioStream((pcm, meta) => {
    const pb_request = new orchestrator_v4.orchestrator_v4.OrchestratorV4Request()
    pb_request.className = 'AudioChunkBody'
    pb_request.data = new Uint8Array(pcm.buffer)
    const data_bytes =
      orchestrator_v4.orchestrator_v4.OrchestratorV4Request.encode(
        pb_request,
      ).finish()
    const buffer = uint8Array2ArrayBuffer(data_bytes)

    appendRecentPcmBuffer(buffer, meta.level, meta.durationSeconds)
    if (isUserStreamingRef.current === false) {
      return
    }

    trackUtteranceChunk(meta.level)
    sendOrQueuePCM({
      buffer,
      durationSeconds: meta.durationSeconds,
    })
  })

  // Flush queue when websocket connects
  useEffect(() => {
    const actualWsState = webSocketState.wsRef.current?.readyState
    const isActuallyConnected = actualWsState === WebSocket.OPEN

    if (isActuallyConnected) {
      flushPCMQueue()
    }
  }, [webSocketState.connectionState])

  useEffect(() => {
    if (!globalState) {
      return
    }

    globalState.flushPCMQueue = flushPCMQueue
    globalState.getPCMQueueLength = () => pcmQueue.current.length
    isUserStreamingRef.current = globalState.isUserStreaming
  }, [globalState])

  useEffect(() => {
    if (!globalState) {
      return
    }

    // Listen to the observable for recording state changes
    const onUserStreamingStateChanged = (isStreaming: boolean) => {
      if (isStreaming) {
        pcmQueue.current = []
        resetUtteranceStats(0)
        // Flush any native PCM chunks that arrived while the WebSocket was
        // still connecting so the server receives the beginning of the utterance.
        if (preStreamPcmBuffer.current.length > 0) {
          for (const chunk of preStreamPcmBuffer.current) {
            sendOrQueuePCM(chunk)
          }
          preStreamPcmBuffer.current = []
        }
        void flushPCMQueue()
      } else {
        logUtteranceStats()
        // Clear pre-stream buffer on stop to avoid stale data across turns
        preStreamPcmBuffer.current = []
      }
      isUserStreamingRef.current = isStreaming
    }

    globalState.onUserStreamingStateChangedObservable.add(
      onUserStreamingStateChanged,
    )

    isUserStreamingRef.current = globalState.isUserStreaming

    return () => {
      globalState.onUserStreamingStateChangedObservable.removeCallback(
        onUserStreamingStateChanged,
      )
    }
  }, [globalState])

  useEffect(() => {
    if (!globalState) return

    globalState.audioStreamState = audioStreamState

    const onRecord = (state: AudioRecordState) => {
      globalState.updateAudioStreamState(state)
    }
    const onMicLevel = (level: number) => {
      globalState.updateMicLevel(level)
    }

    audioStreamState.onRecordStateChange(onRecord)
    audioStreamState.onMicLevelChange(onMicLevel)

    return () => {
      audioStreamState.offRecordStateChange(onRecord)
      audioStreamState.offMicLevelChange(onMicLevel)
    }
  }, [globalState, audioStreamState])

  // Native PCM input: when running inside RN app, receive PCM from native
  // AudioStreamModule instead of using WebView AudioWorklet. This avoids
  // AudioWorklet initialization delay and isUserStreaming gate dropping packets.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleNativePCM = (e: Event) => {
      const { pcm } = (e as CustomEvent).detail
      if (!pcm) return

      const pb_request = new orchestrator_v4.orchestrator_v4.OrchestratorV4Request()
      pb_request.className = 'AudioChunkBody'
      pb_request.data = pcm
      const data_bytes =
        orchestrator_v4.orchestrator_v4.OrchestratorV4Request.encode(
          pb_request,
        ).finish()
      const buffer = uint8Array2ArrayBuffer(data_bytes)
      const durationSeconds = pcm.length / (16000 * 1 * 2)
      const chunk = { buffer, durationSeconds }

      if (!isUserStreamingRef.current) {
        // WebSocket not ready yet — buffer the chunk for later flush
        preStreamPcmBuffer.current.push(chunk)
        return
      }

      sendOrQueuePCM(chunk)
    }

    const handleNativeVad = (e: Event) => {
      if (!globalState) return
      const { state } = (e as CustomEvent).detail
      if (state === 'silence') {
        globalState.stateMachine?.putConditionedMessage(
          new ConditionedMessage(Conditions.NATIVE_VAD_SILENCE, null),
        )
      }
    }

    const handleVoiceWake = (e: Event) => {
      if (!globalState) return
      globalState.stateMachine?.putConditionedMessage(
        new ConditionedMessage(
          Conditions.WAKE_WORD_DETECTED,
          (e as CustomEvent).detail,
        ),
      )
    }

    window.addEventListener('dlp3d:native-pcm', handleNativePCM)
    window.addEventListener('dlp3d:native-vad', handleNativeVad)
    window.addEventListener('dlp3d:voice-wake', handleVoiceWake)

    return () => {
      window.removeEventListener('dlp3d:native-pcm', handleNativePCM)
      window.removeEventListener('dlp3d:native-vad', handleNativeVad)
      window.removeEventListener('dlp3d:voice-wake', handleVoiceWake)
    }
  }, [globalState])

  return (
    <BabylonJSContext.Provider value={{ canvas, globalState }}>
      {children}
    </BabylonJSContext.Provider>
  )
}

export { BabylonJSProvider, BabylonJSContext }

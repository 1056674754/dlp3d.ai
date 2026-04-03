'use client'

type StartupDetails = Record<string, unknown>

export interface StartupEventPayload extends StartupDetails {
  stage: string
  elapsedMs: number
}

export const STARTUP_EVENT_NAME = 'dlp3d:startup-event'

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
  }
}

const sessionStart =
  typeof performance !== 'undefined' ? performance.now() : Date.now()

function roundMs(value: number): number {
  return Math.round(value * 10) / 10
}

function currentMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function emitStartupEvent(payload: StartupEventPayload): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<StartupEventPayload>(STARTUP_EVENT_NAME, {
      detail: payload,
    }),
  )
}

export function logStartupEvent(stage: string, details?: StartupDetails): void {
  const payload: StartupEventPayload = {
    stage,
    elapsedMs: roundMs(currentMs() - sessionStart),
    ...(details ?? {}),
  }

  console.warn(`[startup:web] ${JSON.stringify(payload)}`)
  emitStartupEvent(payload)

  if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'startup:metric',
          payload,
        }),
      )
    } catch {
      // Ignore relay failures in browser mode.
    }
  }
}

export function createStartupSpan(stage: string, details?: StartupDetails) {
  const startedAt = currentMs()
  logStartupEvent(`${stage}:start`, details)
  return (extra?: StartupDetails): void => {
    logStartupEvent(`${stage}:end`, {
      durationMs: roundMs(currentMs() - startedAt),
      ...(extra ?? {}),
    })
  }
}

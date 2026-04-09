import ky from 'ky'
import type { KyInstance, KyRequest, NormalizedOptions } from 'ky'
import { getEnv } from '@/utils/env'

/**
 * Base configuration options for HTTP requests.
 *
 * Contains common settings including timeout, headers, and response hooks.
 */
const baseOptions = {
  timeout: 180000,
  headers: {
    'Content-Type': 'application/json',
  },
  hooks: {
    afterResponse: [
      /**
       * Response hook that processes successful responses.
       *
       * @param request The original request object.
       * @param options The normalized request options.
       * @param response The response object to process.
       * @returns A new Response object with processed JSON data or the original response.
       */
      async (request: KyRequest, options: NormalizedOptions, response: Response) => {
        if (response.ok) {
          try {
            const text = await response.text()
            const result = text.trim() ? JSON.parse(text) : null
            return new Response(
              result ? JSON.stringify(result) : JSON.stringify(null),
            )
          } catch {
            return new Response(JSON.stringify(null))
          }
        }

        return response
      },
    ],
  },
}

/**
 * Resolve a full prefixUrl at call time (not module-init time), handling
 * the file:// WebView case where window.location.origin is useless.
 */
function buildRuntimePrefixUrl(kind: 'backend' | 'orchestrator'): string {
  const host = getEnv(
    kind === 'orchestrator'
      ? 'NEXT_PUBLIC_ORCHESTRATOR_HOST'
      : 'NEXT_PUBLIC_BACKEND_HOST',
  )
  const port = getEnv(
    kind === 'orchestrator'
      ? 'NEXT_PUBLIC_ORCHESTRATOR_PORT'
      : 'NEXT_PUBLIC_BACKEND_PORT',
  )
  const pathPrefix = getEnv(
    kind === 'orchestrator'
      ? 'NEXT_PUBLIC_ORCHESTRATOR_PATH_PREFIX'
      : 'NEXT_PUBLIC_BACKEND_PATH_PREFIX',
  )
  if (!host || host === '__SAME_ORIGIN__') {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const origin: string | undefined =
        kind === 'orchestrator'
          ? w.__DLP3D_ORCHESTRATOR_ORIGIN__
          : w.__DLP3D_SERVER_ORIGIN__
      if (origin) return `${origin}${pathPrefix}`
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}${pathPrefix}`
  }
  if (!port) return `https://${host}${pathPrefix}`
  return `https://${host}:${port}${pathPrefix}`
}

let _kyMotionFile: KyInstance | null = null
let _kyOrchestrator: KyInstance | null = null

export const kyMotionFile: KyInstance = new Proxy({} as KyInstance, {
  get(_target, prop) {
    if (!_kyMotionFile) {
      _kyMotionFile = ky.create({
        ...baseOptions,
        prefixUrl: buildRuntimePrefixUrl('backend'),
      })
    }
    const val = (_kyMotionFile as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? val.bind(_kyMotionFile) : val
  },
})

export const kyOrchestrator: KyInstance = new Proxy({} as KyInstance, {
  get(_target, prop) {
    if (!_kyOrchestrator) {
      _kyOrchestrator = ky.create({
        ...baseOptions,
        prefixUrl: buildRuntimePrefixUrl('orchestrator'),
        throwHttpErrors: false,
      })
    }
    const val = (_kyOrchestrator as unknown as Record<string | symbol, unknown>)[
      prop
    ]
    return typeof val === 'function' ? val.bind(_kyOrchestrator) : val
  },
})

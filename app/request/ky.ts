import ky from 'ky'
import type { KyInstance, KyRequest, NormalizedOptions } from 'ky'
import { getEnv } from '@/utils/env'

const baseOptions = {
  timeout: 180000,
  headers: {
    'Content-Type': 'application/json',
  },
  hooks: {
    afterResponse: [
      async (request: KyRequest, options: NormalizedOptions, response: Response) => {
        if (!response.ok) {
          let message: string
          try {
            const result = await response.json()
            message =
              result.detail?.error || result.message || `HTTP ${response.status}`
          } catch {
            message = response.statusText || `HTTP ${response.status}`
          }
          throw new Error(message)
        }

        try {
          const text = await response.text()
          const result = text.trim() ? JSON.parse(text) : null
          return new Response(result ? JSON.stringify(result) : JSON.stringify(null))
        } catch {
          return new Response(JSON.stringify(null))
        }
      },
    ],
  },
}

function buildPrefixUrl(kind: 'backend' | 'orchestrator'): string {
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
    if (typeof window !== 'undefined') {
      if (window.location.protocol === 'file:') {
        const w = window as unknown as Record<string, unknown>
        const origin =
          kind === 'orchestrator'
            ? (w.__DLP3D_ORCHESTRATOR_ORIGIN__ as string | undefined)
            : (w.__DLP3D_SERVER_ORIGIN__ as string | undefined)
        if (origin) return `${origin}${pathPrefix}`
      }
      return `${window.location.origin}${pathPrefix}`
    }
    return pathPrefix
  }
  if (!port) return `https://${host}${pathPrefix}`
  return `https://${host}:${port}${pathPrefix}`
}

let _kyDlpApi: KyInstance | null = null
let _kyDlpConfig: KyInstance | null = null

export const kyDlpApi: KyInstance = new Proxy({} as KyInstance, {
  get(_target, prop) {
    if (!_kyDlpApi) {
      _kyDlpApi = ky.create({ ...baseOptions, prefixUrl: buildPrefixUrl('backend') })
    }
    const val = (_kyDlpApi as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? val.bind(_kyDlpApi) : val
  },
})

export const kyDlpConfig: KyInstance = new Proxy({} as KyInstance, {
  get(_target, prop) {
    if (!_kyDlpConfig) {
      _kyDlpConfig = ky.create({
        ...baseOptions,
        prefixUrl: buildPrefixUrl('orchestrator'),
      })
    }
    const val = (_kyDlpConfig as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? val.bind(_kyDlpConfig) : val
  },
})

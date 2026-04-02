import ky from 'ky'
import type { KyRequest, NormalizedOptions } from 'ky'
import { getEnv } from '@/utils/env'

const NEXT_PUBLIC_BACKEND_HOST = getEnv('NEXT_PUBLIC_BACKEND_HOST')
const NEXT_PUBLIC_BACKEND_PORT = getEnv('NEXT_PUBLIC_BACKEND_PORT')
const NEXT_PUBLIC_BACKEND_PATH_PREFIX = getEnv('NEXT_PUBLIC_BACKEND_PATH_PREFIX')
const NEXT_PUBLIC_ORCHESTRATOR_HOST = getEnv('NEXT_PUBLIC_ORCHESTRATOR_HOST')
const NEXT_PUBLIC_ORCHESTRATOR_PORT = getEnv('NEXT_PUBLIC_ORCHESTRATOR_PORT')
const NEXT_PUBLIC_ORCHESTRATOR_PATH_PREFIX = getEnv(
  'NEXT_PUBLIC_ORCHESTRATOR_PATH_PREFIX',
)

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

export const kyDlpApi = ky.create({
  ...baseOptions,
  prefixUrl: `https://${NEXT_PUBLIC_BACKEND_HOST}:${NEXT_PUBLIC_BACKEND_PORT}${NEXT_PUBLIC_BACKEND_PATH_PREFIX}`,
})
export const kyDlpConfig = ky.create({
  ...baseOptions,
  prefixUrl: `https://${NEXT_PUBLIC_ORCHESTRATOR_HOST}:${NEXT_PUBLIC_ORCHESTRATOR_PORT}${NEXT_PUBLIC_ORCHESTRATOR_PATH_PREFIX}`,
})

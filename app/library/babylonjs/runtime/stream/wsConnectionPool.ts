import { Logger } from '@/library/babylonjs/utils'

/**
 * Pre-warmed WebSocket connection pool (single-slot).
 *
 * Opens a WebSocket to the orchestrator early so that when a recording round
 * starts the connection is already established, eliminating DNS + TCP + TLS +
 * WS-handshake latency (typically 1-2 s).
 *
 * Design notes
 * ────────────
 * - No heartbeat: Uvicorn's built-in ping/pong (20 s interval) keeps the
 *   connection alive; the backend blocks on `receive_bytes()` indefinitely
 *   with no application-level timeout.
 * - The pool tracks liveness via onclose/onerror so that `acquire()` only
 *   returns a healthy socket.
 * - If the pre-warmed socket dies between `preConnect()` and `acquire()`, the
 *   caller simply falls back to creating a fresh connection.
 */
export class WsConnectionPool {
  private _warmUrl: string | null = null
  private _warmSocket: WebSocket | null = null
  private _alive = false

  /**
   * Open a pre-warmed WebSocket to `url`.
   *
   * If the pool already holds a healthy socket to the same URL this is a
   * no-op. If the URL changed or the previous socket is dead, the old one is
   * disposed first.
   */
  async preConnect(url: string): Promise<void> {
    if (this._alive && this._warmSocket?.readyState === WebSocket.OPEN && this._warmUrl === url) {
      Logger.debug('[WsPool] already connected, skipping preConnect')
      return
    }
    this._dispose()

    Logger.debug(`[WsPool] preConnecting to ${url}`)
    this._warmUrl = url
    this._warmSocket = new WebSocket(url)
    this._warmSocket.binaryType = 'arraybuffer'

    this._alive = false

    this._warmSocket.onopen = () => {
      this._alive = true
      Logger.debug('[WsPool] preConnected successfully')
    }

    this._warmSocket.onclose = () => {
      Logger.debug('[WsPool] pre-warmed socket closed')
      this._alive = false
      this._warmSocket = null
    }

    this._warmSocket.onerror = () => {
      Logger.debug('[WsPool] pre-warmed socket error')
      this._alive = false
    }

    await new Promise<void>((resolve, reject) => {
      const ws = this._warmSocket!
      const onOpen = () => {
        cleanup()
        resolve()
      }
      const onError = (e: Event) => {
        cleanup()
        reject(e)
      }
      const cleanup = () => {
        ws.removeEventListener('open', onOpen)
        ws.removeEventListener('error', onError)
      }
      ws.addEventListener('open', onOpen)
      ws.addEventListener('error', onError)
    })
  }

  /**
   * Acquire the pre-warmed socket.
   *
   * Returns the WebSocket if it is still open and the URL matches, otherwise
   * `null`. On success the pool is cleared — the caller takes ownership of
   * the socket's lifecycle.
   */
  acquire(url: string): WebSocket | null {
    if (this._warmUrl === url && this._alive && this._warmSocket?.readyState === WebSocket.OPEN) {
      const ws = this._warmSocket
      // Clear pool state — caller owns the socket now
      this._warmSocket = null
      this._warmUrl = null
      this._alive = false
      // Strip pool handlers so the caller can install its own
      ws.onopen = null
      ws.onerror = null
      ws.onclose = null
      ws.onmessage = null
      Logger.debug('[WsPool] acquired pre-warmed socket')
      return ws
    }
    // Stale or dead — discard
    this._dispose()
    Logger.debug('[WsPool] acquire: no healthy socket, returning null')
    return null
  }

  /** Tear down the pooled socket (if any). */
  dispose(): void {
    this._dispose()
  }

  /** Whether the pool currently holds a healthy, open socket. */
  get isReady(): boolean {
    return this._alive && this._warmSocket?.readyState === WebSocket.OPEN
  }

  private _dispose(): void {
    if (this._warmSocket) {
      this._warmSocket.onopen = null
      this._warmSocket.onerror = null
      this._warmSocket.onclose = null
      this._warmSocket.onmessage = null
      if (this._warmSocket.readyState === WebSocket.OPEN || this._warmSocket.readyState === WebSocket.CONNECTING) {
        this._warmSocket.close()
      }
      this._warmSocket = null
    }
    this._warmUrl = null
    this._alive = false
  }
}

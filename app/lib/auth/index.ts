import { cookies } from 'next/headers'
import { getMongoDb, COLLECTIONS } from '@/lib/mongodb'

const SESSION_COOKIE = 'dlp3d_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface AuthUser {
  id: string
  username: string
}

function getLegacyBackendUrl(): string {
  return process.env.LEGACY_BACKEND_URL || 'http://web_backend:18080/api/v1'
}

export async function authenticateViaLegacy(
  username: string,
  password: string,
): Promise<{ userId: string; authCode: number; authMsg: string }> {
  const url = `${getLegacyBackendUrl()}/authenticate_user`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Legacy auth failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return { userId: data.user_id, authCode: data.auth_code, authMsg: data.auth_msg }
}

export async function registerViaLegacy(
  username: string,
  password: string,
): Promise<{ userId: string; authCode: number; authMsg: string }> {
  const url = `${getLegacyBackendUrl()}/register_user`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Legacy register failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return { userId: data.user_id, authCode: data.auth_code, authMsg: data.auth_msg }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const userId = cookieStore.get(SESSION_COOKIE)?.value
  if (!userId) return null

  const db = await getMongoDb()
  const doc = await db
    .collection(COLLECTIONS.USER_CREDENTIALS)
    .findOne({ user_id: userId }, { projection: { user_id: 1, username: 1 } })

  if (!doc) return null
  return { id: doc.user_id, username: doc.username }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function createSession(userId: string): Promise<string> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return userId
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json({ error: message }, { status: 401 })
}

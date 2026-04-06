import { NextRequest } from 'next/server'
import { authenticateViaLegacy, createSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return Response.json(
        { error: 'Username and password are required' },
        { status: 400 },
      )
    }

    const result = await authenticateViaLegacy(username, password)

    if (result.authCode !== 200 && result.authCode !== 0) {
      return Response.json(
        { error: result.authMsg || 'Invalid credentials' },
        { status: 401 },
      )
    }

    await createSession(result.userId)

    return Response.json({
      user: { id: result.userId, username },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return Response.json(
      { error: error.message || 'Authentication service error' },
      { status: 500 },
    )
  }
}

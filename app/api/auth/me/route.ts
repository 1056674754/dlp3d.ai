import { getCurrentUser, unauthorizedResponse } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorizedResponse()
  return Response.json({ user })
}

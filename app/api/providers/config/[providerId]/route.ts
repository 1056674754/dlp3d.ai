import { NextRequest } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/lib/auth'
import { getMongoDb, COLLECTIONS } from '@/lib/mongodb'
import { PROVIDER_REGISTRY } from '@/lib/providers/registry'

type RouteContext = { params: Promise<{ providerId: string }> }

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return unauthorizedResponse()
  }

  const { providerId } = await ctx.params
  const provider = PROVIDER_REGISTRY[providerId]
  if (!provider) {
    return Response.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const $set: Record<string, string> = {}
  for (const k of provider.mongoKeys) {
    $set[k.field] = ''
  }

  const db = await getMongoDb()
  await db
    .collection(COLLECTIONS.USER_CONFIGS)
    .updateOne({ user_id: user.id }, { $set })

  return Response.json({ success: true })
}

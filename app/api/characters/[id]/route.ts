import { NextRequest } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/lib/auth'
import { getMongoDb, COLLECTIONS } from '@/lib/mongodb'

type RouteContext = { params: Promise<{ id: string }> }

const ALLOWED_FIELDS = [
  'character_name',
  'avatar',
  'prompt',
  'scene_name',
  'tts_adapter',
  'voice',
  'voice_speed',
  'asr_adapter',
  'conversation_adapter',
  'conversation_model_override',
  'classification_adapter',
  'classification_model_override',
  'reaction_adapter',
  'reaction_model_override',
  'memory_adapter',
  'memory_model_override',
] as const

export async function GET(_request: NextRequest, ctx: RouteContext) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return unauthorizedResponse()
  }

  const { id } = await ctx.params
  const db = await getMongoDb()
  const doc = await db
    .collection(COLLECTIONS.CHARACTER_CONFIGS)
    .findOne({ user_id: user.id, character_id: id })

  if (!doc) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({
    character_id: doc.character_id,
    character_name: doc.character_name ?? '',
    avatar: doc.avatar ?? '',
    prompt: doc.prompt ?? '',
    scene_name: doc.scene_name ?? '',
    tts_adapter: doc.tts_adapter ?? '',
    voice: doc.voice ?? '',
    voice_speed: doc.voice_speed ?? 1.0,
    asr_adapter: doc.asr_adapter ?? '',
    conversation_adapter: doc.conversation_adapter ?? '',
    conversation_model_override: doc.conversation_model_override ?? '',
    classification_adapter: doc.classification_adapter ?? '',
    classification_model_override: doc.classification_model_override ?? '',
    reaction_adapter: doc.reaction_adapter ?? '',
    reaction_model_override: doc.reaction_model_override ?? '',
    memory_adapter: doc.memory_adapter ?? '',
    memory_model_override: doc.memory_model_override ?? '',
    read_only: doc.read_only ?? false,
    create_datatime: doc.create_datatime ?? '',
  })
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return unauthorizedResponse()
  }

  const { id } = await ctx.params
  const db = await getMongoDb()
  const doc = await db
    .collection(COLLECTIONS.CHARACTER_CONFIGS)
    .findOne({ user_id: user.id, character_id: id })

  if (!doc) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (doc.read_only) {
    return Response.json(
      { error: 'Cannot edit read-only character' },
      { status: 403 },
    )
  }

  try {
    const body = await request.json()
    const $set: Record<string, unknown> = {}

    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        $set[field] = body[field]
      }
    }

    if (Object.keys($set).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await db
      .collection(COLLECTIONS.CHARACTER_CONFIGS)
      .updateOne({ user_id: user.id, character_id: id }, { $set })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Update character error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { requireAuth, unauthorizedResponse } from '@/lib/auth'
import { getMongoDb, COLLECTIONS } from '@/lib/mongodb'

export async function GET() {
  let user
  try {
    user = await requireAuth()
  } catch {
    return unauthorizedResponse()
  }

  const db = await getMongoDb()
  const docs = await db
    .collection(COLLECTIONS.CHARACTER_CONFIGS)
    .find({ user_id: user.id })
    .toArray()

  const characters = docs.map(doc => ({
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
    wake_word: doc.wake_word ?? '',
    read_only: doc.read_only ?? false,
    create_datatime: doc.create_datatime ?? '',
  }))

  return Response.json({ characters })
}

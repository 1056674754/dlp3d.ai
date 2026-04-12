import { NextRequest } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/lib/auth'
import { getMongoDb, COLLECTIONS } from '@/lib/mongodb'
import {
  PROVIDER_REGISTRY,
  getAllMongoKeyFields,
  getConfiguredProviders,
} from '@/lib/providers/registry'

function maskSecret(value: string): string {
  if (!value) return ''
  if (value.length <= 6) return '******'
  return value.slice(0, 3) + '***' + value.slice(-3)
}

export async function GET() {
  let user
  try {
    user = await requireAuth()
  } catch {
    return unauthorizedResponse()
  }

  const db = await getMongoDb()
  const allFields = getAllMongoKeyFields()
  const projection: Record<string, 1> = { user_id: 1 }
  for (const f of allFields) projection[f] = 1

  const doc = await db
    .collection(COLLECTIONS.USER_CONFIGS)
    .findOne({ user_id: user.id }, { projection })

  const values: Record<string, string> = {}
  if (doc) {
    for (const f of allFields) {
      values[f] = (doc[f] as string) ?? ''
    }
  }

  const configuredSet = getConfiguredProviders(values)

  const providers = Object.values(PROVIDER_REGISTRY).map(p => {
    const fields: Record<string, string> = {}
    for (const k of p.mongoKeys) {
      const raw = values[k.field] || ''
      fields[k.field] = k.secret && raw ? maskSecret(raw) : raw
    }
    return {
      id: p.id,
      configured: configuredSet.includes(p.id),
      docsUrl: p.docsUrl ?? null,
      values: fields,
    }
  })

  return Response.json({ providers })
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()
    const { providerId, values } = body as {
      providerId: string
      values: Record<string, string>
    }

    const provider = PROVIDER_REGISTRY[providerId]
    if (!provider) {
      return Response.json({ error: 'Unknown provider' }, { status: 400 })
    }

    const $set: Record<string, string> = {}
    for (const k of provider.mongoKeys) {
      const val = values?.[k.field]
      if (val !== undefined && !val.includes('***')) {
        $set[k.field] = val
      }
    }

    if (Object.keys($set).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const db = await getMongoDb()
    await db
      .collection(COLLECTIONS.USER_CONFIGS)
      .updateOne({ user_id: user.id }, { $set }, { upsert: true })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Save provider config error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

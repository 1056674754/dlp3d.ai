import { PROVIDER_REGISTRY } from '@/lib/providers/registry'

export async function GET() {
  const providers = Object.values(PROVIDER_REGISTRY).map(p => ({
    id: p.id,
    label: p.label,
    labelZh: p.labelZh,
    categories: p.categories,
    docsUrl: p.docsUrl ?? null,
    mongoKeys: p.mongoKeys.map(k => ({
      field: k.field,
      label: k.label,
      labelZh: k.labelZh,
      required: k.required,
      secret: k.secret,
    })),
    adapterIds: p.adapterIds,
    suggestedModels: p.suggestedModels ?? {},
    iconPath: p.iconPath ?? null,
  }))

  return Response.json({ providers })
}

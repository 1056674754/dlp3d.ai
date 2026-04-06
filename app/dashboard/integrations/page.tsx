'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { ProviderCard } from '@/components/integrations/integration-card'
import { ProviderForm } from '@/components/integrations/integration-form'
import { useProviderStore, type ProviderConfigItem } from '@/stores/provider'
import { Loader2 } from 'lucide-react'

export default function ProvidersPage() {
  const {
    providers,
    loading,
    fetchProviderConfigs,
    saveProviderConfig,
    clearProviderConfig,
  } = useProviderStore()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProviderConfigItem | null>(null)

  useEffect(() => {
    fetchProviderConfigs()
  }, [fetchProviderConfigs])

  const handleConfigure = (config: ProviderConfigItem) => {
    setEditing(config)
    setFormOpen(true)
  }

  const handleSubmit = async (
    providerId: string,
    values: Record<string, string>,
  ) => {
    await saveProviderConfig(providerId, values)
  }

  const handleClear = async (providerId: string) => {
    if (!confirm('确定清空此 Provider 的所有凭证？')) return
    await clearProviderConfig(providerId)
  }

  const configured = providers.filter(p => p.configured)
  const unconfigured = providers.filter(p => !p.configured)

  return (
    <div>
      <Header
        title="Provider 管理"
        description="配置 API Key，然后在角色设置中选择使用对应的服务"
      />

      <div className="p-6 space-y-8">
        {loading && providers.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        )}

        {configured.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              已配置 ({configured.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {configured.map(p => (
                <ProviderCard
                  key={p.id}
                  config={p}
                  onConfigure={() => handleConfigure(p)}
                  onClear={() => handleClear(p.id)}
                />
              ))}
            </div>
          </section>
        )}

        {unconfigured.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              未配置 ({unconfigured.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {unconfigured.map(p => (
                <ProviderCard
                  key={p.id}
                  config={p}
                  onConfigure={() => handleConfigure(p)}
                  onClear={() => handleClear(p.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <ProviderForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        config={editing}
      />
    </div>
  )
}

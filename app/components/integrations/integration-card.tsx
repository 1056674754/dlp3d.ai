'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PROVIDER_REGISTRY } from '@/lib/providers/registry'
import { Settings, Trash2, CheckCircle2, Circle } from 'lucide-react'
import type { ProviderConfigItem } from '@/stores/provider'

interface ProviderCardProps {
  config: ProviderConfigItem
  onConfigure: () => void
  onClear: () => void
}

export function ProviderCard({ config, onConfigure, onClear }: ProviderCardProps) {
  const provider = PROVIDER_REGISTRY[config.id]
  if (!provider) return null

  return (
    <Card className="group transition-colors hover:border-ring">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{provider.labelZh}</h3>
            {config.configured ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                已配置
              </Badge>
            ) : (
              <Badge variant="outline">
                <Circle className="h-3 w-3 mr-1" />
                未配置
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{provider.label}</p>
          <div className="flex gap-1 flex-wrap">
            {provider.categories.map(c => (
              <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">
                {c.toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onConfigure}>
            <Settings className="h-3.5 w-3.5 mr-1" />
            {config.configured ? '修改' : '配置'}
          </Button>
          {config.configured && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive-foreground ml-auto"
              onClick={onClear}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

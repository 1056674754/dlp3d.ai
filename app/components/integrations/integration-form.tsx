'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { PROVIDER_REGISTRY } from '@/lib/providers/registry'
import type { ProviderConfigItem } from '@/stores/provider'
import { Loader2 } from 'lucide-react'

interface ProviderFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (providerId: string, values: Record<string, string>) => Promise<void>
  config: ProviderConfigItem | null
}

export function ProviderForm({
  open,
  onClose,
  onSubmit,
  config,
}: ProviderFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const provider = config ? PROVIDER_REGISTRY[config.id] : undefined

  useEffect(() => {
    if (config && provider) {
      const initial: Record<string, string> = {}
      for (const k of provider.mongoKeys) {
        initial[k.field] = config.values[k.field] ?? ''
      }
      setValues(initial)
    } else {
      setValues({})
    }
    setError('')
  }, [config, open])

  const handleSubmit = async () => {
    if (!config || !provider) return
    setSaving(true)
    setError('')
    try {
      await onSubmit(config.id, values)
      onClose()
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!provider) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>配置 {provider.labelZh}</DialogTitle>
          <DialogDescription>填写 {provider.label} 所需的凭证信息</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {provider.mongoKeys.map(field => (
            <div key={field.field} className="space-y-2">
              <Label>
                {field.labelZh}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                type={field.secret ? 'password' : 'text'}
                value={values[field.field] ?? ''}
                onChange={e =>
                  setValues(prev => ({ ...prev, [field.field]: e.target.value }))
                }
                placeholder={field.label}
              />
            </div>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

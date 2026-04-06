'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ModelSelect } from '@/components/ui/model-select'
import { useCharacterStore } from '@/stores/character'
import { useProviderStore } from '@/stores/provider'
import {
  PROVIDER_REGISTRY,
  getSuggestedModels,
  type ProviderCategory,
} from '@/lib/providers/registry'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'

const NONE_VALUE = '__none__'

export default function CharacterSettings() {
  const params = useParams()
  const router = useRouter()
  const characterId = params.id as string

  const { characters, fetchCharacters, updateCharacter } = useCharacterStore()
  const { providers, fetchProviderConfigs } = useProviderStore()

  const character = characters.find(c => c.character_id === characterId)

  const [form, setForm] = useState({
    character_name: '',
    prompt: '',
    tts_adapter: '',
    voice: '',
    voice_speed: 1.0,
    asr_adapter: '',
    conversation_adapter: '',
    conversation_model_override: '',
    reaction_adapter: '',
    reaction_model_override: '',
    memory_adapter: '',
    memory_model_override: '',
  })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetchCharacters()
    fetchProviderConfigs()
  }, [fetchCharacters, fetchProviderConfigs])

  useEffect(() => {
    if (character) {
      setForm({
        character_name: character.character_name || '',
        prompt: character.prompt || '',
        tts_adapter: character.tts_adapter || '',
        voice: character.voice || '',
        voice_speed: character.voice_speed ?? 1.0,
        asr_adapter: character.asr_adapter || '',
        conversation_adapter: character.conversation_adapter || '',
        conversation_model_override: character.conversation_model_override || '',
        reaction_adapter: character.reaction_adapter || '',
        reaction_model_override: character.reaction_model_override || '',
        memory_adapter: character.memory_adapter || '',
        memory_model_override: character.memory_model_override || '',
      })
      setDirty(false)
    }
  }, [character])

  const update = useCallback((key: string, value: string | number | null) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateCharacter(characterId, {
        character_name: form.character_name,
        prompt: form.prompt,
        tts_adapter: form.tts_adapter || '',
        voice: form.voice || '',
        voice_speed: form.voice_speed,
        asr_adapter: form.asr_adapter || '',
        conversation_adapter: form.conversation_adapter || '',
        conversation_model_override: form.conversation_model_override || '',
        reaction_adapter: form.reaction_adapter || '',
        reaction_model_override: form.reaction_model_override || '',
        memory_adapter: form.memory_adapter || '',
        memory_model_override: form.memory_model_override || '',
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const configuredProviderIds = useMemo(
    () => providers.filter(p => p.configured).map(p => p.id),
    [providers],
  )

  const getAdaptersForCategory = useCallback(
    (category: ProviderCategory) => {
      const adapters: { adapterId: string; label: string; providerId: string }[] = []
      for (const pid of configuredProviderIds) {
        const p = PROVIDER_REGISTRY[pid]
        const aid = p?.adapterIds[category]
        if (aid) {
          adapters.push({ adapterId: aid, label: p.labelZh, providerId: pid })
        }
      }
      return adapters
    },
    [configuredProviderIds],
  )

  const getModelsForAdapter = useCallback(
    (adapterId: string, category: ProviderCategory) => {
      for (const p of Object.values(PROVIDER_REGISTRY)) {
        if (p.adapterIds[category] === adapterId) {
          return getSuggestedModels(p.id, category)
        }
      }
      return []
    },
    [],
  )

  const ttsAdapters = getAdaptersForCategory('tts')
  const llmAdapters = getAdaptersForCategory('llm')
  const asrAdapters = getAdaptersForCategory('asr')

  if (!character) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        加载中...
      </div>
    )
  }

  function AdapterSelect({
    label,
    value,
    items,
    onChange,
  }: {
    label: string
    value: string
    items: { adapterId: string; label: string }[]
    onChange: (v: string) => void
  }) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select
          value={value || NONE_VALUE}
          onValueChange={v => onChange(v === NONE_VALUE ? '' : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="未选择" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>未选择</SelectItem>
            {items.map(i => (
              <SelectItem key={i.adapterId} value={i.adapterId}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  const isReadOnly = character.read_only

  return (
    <div>
      <Header
        title={`配置 · ${character.character_name}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
            {!isReadOnly && (
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                保存
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={form.character_name}
                onChange={e => update('character_name', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>角色 Prompt</Label>
              <Textarea
                value={form.prompt}
                onChange={e => update('prompt', e.target.value)}
                rows={6}
                placeholder="描述角色的性格、能力和行为方式..."
                disabled={isReadOnly}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">大语言模型 (LLM)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AdapterSelect
              label="对话 LLM"
              value={form.conversation_adapter}
              items={llmAdapters}
              onChange={v => update('conversation_adapter', v)}
            />
            <div className="space-y-2">
              <Label>对话模型</Label>
              <ModelSelect
                value={form.conversation_model_override}
                onChange={v => update('conversation_model_override', v)}
                suggestions={getModelsForAdapter(form.conversation_adapter, 'llm')}
                placeholder="选择推荐模型或自定义输入..."
              />
            </div>

            <Separator />

            <AdapterSelect
              label="Reaction 分析 LLM"
              value={form.reaction_adapter}
              items={llmAdapters}
              onChange={v => update('reaction_adapter', v)}
            />
            <div className="space-y-2">
              <Label>Reaction 模型</Label>
              <ModelSelect
                value={form.reaction_model_override}
                onChange={v => update('reaction_model_override', v)}
                suggestions={getModelsForAdapter(form.reaction_adapter, 'llm')}
                placeholder="选择推荐模型或自定义输入..."
              />
            </div>

            <Separator />

            <AdapterSelect
              label="Memory LLM"
              value={form.memory_adapter}
              items={llmAdapters}
              onChange={v => update('memory_adapter', v)}
            />
            <div className="space-y-2">
              <Label>Memory 模型</Label>
              <ModelSelect
                value={form.memory_model_override}
                onChange={v => update('memory_model_override', v)}
                suggestions={getModelsForAdapter(form.memory_adapter, 'llm')}
                placeholder="选择推荐模型或自定义输入..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">语音合成 (TTS)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AdapterSelect
              label="TTS 服务"
              value={form.tts_adapter}
              items={ttsAdapters}
              onChange={v => update('tts_adapter', v)}
            />
            <div className="space-y-2">
              <Label>音色 / Voice</Label>
              <ModelSelect
                value={form.voice}
                onChange={v => update('voice', v)}
                suggestions={getModelsForAdapter(form.tts_adapter, 'tts')}
                placeholder="选择推荐音色或自定义输入..."
              />
            </div>
            <div className="space-y-2">
              <Label>语速: {form.voice_speed.toFixed(1)}x</Label>
              <Slider
                min={0.5}
                max={2.0}
                step={0.1}
                value={form.voice_speed}
                onChange={e =>
                  update(
                    'voice_speed',
                    parseFloat((e.target as HTMLInputElement).value),
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">语音识别 (ASR)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AdapterSelect
              label="ASR 服务"
              value={form.asr_adapter}
              items={asrAdapters}
              onChange={v => update('asr_adapter', v)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

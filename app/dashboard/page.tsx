'use client'

import { useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProviderStore } from '@/stores/provider'
import { useCharacterStore } from '@/stores/character'
import { Plug, Users, Activity } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { providers, fetchProviderConfigs } = useProviderStore()
  const { characters, fetchCharacters } = useCharacterStore()

  useEffect(() => {
    fetchProviderConfigs()
    fetchCharacters()
  }, [fetchProviderConfigs, fetchCharacters])

  const configuredCount = providers.filter(p => p.configured).length
  const totalCharacters = characters.length

  const stats = [
    {
      label: 'Providers',
      value: `${configuredCount} / ${providers.length}`,
      sub: `${configuredCount} 个已配置`,
      icon: Plug,
      href: '/dashboard/integrations',
    },
    {
      label: '角色',
      value: totalCharacters,
      sub: '已创建',
      icon: Users,
      href: '/dashboard/characters',
    },
    {
      label: '状态',
      value: configuredCount > 0 ? '就绪' : '未配置',
      sub: configuredCount > 0 ? '可以开始对话' : '请先配置 Provider',
      icon: Activity,
      href: '/dashboard/integrations',
    },
  ]

  return (
    <div>
      <Header title="总览" description="管理你的 Provider 和角色配置" />
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map(stat => (
            <Link key={stat.label} href={stat.href}>
              <Card className="transition-colors hover:border-ring cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

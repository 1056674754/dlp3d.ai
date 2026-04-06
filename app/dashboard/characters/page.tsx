'use client'

import { useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCharacterStore, type CharacterItem } from '@/stores/character'
import { Pencil, Lock, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function CharactersPage() {
  const { characters, loading, fetchCharacters } = useCharacterStore()

  useEffect(() => {
    fetchCharacters()
  }, [fetchCharacters])

  return (
    <div>
      <Header
        title="角色管理"
        description="查看和配置你的 AI 角色（角色由主界面创建）"
      />

      <div className="p-6">
        {loading && characters.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        )}

        {!loading && characters.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              还没有角色。请在主界面中创建角色。
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {characters.map((c: CharacterItem) => (
            <Card
              key={c.character_id}
              className="group transition-colors hover:border-ring"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate">
                    {c.character_name}
                  </CardTitle>
                  {c.read_only && (
                    <Badge variant="secondary">
                      <Lock className="h-3 w-3 mr-1" />
                      只读
                    </Badge>
                  )}
                </div>
                {c.prompt && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {c.prompt}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/characters/${c.character_id}`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {c.read_only ? '查看' : '配置'}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

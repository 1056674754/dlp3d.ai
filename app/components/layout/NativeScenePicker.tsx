'use client'

import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { getIsSceneLoading } from '@/features/chat/chat'
import { getSelectedChat } from '@/features/chat/chat'
import { usePromptingSettings } from '@/hooks/usePromptingSettings'
import { HDRI_SCENES } from '@/library/babylonjs/config/scene'
import { resolvePublicUrl } from '@/utils/publicUrl'

interface NativeScenePickerProps {
  onSceneChange: (scene: string) => void
  chatAvailable: boolean
  isCharacterLoading: boolean
  isSceneLoading: boolean
}

/**
 * Compact HDRI scene strip for React Native WebView: ConfigSidebar is hidden when
 * `isNativeApp()`, so this provides in-page scene switching with the same API as ScenePanel.
 */
export default function NativeScenePicker({
  onSceneChange,
  chatAvailable,
  isCharacterLoading,
  isSceneLoading,
}: NativeScenePickerProps) {
  const { t } = useTranslation()
  const settings = useSelector(getSelectedChat)
  const [selectedScene, setSelectedScene] = useState(settings?.scene_name)
  const isLoading = useSelector(getIsSceneLoading)
  const { updateCharacter } = usePromptingSettings()

  useEffect(() => {
    setSelectedScene(settings?.scene_name)
  }, [settings?.scene_name])

  const disabled =
    !chatAvailable ||
    isCharacterLoading ||
    isSceneLoading ||
    !settings?.character_id ||
    settings.read_only === true

  const handleSceneSelect = async (name: string, index: number) => {
    if (disabled || isLoading) return
    if (name === settings?.scene_name) return
    setSelectedScene(name)
    const res = await updateCharacter(settings.character_id, 'scene', {
      scene_name: name,
    })
    if (!res) return
    onSceneChange(HDRI_SCENES[index].name)
  }

  return (
    <div
      className="native-scene-picker"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        padding: '8px 10px calc(10px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(transparent, rgba(15,17,26,0.92))',
        pointerEvents: disabled ? 'none' : 'auto',
        opacity: disabled ? 0.45 : 1,
      }}
      aria-label={t('sidebar.scene')}
    >
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.65)',
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        {t('sidebar.scene')}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 2,
        }}
      >
        {HDRI_SCENES.map((scene, index) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => void handleSceneSelect(scene.name, index)}
            disabled={disabled || isLoading}
            style={{
              flex: '0 0 auto',
              width: 72,
              height: 52,
              borderRadius: 8,
              border:
                selectedScene === scene.name
                  ? '2px solid rgba(120, 180, 255, 0.95)'
                  : '2px solid rgba(255,255,255,0.15)',
              padding: 0,
              overflow: 'hidden',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: '#1e202d',
              position: 'relative',
            }}
          >
            <img
              src={resolvePublicUrl(scene.image)}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                fontSize: 9,
                lineHeight: 1.1,
                padding: '3px 2px',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {t(`scenes.${scene.name}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

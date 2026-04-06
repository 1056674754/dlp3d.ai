'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ModelSelectProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
}

export function ModelSelect({
  value,
  onChange,
  suggestions,
  placeholder = '选择或输入模型名称...',
}: ModelSelectProps) {
  const [focused, setFocused] = useState(false)

  const filtered = suggestions.filter(
    s => !value || s.toLowerCase().includes(value.toLowerCase()),
  )
  const showDropdown = focused && filtered.length > 0

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-md">
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(model => (
              <button
                key={model}
                type="button"
                className={cn(
                  'flex w-full items-center rounded-sm px-2 py-1.5 text-sm',
                  'hover:bg-accent hover:text-accent-foreground',
                  'cursor-pointer text-left',
                  model === value && 'bg-accent text-accent-foreground',
                )}
                onMouseDown={e => {
                  e.preventDefault()
                  onChange(model)
                  setFocused(false)
                }}
              >
                {model}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label?: string
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, ...props }, ref) => (
    <input
      type="range"
      ref={ref}
      className={cn(
        'w-full h-2 rounded-full appearance-none cursor-pointer bg-secondary',
        '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
        className,
      )}
      {...props}
    />
  ),
)
Slider.displayName = 'Slider'

export { Slider }

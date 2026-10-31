import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function BrandMark({
  size = 34,
  className,
}: {
  size?: number
  className?: string
}): ReactNode {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" width={size * 0.62} height={size * 0.62}>
        <circle cx="8.6" cy="12" r="5.6" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="15.4" cy="12" r="5.6" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      </svg>
    </div>
  )
}

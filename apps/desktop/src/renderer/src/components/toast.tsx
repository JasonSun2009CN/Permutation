import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/app-store'
import { IconButton } from './ui'

export function Toast(): ReactNode {
  const toast = useAppStore((state) => state.toast)
  const clearToast = useAppStore((state) => state.clearToast)
  if (!toast) return null

  const icons = {
    success: <CheckCircle2 size={16} className="text-accent" />,
    error: <AlertCircle size={16} className="text-danger" />,
    info: <Info size={16} className="text-muted" />,
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-4 right-4 z-[70] flex max-w-sm items-start gap-2.5 rounded-xl border border-line bg-surface py-3 pr-2 pl-3.5 shadow-card animate-rise',
        toast.tone === 'error' && 'border-danger/25',
      )}
    >
      <span className="mt-0.5 shrink-0">{icons[toast.tone]}</span>
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed break-words text-ink">
        {toast.message}
      </p>
      <IconButton label="Dismiss" onClick={clearToast} className="h-6 w-6 shrink-0">
        <X size={13} />
      </IconButton>
    </div>
  )
}

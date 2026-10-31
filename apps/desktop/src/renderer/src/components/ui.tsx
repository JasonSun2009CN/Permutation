import { Loader2, X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useEffect } from 'react'
import { cn } from '../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type ButtonSize = 'sm' | 'md' | 'icon'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-contrast hover:bg-accent-hover shadow-[0_1px_2px_rgba(0,0,0,0.08)] disabled:bg-surface-2 disabled:text-faint disabled:opacity-100 disabled:shadow-none',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
  soft: 'bg-accent-soft text-accent hover:bg-accent hover:text-accent-contrast',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[13px]',
  icon: 'h-9 w-9',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}): ReactNode {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        'inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 size={15} className="animate-spin-slow" /> : null}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): ReactNode {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'accent' | 'warm' | 'danger' | 'success'
  children: ReactNode
  className?: string
}): ReactNode {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    warm: 'bg-warm-soft text-warm',
    danger: 'bg-danger-soft text-danger',
    success: 'bg-accent-soft text-accent',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ size = 16 }: { size?: number }): ReactNode {
  return <Loader2 size={size} className="animate-spin-slow text-muted" />
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked && 'translate-x-4',
        )}
      />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  className?: string
}): ReactNode {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
            value === option.value
              ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
              : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  width?: string
}): ReactNode {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade dark:bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full rounded-2xl border border-line bg-surface p-6 shadow-card animate-rise',
          width,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">{title}</h2>
            {description ? <p className="mt-1 text-[12.5px] text-muted">{description}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  children: ReactNode
  htmlFor?: string
}): ReactNode {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[12px] font-medium text-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11.5px] leading-relaxed text-faint">{hint}</p> : null}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink placeholder:text-faint transition-colors duration-150 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}): ReactNode {
  return (
    <header className="flex items-end justify-between gap-6 pb-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11.5px] font-medium tracking-[0.14em] text-faint uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="truncate text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

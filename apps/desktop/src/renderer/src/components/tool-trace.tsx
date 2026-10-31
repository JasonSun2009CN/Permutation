import { Check, ChevronDown, Loader2, ShieldX, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { toolLabelKey } from '../lib/format'
import { useI18n } from '../lib/use-i18n'
import type { LiveTrace } from '../store/app-store'

export function ToolTraceList({
  traces,
  compact = false,
}: {
  traces: LiveTrace[]
  compact?: boolean
}): ReactNode {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (traces.length === 0) return null

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-line/80 bg-surface-2/60',
        compact ? 'text-[11.5px]' : '',
      )}
    >
      {traces.map((trace, index) => {
        const isOpen = expanded === trace.callId
        const label = t(toolLabelKey(trace.name))
        return (
          <div key={trace.callId} className={cn(index > 0 && 'border-t border-line/70')}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : trace.callId)}
              className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface/50"
            >
              <span className="mt-0.5 shrink-0">
                <TraceIcon status={trace.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-medium text-ink">{label}</span>
                  {trace.status !== 'running' ? (
                    <span
                      className={cn(
                        'text-[10.5px]',
                        trace.status === 'ok'
                          ? 'text-accent'
                          : trace.status === 'denied'
                            ? 'text-warm'
                            : 'text-danger',
                      )}
                    >
                      {trace.status === 'ok'
                        ? t('tool.ok')
                        : trace.status === 'denied'
                          ? t('tool.denied')
                          : t('tool.error')}
                    </span>
                  ) : null}
                </span>
                {trace.summary ? (
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                    {trace.summary}
                  </span>
                ) : trace.status === 'running' ? (
                  <span className="mt-0.5 block text-[11.5px] text-faint">{t('tool.running')}</span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[10.5px] text-faint">
                {trace.durationMs !== undefined && trace.durationMs >= 100 ? (
                  <span>
                    {trace.durationMs >= 1000
                      ? `${(trace.durationMs / 1000).toFixed(1)}s`
                      : `${trace.durationMs}ms`}
                  </span>
                ) : null}
                <ChevronDown
                  size={13}
                  className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
                />
              </span>
            </button>
            {isOpen ? (
              <div className="border-t border-line/60 bg-surface/60 px-3 py-2.5">
                <p className="mb-1 text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase">
                  {t('tool.details')}
                </p>
                <pre className="thin-scroll max-h-48 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted">
                  {JSON.stringify(trace.args, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function TraceIcon({ status }: { status: LiveTrace['status'] }): ReactNode {
  if (status === 'running') {
    return <Loader2 size={14} className="animate-spin-slow text-faint" />
  }
  if (status === 'ok') {
    return (
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent-soft text-accent">
        <Check size={11} strokeWidth={3} />
      </span>
    )
  }
  if (status === 'denied') {
    return (
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-warm-soft text-warm">
        <ShieldX size={11} strokeWidth={2.5} />
      </span>
    )
  }
  return (
    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-danger-soft text-danger">
      <X size={11} strokeWidth={3} />
    </span>
  )
}

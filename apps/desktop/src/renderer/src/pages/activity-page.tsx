import type { ActionLog } from '@permutation/shared'
import { Activity as ActivityIcon, Check, ChevronDown, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { formatDateTime, toolLabelKey } from '../lib/format'
import type { TKey } from '../lib/i18n'
import { useI18n } from '../lib/use-i18n'
import { Badge, Button, PageHeader } from '../components/ui'

export function ActivityPage(): ReactNode {
  const { t, language } = useI18n()
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.permutation.logs.list(200)
      setLogs(result)
    } catch (error) {
      console.error('[activity] failed to load logs', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="thin-scroll h-full overflow-y-auto px-8 pb-10">
      <PageHeader
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw size={13} />
            {t('activity.refresh')}
          </Button>
        }
      />

      {logs.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-faint">
            <ActivityIcon size={19} />
          </span>
          <h3 className="mt-3.5 text-[14px] font-medium text-ink">{t('activity.empty')}</h3>
          <p className="mt-1 max-w-xs text-[12px] text-muted">{t('activity.emptyDesc')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {logs.map((log, index) => {
            const isOpen = expanded === log.id
            return (
              <div key={log.id} className={cn(index > 0 && 'border-t border-line/70')}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2/40"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                      log.status === 'error'
                        ? 'bg-danger-soft text-danger'
                        : log.status === 'denied'
                          ? 'bg-warm-soft text-warm'
                          : 'bg-accent-soft text-accent',
                    )}
                  >
                    {log.status === 'error' ? (
                      <X size={13} />
                    ) : log.status === 'denied' ? (
                      <X size={13} />
                    ) : (
                      <Check size={13} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-ink">
                        {t(toolLabelKey(log.toolName))}
                      </p>
                      <Badge
                        tone={
                          log.status === 'error'
                            ? 'danger'
                            : log.status === 'denied'
                              ? 'warm'
                              : 'accent'
                        }
                      >
                        {log.status === 'error'
                          ? t('tool.error')
                          : log.status === 'denied'
                            ? t('tool.denied')
                            : t('tool.ok')}
                      </Badge>
                      <span className="text-[10.5px] text-faint">
                        {t(`activity.source.${log.source}`)}
                      </span>
                      {log.confirmed ? (
                        <span className="text-[10.5px] text-accent">{t('activity.confirmed')}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted">
                      {summarize(log.result, t)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 pt-0.5 text-[10.5px] text-faint">
                    <span>{formatDateTime(log.createdAt, language)}</span>
                    <ChevronDown
                      size={13}
                      className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
                    />
                  </div>
                </button>

                {isOpen ? (
                  <div className="grid gap-3 border-t border-line/60 bg-surface-2/30 px-4 py-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-faint uppercase">
                        {t('activity.tool')}
                      </p>
                      <pre className="thin-scroll max-h-48 overflow-auto rounded-lg bg-surface p-2.5 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap text-muted">
                        {JSON.stringify(log.args, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-faint uppercase">
                        {t('activity.result')}
                      </p>
                      <pre className="thin-scroll max-h-48 overflow-auto rounded-lg bg-surface p-2.5 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap text-muted">
                        {JSON.stringify(log.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-faint">{t('activity.privacy')}</p>
    </div>
  )
}

function summarize(
  value: unknown,
  t: (key: TKey, vars?: Record<string, string | number>) => string,
): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value.slice(0, 160)
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.denied) return t('activity.denied')
    if (typeof record.error === 'string') return record.error
    if (record.reminder && typeof record.reminder === 'object') {
      const reminder = record.reminder as Record<string, unknown>
      if (typeof reminder.content === 'string') return reminder.content
    }
    if (typeof record.count === 'number') {
      return record.count === 1
        ? t('activity.oneResult')
        : t('activity.results', { count: record.count })
    }
    if (record.ok === true) return t('activity.ok')
  }
  try {
    return JSON.stringify(value).slice(0, 160)
  } catch {
    return String(value)
  }
}

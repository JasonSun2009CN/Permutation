import type { Reminder } from '@permutation/shared'
import { Bell, Check, CheckCircle2, Clock3, Pencil, Plus, X } from 'lucide-react'
import { useMemo, useState, useEffect, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { formatRelative, formatReminderWhen, statusKey } from '../lib/format'
import { useI18n } from '../lib/use-i18n'
import { selectOpenReminders, useAppStore } from '../store/app-store'
import { ConfirmDialog } from '../components/confirm-dialog'
import { ReminderDialog } from '../components/reminder-dialog'
import { Badge, Button, IconButton, PageHeader } from '../components/ui'

type Tab = 'open' | 'all' | 'completed'

export function RemindersPage(): ReactNode {
  const { t } = useI18n()
  const reminders = useAppStore((state) => state.reminders)
  const completeReminder = useAppStore((state) => state.completeReminder)
  const snoozeReminder = useAppStore((state) => state.snoozeReminder)
  const cancelReminder = useAppStore((state) => state.cancelReminder)
  const newReminderToken = useAppStore((state) => state.newReminderToken)
  const [tab, setTab] = useState<Tab>('open')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Reminder | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (newReminderToken > 0) {
      setEditing(null)
      setDialogOpen(true)
    }
  }, [newReminderToken])

  const openCount = useMemo(() => selectOpenReminders(reminders).length, [reminders])
  const completedCount = useMemo(
    () => reminders.filter((reminder) => reminder.status === 'completed').length,
    [reminders],
  )

  const visible = useMemo(() => {
    const list =
      tab === 'open'
        ? reminders.filter(
            (reminder) => reminder.status === 'pending' || reminder.status === 'fired',
          )
        : tab === 'completed'
          ? reminders.filter((reminder) => reminder.status === 'completed')
          : reminders
    return [...list].sort((a, b) =>
      tab === 'completed'
        ? b.triggerAt.localeCompare(a.triggerAt)
        : a.triggerAt.localeCompare(b.triggerAt),
    )
  }, [reminders, tab])

  const openCreate = (): void => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (reminder: Reminder): void => {
    setEditing(reminder)
    setDialogOpen(true)
  }

  const confirmCancel = async (): Promise<void> => {
    if (!cancelTarget) return
    setCancelling(true)
    await cancelReminder(cancelTarget.id)
    setCancelling(false)
    setCancelTarget(null)
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto px-8 pb-10">
      <PageHeader
        title={t('reminders.title')}
        subtitle={t('reminders.subtitle')}
        actions={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} />
            {t('reminders.new')}
          </Button>
        }
      />

      <div className="mb-4 inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {(
          [
            ['open', t('reminders.open'), openCount],
            ['all', t('reminders.all'), reminders.length],
            ['completed', t('reminders.completed'), completedCount],
          ] as Array<[Tab, string, number]>
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
              tab === value
                ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-muted hover:text-ink',
            )}
          >
            {label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                tab === value ? 'bg-accent-soft text-accent' : 'bg-surface/70 text-faint',
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState tab={tab} onCreate={openCreate} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {visible.map((reminder, index) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              now={now}
              first={index === 0}
              onComplete={() => void completeReminder(reminder.id)}
              onSnooze={() => void snoozeReminder(reminder.id, 10)}
              onEdit={() => openEdit(reminder)}
              onCancel={() => setCancelTarget(reminder)}
            />
          ))}
        </div>
      )}

      <ReminderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} reminder={editing} />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={t('reminders.cancelTitle')}
        description={
          cancelTarget ? t('reminders.cancelBody', { content: cancelTarget.content }) : ''
        }
        confirmLabel={t('reminders.cancel')}
        loading={cancelling}
        onConfirm={() => void confirmCancel()}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  )
}

function ReminderRow({
  reminder,
  now,
  first,
  onComplete,
  onSnooze,
  onEdit,
  onCancel,
}: {
  reminder: Reminder
  now: Date
  first: boolean
  onComplete: () => void
  onSnooze: () => void
  onEdit: () => void
  onCancel: () => void
}): ReactNode {
  const { t, language } = useI18n()
  const done = reminder.status === 'completed'
  const inactive = reminder.status === 'cancelled' || reminder.status === 'dismissed'
  const overdue =
    (reminder.status === 'pending' || reminder.status === 'fired') &&
    new Date(reminder.triggerAt).getTime() < now.getTime()

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-2/40',
        !first && 'border-t border-line/70',
      )}
    >
      <button
        type="button"
        aria-label={t('reminders.complete')}
        onClick={done ? undefined : onComplete}
        disabled={done || inbox(reminder.status)}
        className={cn(
          'mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
          done
            ? 'border-accent bg-accent text-accent-contrast'
            : 'cursor-pointer border-line-strong text-transparent hover:border-accent hover:text-accent',
          (inbox(reminder.status) || inactive) && 'cursor-default opacity-50',
        )}
      >
        <Check size={11} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              'text-[13.5px] leading-snug font-medium',
              done || inactive ? 'text-muted' : 'text-ink',
            )}
          >
            {reminder.content}
          </p>
          {reminder.status !== 'pending' && !done ? (
            <Badge tone={reminder.status === 'fired' ? 'warm' : 'neutral'}>
              {t(statusKey(reminder.status))}
            </Badge>
          ) : null}
          {overdue && reminder.status !== 'fired' ? (
            <Badge tone="warm">{t('reminder.overdue')}</Badge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
          <span>{formatReminderWhen(reminder.triggerAt, language)}</span>
          <span className="text-faint">·</span>
          <span className={cn(overdue && 'text-warm')}>
            {formatRelative(reminder.triggerAt, language, now)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
        {!done && !inactive ? (
          <IconButton label={t('reminders.snooze')} onClick={onSnooze} className="h-7 w-7">
            <Clock3 size={14} />
          </IconButton>
        ) : null}
        {!done && !inactive ? (
          <IconButton label={t('common.edit')} onClick={onEdit} className="h-7 w-7">
            <Pencil size={13.5} />
          </IconButton>
        ) : null}
        {!done && !inactive ? (
          <IconButton
            label={t('reminders.cancel')}
            onClick={onCancel}
            className="h-7 w-7 hover:bg-danger-soft hover:text-danger"
          >
            <X size={14} />
          </IconButton>
        ) : null}
      </div>
    </div>
  )
}

function EmptyState({ tab, onCreate }: { tab: Tab; onCreate: () => void }): ReactNode {
  const { t } = useI18n()
  const copy = {
    open: [t('reminders.emptyOpen'), t('reminders.emptyOpenDesc')],
    all: [t('reminders.emptyAll'), t('reminders.emptyAllDesc')],
    completed: [t('reminders.emptyCompleted'), t('reminders.emptyCompletedDesc')],
  }[tab]

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-faint">
        {tab === 'completed' ? <CheckCircle2 size={19} /> : <Bell size={19} />}
      </span>
      <h3 className="mt-3.5 text-[14px] font-medium text-ink">{copy[0]}</h3>
      <p className="mt-1 max-w-xs text-[12px] text-muted">{copy[1]}</p>
      {tab !== 'completed' ? (
        <Button size="sm" variant="secondary" className="mt-4" onClick={onCreate}>
          <Plus size={14} />
          {t('reminders.new')}
        </Button>
      ) : null}
    </div>
  )
}

function inbox(status: Reminder['status']): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'dismissed'
}

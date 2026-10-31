import { AlarmClock, ArrowRight, Check, CalendarDays, Clock3, Plus, SunMedium } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import {
  formatClock,
  formatDateLong,
  formatDateShort,
  formatRelative,
  formatReminderWhen,
  statusKey,
  todayGreetingKey,
} from '../lib/format'
import { useI18n } from '../lib/use-i18n'
import { selectOpenReminders, selectTodayReminders, useAppStore } from '../store/app-store'
import { ReminderDialog } from '../components/reminder-dialog'
import { Badge, Button, PageHeader } from '../components/ui'

export function TodayPage(): ReactNode {
  const { t, language } = useI18n()
  const reminders = useAppStore((state) => state.reminders)
  const completeReminder = useAppStore((state) => state.completeReminder)
  const snoozeReminder = useAppStore((state) => state.snoozeReminder)
  const navigate = useAppStore((state) => state.navigate)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const open = useMemo(() => selectOpenReminders(reminders), [reminders])
  const today = useMemo(() => selectTodayReminders(reminders, now), [reminders, now])
  const completedToday = useMemo(
    () =>
      reminders.filter(
        (reminder) => reminder.status === 'completed' && sameDay(new Date(reminder.updatedAt), now),
      ),
    [reminders, now],
  )

  const sortedOpen = [...open].sort((a, b) => a.triggerAt.localeCompare(b.triggerAt))
  const next = sortedOpen[0]
  const weekEnd = new Date(now)
  weekEnd.setDate(now.getDate() + 7)
  const weekCount = open.filter((reminder) => {
    const trigger = new Date(reminder.triggerAt)
    return trigger > now && trigger <= weekEnd
  }).length
  const upcoming = open
    .filter((reminder) => new Date(reminder.triggerAt) > endOfDay(now))
    .slice(0, 6)

  return (
    <div className="thin-scroll h-full overflow-y-auto px-8 pb-10">
      <PageHeader
        eyebrow={formatDateLong(now, language)}
        title={t(todayGreetingKey(now))}
        subtitle={t('today.subtitle')}
        actions={
          <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus size={14} />
            {t('reminders.new')}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <NextCard
          reminder={next}
          now={now}
          onComplete={completeReminder}
          onSnooze={snoozeReminder}
          onCreate={() => setDialogOpen(true)}
        />

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<AlarmClock size={16} />}
            value={today.length}
            label={t('today.waiting')}
            tone="accent"
          />
          <StatCard
            icon={<Check size={16} />}
            value={completedToday.length}
            label={t('today.completedToday')}
            tone="neutral"
          />
          <div className="col-span-2 rounded-2xl border border-line bg-surface px-4 py-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
              <CalendarDays size={13} />
              {t('today.week')}
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-[20px] font-semibold tracking-tight text-ink">{weekCount}</span>
              <span className="text-[12px] text-muted">{t('today.remindersLabel')}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('reminders')}
              className="mt-2 flex cursor-pointer items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
            >
              {t('today.viewAll')}
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold tracking-[-0.01em] text-ink">
          {t('today.schedule')}
        </h2>
        {today.length === 0 ? (
          <EmptyCard
            title={t('today.empty')}
            description={t('today.emptyDesc')}
            action={
              <Button size="sm" variant="secondary" onClick={() => setDialogOpen(true)}>
                <Plus size={14} />
                {t('reminders.new')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {today.map((reminder, index) => (
              <div
                key={reminder.id}
                className={cn(
                  'flex items-center gap-4 px-4 py-3.5',
                  index > 0 && 'border-t border-line/70',
                )}
              >
                <div className="w-[74px] shrink-0 text-right">
                  <p className="whitespace-nowrap font-mono text-[13px] font-medium text-ink">
                    {formatClock(reminder.triggerAt, language)}
                  </p>
                  <p className="whitespace-nowrap text-[10px] text-faint">
                    {formatRelative(reminder.triggerAt, language, now)}
                  </p>
                </div>
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    reminder.status === 'fired' ? 'bg-warm' : 'bg-accent',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">{reminder.content}</p>
                  <p className="mt-0.5 text-[11px] text-faint">{t(statusKey(reminder.status))}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void snoozeReminder(reminder.id, 10)}
                  >
                    <Clock3 size={13} />
                    +10
                  </Button>
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => void completeReminder(reminder.id)}
                  >
                    <Check size={13} />
                    {t('reminders.complete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold tracking-[-0.01em] text-ink">
          {t('today.upcoming')}
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-5 text-[12.5px] text-faint">
            {t('today.upcomingEmpty')}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {upcoming.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-faint">
                  <Clock3 size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">{reminder.content}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatDateShort(new Date(reminder.triggerAt), language)} ·{' '}
                    {formatClock(reminder.triggerAt, language)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ReminderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}

function NextCard({
  reminder,
  now,
  onComplete,
  onSnooze,
  onCreate,
}: {
  reminder: ReturnType<typeof selectOpenReminders>[number] | undefined
  now: Date
  onComplete: (id: string) => Promise<void>
  onSnooze: (id: string, minutes?: number) => Promise<void>
  onCreate: () => void
}): ReactNode {
  const { t, language } = useI18n()

  if (!reminder) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-5 py-6">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent/70 to-accent/10" />
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <SunMedium size={18} />
        </span>
        <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-ink">
          {t('today.noNext')}
        </h3>
        <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">
          {t('today.noNextDesc')}
        </p>
        <Button size="sm" variant="primary" className="mt-4" onClick={onCreate}>
          <Plus size={14} />
          {t('reminders.new')}
        </Button>
      </div>
    )
  }

  const overdue = new Date(reminder.triggerAt).getTime() < now.getTime()

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface px-5 py-5">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent/80 to-warm/40" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold tracking-[0.14em] text-faint uppercase">
            {t('today.nextUp')}
          </p>
          <p className="mt-1.5 font-mono text-[34px] leading-none font-semibold tracking-[-0.04em] text-ink">
            {formatClock(reminder.triggerAt, language)}
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted">
            {formatReminderWhen(reminder.triggerAt, language, now)} ·{' '}
            {formatRelative(reminder.triggerAt, language, now)}
          </p>
        </div>
        {overdue ? <Badge tone="warm">{t('reminder.overdue')}</Badge> : null}
      </div>

      <p className="mt-4 text-[16px] leading-snug font-medium tracking-[-0.01em] text-ink">
        {reminder.content}
      </p>

      <div className="mt-auto flex items-center gap-2 pt-5">
        <Button size="sm" variant="primary" onClick={() => void onComplete(reminder.id)}>
          <Check size={14} />
          {t('reminders.complete')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void onSnooze(reminder.id, 10)}>
          <Clock3 size={14} />
          {t('reminders.snooze')}
        </Button>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode
  value: number
  label: string
  tone: 'accent' | 'neutral'
}): ReactNode {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg',
          tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
        )}
      >
        {icon}
      </span>
      <p className="mt-2.5 text-[22px] font-semibold leading-none tracking-[-0.03em] text-ink">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  )
}

function EmptyCard({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}): ReactNode {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-line bg-surface/50 px-5 py-6">
      <h3 className="text-[13.5px] font-medium text-ink">{title}</h3>
      <p className="text-[12px] text-muted">{description}</p>
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  )
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

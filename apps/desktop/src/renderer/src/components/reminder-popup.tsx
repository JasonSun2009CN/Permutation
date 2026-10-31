import { Bell, Clock3, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { formatReminderWhen, formatRelative } from '../lib/format'
import { useI18n } from '../lib/use-i18n'
import { useAppStore } from '../store/app-store'
import { Badge, Button, IconButton } from './ui'

export function ReminderPopup(): ReactNode {
  const { t, language } = useI18n()
  const fired = useAppStore((state) => state.fired)
  const completeReminder = useAppStore((state) => state.completeReminder)
  const snoozeReminder = useAppStore((state) => state.snoozeReminder)
  const dismissReminder = useAppStore((state) => state.dismissReminder)
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000)
    return () => clearInterval(timer)
  }, [])

  const reminder = fired[0]
  if (!reminder) return null

  return (
    <div
      role="alertdialog"
      aria-label={t('popup.title')}
      className="fixed right-5 bottom-5 z-50 w-[360px] overflow-hidden rounded-2xl border border-line bg-surface shadow-card animate-rise"
    >
      <div className="h-1 w-full bg-accent" />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Bell size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
              {t('popup.title')}
            </p>
            <p className="text-[11.5px] text-muted">{t('popup.due')}</p>
          </div>
          {fired.length > 1 ? <Badge tone="accent">1 / {fired.length}</Badge> : null}
          <IconButton
            label={t('reminders.dismiss')}
            onClick={() => void dismissReminder(reminder.id)}
            className="h-7 w-7"
          >
            <X size={14} />
          </IconButton>
        </div>

        <p className="mt-3 text-[14.5px] leading-snug font-medium text-ink">{reminder.content}</p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-faint">
          <Clock3 size={12} />
          <span>{formatReminderWhen(reminder.triggerAt, language)}</span>
          <span>·</span>
          <span>{formatRelative(reminder.triggerAt, language)}</span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="px-2.5"
            onClick={() => void dismissReminder(reminder.id)}
          >
            {t('popup.dismiss')}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void snoozeReminder(reminder.id, 10)}
            >
              {t('popup.snooze')}
            </Button>
            <Button size="sm" variant="primary" onClick={() => void completeReminder(reminder.id)}>
              {t('popup.complete')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

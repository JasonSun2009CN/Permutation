import type { ReminderStatus } from '@permutation/shared'
import { localeFor, translate, type Language, type TKey } from './i18n'

export function formatClock(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDateLong(date: Date, language: Language): string {
  const day = new Intl.DateTimeFormat(localeFor(language), {
    month: 'long',
    day: 'numeric',
  }).format(date)
  const weekday = new Intl.DateTimeFormat(localeFor(language), {
    weekday: 'long',
  }).format(date)
  return `${day} · ${weekday}`
}

export function formatDateShort(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatRelative(iso: string, language: Language, now = new Date()): string {
  const target = new Date(iso)
  const diffMs = target.getTime() - now.getTime()
  const diffMinutes = Math.round(diffMs / 60_000)

  if (Math.abs(diffMinutes) < 1) return translate(language, 'reminder.now')
  if (diffMinutes > 0 && diffMinutes < 60) {
    return translate(language, 'reminder.inMinutes', { count: diffMinutes })
  }
  if (diffMinutes >= 60 && diffMinutes < 60 * 24) {
    return translate(language, 'reminder.inHours', { count: Math.round(diffMinutes / 60) })
  }
  if (diffMinutes >= 60 * 24) {
    return translate(language, 'reminder.inDays', { count: Math.round(diffMinutes / (60 * 24)) })
  }

  const overdue = Math.abs(diffMinutes)
  if (overdue < 60) {
    return translate(language, 'reminder.minutesAgo', { count: overdue })
  }
  if (overdue < 60 * 24) {
    return translate(language, 'reminder.hoursAgo', { count: Math.round(overdue / 60) })
  }
  return translate(language, 'reminder.daysAgo', { count: Math.round(overdue / (60 * 24)) })
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isTomorrow(date: Date, now = new Date()): boolean {
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  return isSameDay(date, tomorrow)
}

export function formatReminderWhen(iso: string, language: Language, now = new Date()): string {
  const date = new Date(iso)
  const time = formatClock(iso, language)
  if (isSameDay(date, now)) {
    return translate(language, 'reminder.todayAt', { time })
  }
  if (isTomorrow(date, now)) {
    return translate(language, 'reminder.tomorrowAt', { time })
  }
  return `${formatDateShort(date, language)} · ${time}`
}

export function statusKey(status: ReminderStatus): TKey {
  const map: Record<ReminderStatus, TKey> = {
    pending: 'reminder.status.pending',
    fired: 'reminder.status.fired',
    completed: 'reminder.status.completed',
    dismissed: 'reminder.status.dismissed',
    cancelled: 'reminder.status.cancelled',
  }
  return map[status]
}

export function toolLabelKey(name: string): TKey {
  const key = `tool.${name}` as TKey
  const known: TKey[] = [
    'tool.get_current_time',
    'tool.create_reminder',
    'tool.list_reminders',
    'tool.update_reminder',
    'tool.cancel_reminder',
    'tool.complete_reminder',
    'tool.snooze_reminder',
    'tool.send_notification',
    'tool.dismiss_reminder',
    'tool.reminder_fired',
  ]
  return known.includes(key) ? key : 'tool.details'
}

export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}

export function greetingKey(now = new Date()): TKey {
  const hour = now.getHours()
  if (hour < 12) return 'chat.emptyMorning'
  if (hour < 18) return 'chat.emptyAfternoon'
  return 'chat.emptyEvening'
}

export function todayGreetingKey(now = new Date()): TKey {
  const hour = now.getHours()
  if (hour < 12) return 'today.greetingMorning'
  if (hour < 18) return 'today.greetingAfternoon'
  return 'today.greetingEvening'
}

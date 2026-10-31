import type { Reminder } from '@permutation/shared'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { toLocalDateTimeInput } from '../lib/format'
import { useI18n } from '../lib/use-i18n'
import { useAppStore } from '../store/app-store'
import { Button, Field, inputClass, Modal } from './ui'

export function ReminderDialog({
  open,
  onClose,
  reminder,
}: {
  open: boolean
  onClose: () => void
  reminder?: Reminder | null
}): ReactNode {
  const { t } = useI18n()
  const createReminder = useAppStore((state) => state.createReminder)
  const updateReminder = useAppStore((state) => state.updateReminder)
  const [content, setContent] = useState('')
  const [when, setWhen] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    if (reminder) {
      setContent(reminder.content)
      setWhen(toLocalDateTimeInput(reminder.triggerAt))
    } else {
      const soon = new Date(Date.now() + 10 * 60_000)
      soon.setSeconds(0, 0)
      setContent('')
      setWhen(toLocalDateTimeInput(soon.toISOString()))
    }
  }, [open, reminder])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const trimmed = content.trim()
    const date = new Date(when)
    if (!trimmed) {
      setError(t('reminders.saveFailed'))
      return
    }
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now() - 60_000) {
      setError(t('reminders.invalidTime'))
      return
    }
    setSaving(true)
    setError(null)
    const iso = date.toISOString()
    const ok = reminder
      ? await updateReminder(reminder.id, { content: trimmed, triggerAt: iso })
      : await createReminder({ content: trimmed, triggerAt: iso, source: 'manual' })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={reminder ? t('reminders.editTitle') : t('reminders.newTitle')}
      width="max-w-md"
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Field label={t('reminders.contentLabel')} htmlFor="reminder-content">
          <input
            id="reminder-content"
            autoFocus
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t('reminders.contentPlaceholder')}
            maxLength={500}
            className={inputClass}
          />
        </Field>

        <Field
          label={t('reminders.timeLabel')}
          hint={t('reminders.timeHint')}
          htmlFor="reminder-time"
        >
          <input
            id="reminder-time"
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            className={inputClass}
          />
        </Field>

        {error ? <p className="text-[12px] text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

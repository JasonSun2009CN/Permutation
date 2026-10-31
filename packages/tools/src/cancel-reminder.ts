import { z } from 'zod'
import { serializeReminder } from './reminder-utils'
import { formatWhen, tr, type ToolDefinition } from './types'

const schema = z.object({
  id: z.string().min(1).describe('Reminder id to cancel.'),
})

type Args = z.infer<typeof schema>

export const cancelReminderTool: ToolDefinition = {
  name: 'cancel_reminder',
  description:
    'Cancel an existing reminder. This is a high-risk action: the app will ask the user to confirm before it runs. Use list_reminders first if you do not know the id.',
  parameters: schema,
  requiresConfirmation: true,
  describe: (args, context) => {
    const id = String((args as Partial<Args>).id ?? '')
    const existing = id ? context.db.reminders.get(id) : null
    return existing
      ? tr(
          context,
          `取消提醒“${existing.content}”（${formatWhen(existing.triggerAt, context)}）`,
          `Cancel reminder "${existing.content}" scheduled for ${formatWhen(existing.triggerAt, context)}`,
        )
      : tr(context, `取消提醒 ${id}`, `Cancel reminder ${id}`)
  },
  execute: (args, context) => {
    const { id } = args as Args
    const existing = context.db.reminders.get(id)
    if (!existing) throw new Error(`Reminder not found: ${id}`)
    const reminder = context.db.reminders.cancel(id, context.now())
    return {
      result: { ok: true, cancelled: serializeReminder(reminder) },
      summary: tr(
        context,
        `已取消提醒“${reminder.content}”。`,
        `Cancelled reminder "${reminder.content}".`,
      ),
    }
  },
}

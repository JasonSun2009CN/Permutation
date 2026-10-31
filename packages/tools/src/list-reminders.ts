import { isZonedIso, type ReminderStatus } from '@permutation/shared'
import { z } from 'zod'
import { serializeReminder } from './reminder-utils'
import { tr, type ToolDefinition } from './types'

export type ReminderStatusFilter = ReminderStatus | 'open' | 'all'

const schema = z.object({
  status: z
    .enum(['open', 'pending', 'fired', 'completed', 'dismissed', 'cancelled', 'all'])
    .default('open')
    .describe('Which reminders to include. "open" means pending or fired and awaiting action.'),
  from: z
    .string()
    .refine(isZonedIso, { message: 'from must include a timezone offset' })
    .optional()
    .describe('Optional lower bound on trigger time, ISO 8601 with offset.'),
  to: z
    .string()
    .refine(isZonedIso, { message: 'to must include a timezone offset' })
    .optional()
    .describe('Optional upper bound on trigger time, ISO 8601 with offset.'),
  limit: z.number().int().min(1).max(100).default(20),
})

type Args = z.infer<typeof schema>

export const listRemindersTool: ToolDefinition = {
  name: 'list_reminders',
  description:
    'List reminders in chronological order. Use it to find a reminder id before updating, completing, snoozing, or cancelling. Defaults to open reminders.',
  parameters: schema,
  requiresConfirmation: false,
  describe: (_args, context) => tr(context, '查询提醒列表', 'List reminders'),
  execute: (args, context) => {
    const { status, from, to, limit } = args as Args
    const reminders = context.db.reminders.list({
      status: status as ReminderStatusFilter,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      limit,
    })
    return {
      result: {
        ok: true,
        count: reminders.length,
        reminders: reminders.map(serializeReminder),
      },
      summary:
        reminders.length === 0
          ? tr(context, '没有找到符合条件的提醒。', 'No matching reminders were found.')
          : tr(
              context,
              `找到 ${reminders.length} 个提醒。`,
              `Found ${reminders.length} reminder${reminders.length === 1 ? '' : 's'}.`,
            ),
    }
  },
}

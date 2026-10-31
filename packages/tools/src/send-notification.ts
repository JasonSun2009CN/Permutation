import { z } from 'zod'
import { tr, type ToolDefinition } from './types'

const schema = z.object({
  title: z.string().min(1).max(120).describe('Notification title.'),
  body: z.string().min(1).max(500).describe('Notification body text.'),
})

type Args = z.infer<typeof schema>

export const sendNotificationTool: ToolDefinition = {
  name: 'send_notification',
  description:
    'Send a desktop notification immediately. Use it only when the user explicitly asks for a notification or for a message that should interrupt them; scheduled reminders use create_reminder instead.',
  parameters: schema,
  requiresConfirmation: false,
  describe: (args, context) => {
    const parsed = args as Partial<Args>
    return tr(
      context,
      `发送通知“${parsed.title ?? ''}”`,
      `Send notification "${parsed.title ?? ''}"`,
    )
  },
  execute: (args, context) => {
    const { title, body } = args as Args
    context.notify({ title, body })
    return {
      result: { ok: true },
      summary: tr(context, '已发送系统通知。', 'Sent a system notification.'),
    }
  },
}

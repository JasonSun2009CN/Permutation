import { toOffsetIso } from '@permutation/shared'
import { z } from 'zod'
import { tr, type ToolDefinition } from './types'

export const getCurrentTimeTool: ToolDefinition = {
  name: 'get_current_time',
  description:
    'Return the current date, time, timezone, and weekday. You MUST call this before interpreting any relative time expression (e.g. "in ten minutes", "tomorrow at 3pm", "下午三点"), and before creating or updating reminders based on such expressions.',
  parameters: z.object({}),
  requiresConfirmation: false,
  describe: (_args, context) => tr(context, '读取当前时间', 'Read the current time'),
  execute: (_args, context) => {
    const now = context.now()
    return {
      result: {
        ok: true,
        iso: toOffsetIso(now, context.timeZone),
        epochMs: now.getTime(),
        timeZone: context.timeZone,
        weekday: new Intl.DateTimeFormat(context.locale, {
          timeZone: context.timeZone,
          weekday: 'long',
        }).format(now),
        locale: context.locale,
      },
      summary: tr(context, '读取了当前时间。', 'Read the current time.'),
    }
  },
}

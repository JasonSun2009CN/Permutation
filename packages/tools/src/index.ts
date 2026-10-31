import { getCurrentTimeTool } from './get-current-time'
import { createReminderTool } from './create-reminder'
import { listRemindersTool } from './list-reminders'
import { updateReminderTool } from './update-reminder'
import { cancelReminderTool } from './cancel-reminder'
import { completeReminderTool } from './complete-reminder'
import { snoozeReminderTool } from './snooze-reminder'
import { sendNotificationTool } from './send-notification'
import type { ToolDefinition } from './types'

export const defaultTools: ToolDefinition[] = [
  getCurrentTimeTool,
  createReminderTool,
  listRemindersTool,
  updateReminderTool,
  cancelReminderTool,
  completeReminderTool,
  snoozeReminderTool,
  sendNotificationTool,
]

export { ToolRegistry } from './registry'
export type { ToolRegistryOptions } from './registry'
export * from './types'
export * from './reminder-utils'
export * from './get-current-time'
export * from './create-reminder'
export * from './list-reminders'
export * from './update-reminder'
export * from './cancel-reminder'
export * from './complete-reminder'
export * from './snooze-reminder'
export * from './send-notification'

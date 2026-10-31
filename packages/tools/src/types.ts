import type { PermutationDatabase } from '@permutation/db'
import type { z } from 'zod'

export interface ToolContext {
  db: PermutationDatabase
  now: () => Date
  timeZone: string
  locale: string
  language: 'zh' | 'en'
  notify: (input: { title: string; body: string }) => void
}

export interface ToolExecution {
  result: unknown
  summary: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: z.ZodType
  /** High-risk tools pause for an explicit user confirmation. */
  requiresConfirmation: boolean
  describe: (args: Record<string, unknown>, context: ToolContext) => string
  execute: (
    args: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<ToolExecution> | ToolExecution
}

export function tr(context: ToolContext, zh: string, en: string): string {
  return context.language === 'zh' ? zh : en
}

export function formatWhen(iso: string, context: ToolContext): string {
  return new Intl.DateTimeFormat(context.locale, {
    timeZone: context.timeZone,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

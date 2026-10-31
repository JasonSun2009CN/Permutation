import {
  type ToolCallStatus,
  type ToolExecutionOutcome,
  type ToolRuntime,
} from '@permutation/shared'
import type { PermutationDatabase } from '@permutation/db'
import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'

export interface ToolRegistryOptions {
  db: PermutationDatabase
  now?: () => Date
  timeZone: string
  locale: string
  language: 'zh' | 'en'
  notify: (input: { title: string; body: string }) => void
}

function toJsonSchema(definition: ToolDefinition): Record<string, unknown> {
  const schema = z.toJSONSchema(definition.parameters, { io: 'input' }) as Record<string, unknown>
  delete schema.$schema
  return schema
}

export class ToolRegistry implements ToolRuntime {
  private readonly tools = new Map<string, ToolDefinition>()
  private readonly specsCache: ReturnType<ToolRuntime['specs']>
  private readonly context: () => ToolContext

  constructor(
    private readonly options: ToolRegistryOptions,
    definitions: ToolDefinition[],
  ) {
    for (const definition of definitions) {
      this.tools.set(definition.name, definition)
    }
    this.specsCache = definitions.map((definition) => ({
      name: definition.name,
      description: definition.description,
      parameters: toJsonSchema(definition),
    }))
    this.context = () => ({
      db: this.options.db,
      now: this.options.now ?? (() => new Date()),
      timeZone: this.options.timeZone,
      locale: this.options.locale,
      language: this.options.language,
      notify: this.options.notify,
    })
  }

  specs(): ReturnType<ToolRuntime['specs']> {
    return this.specsCache
  }

  describe(name: string, args: Record<string, unknown>): string {
    const definition = this.tools.get(name)
    if (!definition) return name
    try {
      return definition.describe(args, this.context())
    } catch {
      return name
    }
  }

  requiresConfirmation(name: string, args: Record<string, unknown>): boolean {
    void args
    return this.tools.get(name)?.requiresConfirmation ?? false
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    execution: { confirmed: boolean | null; signal: AbortSignal; conversationId: string },
  ): Promise<ToolExecutionOutcome> {
    const startedAt = Date.now()
    const context = this.context()
    const definition = this.tools.get(name)

    if (!definition) {
      const result = { ok: false, error: `Unknown tool: ${name}` }
      this.log(
        name,
        args,
        result,
        'error',
        execution.confirmed,
        startedAt,
        execution.conversationId,
      )
      return {
        status: 'error',
        result,
        summary: `Unknown tool: ${name}`,
        durationMs: Date.now() - startedAt,
      }
    }

    if (definition.requiresConfirmation && execution.confirmed === false) {
      const result = {
        ok: false,
        error: 'The user denied this action. It was not executed.',
        denied: true,
      }
      const summary = definition.describe(args, context)
      this.log(name, args, result, 'denied', false, startedAt, execution.conversationId)
      return { status: 'denied', result, summary, durationMs: Date.now() - startedAt }
    }

    const parsed = definition.parameters.safeParse(args)
    if (!parsed.success) {
      const details = parsed.error.issues.slice(0, 4).map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      const result = {
        ok: false,
        error: 'Invalid tool arguments.',
        details,
        hint: 'Use ISO 8601 timestamps with an explicit timezone offset. Call get_current_time before relative times.',
      }
      const summary =
        this.options.language === 'zh'
          ? '工具参数无效，操作未执行。'
          : 'Tool arguments were invalid, so nothing was executed.'
      this.log(
        name,
        args,
        result,
        'error',
        execution.confirmed,
        startedAt,
        execution.conversationId,
      )
      return { status: 'error', result, summary, durationMs: Date.now() - startedAt }
    }

    try {
      const executionResult = await definition.execute(
        parsed.data as Record<string, unknown>,
        context,
      )
      const confirmed = definition.requiresConfirmation ? execution.confirmed === true : null
      this.log(
        name,
        args,
        executionResult.result,
        'ok',
        confirmed,
        startedAt,
        execution.conversationId,
      )
      return {
        status: 'ok',
        result: executionResult.result,
        summary: executionResult.summary,
        durationMs: Date.now() - startedAt,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const result = { ok: false, error: message }
      const summary =
        this.options.language === 'zh' ? `操作失败：${message}` : `Action failed: ${message}`
      this.log(
        name,
        args,
        result,
        'error',
        execution.confirmed,
        startedAt,
        execution.conversationId,
      )
      return {
        status: 'error',
        result,
        summary,
        durationMs: Date.now() - startedAt,
      }
    }
  }

  /** Records actions that originate outside the agent loop (UI, notifications). */
  record(input: {
    toolName: string
    args: unknown
    result: unknown
    status: ToolCallStatus
    confirmed: boolean | null
    durationMs: number
    source: 'ui' | 'notification' | 'system' | 'chat'
    conversationId?: string | null
  }): void {
    this.options.db.logs.add(input)
  }

  private log(
    toolName: string,
    args: unknown,
    result: unknown,
    status: ToolCallStatus,
    confirmed: boolean | null,
    startedAt: number,
    conversationId: string,
  ): void {
    this.options.db.logs.add({
      toolName,
      args,
      result,
      status,
      confirmed,
      durationMs: Date.now() - startedAt,
      source: 'chat',
      conversationId,
    })
  }
}

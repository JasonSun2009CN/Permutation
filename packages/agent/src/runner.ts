import {
  CONFIRMATION_TTL_MS,
  MAX_CONTEXT_MESSAGES,
  newId,
  type AgentEvent,
  type ConfirmationRequest,
  type LLMMessage,
  type LLMProvider,
  type StoredMessage,
  type ToolRuntime,
  type ToolTrace,
} from '@permutation/shared'
import { ProviderError } from './providers/errors'
import { buildSystemPrompt } from './prompts/system'

export type AgentErrorCode = 'cancelled' | 'max_steps' | 'provider_error' | 'unknown'

export class AgentError extends Error {
  readonly code: AgentErrorCode

  constructor(message: string, code: AgentErrorCode) {
    super(message)
    this.name = 'AgentError'
    this.code = code
  }
}

export interface AgentRunInput {
  runId: string
  conversationId: string
  userMessage: StoredMessage
  history: StoredMessage[]
  provider: LLMProvider
  runtime: ToolRuntime
  maxSteps: number
  signal: AbortSignal
  timeZone: string
  locale: string
  language: 'zh' | 'en'
  now: () => Date
  requestConfirmation: (request: ConfirmationRequest) => Promise<boolean>
  onEvent: (event: AgentEvent) => void
  saveAssistant: (input: { content: string; tools: ToolTrace[] }) => StoredMessage
}

export interface AgentRunResult {
  text: string
  message: StoredMessage
  traces: ToolTrace[]
  steps: number
}

function historyToMessages(history: StoredMessage[]): LLMMessage[] {
  return history.slice(-MAX_CONTEXT_MESSAGES).map((message) => {
    if (message.role === 'user') {
      return { role: 'user', content: message.content }
    }
    const actions =
      message.tools.length > 0
        ? `\n\n[Previous actions: ${message.tools
            .map((trace) => `${trace.name} (${trace.status}) — ${trace.summary}`)
            .join('; ')}]`
        : ''
    return { role: 'assistant', content: `${message.content}${actions}` }
  })
}

function parseArguments(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function errorCodeFor(error: unknown): AgentErrorCode {
  if (error instanceof AgentError) return error.code
  if (error instanceof ProviderError) {
    return error.code === 'aborted' ? 'cancelled' : 'provider_error'
  }
  return 'unknown'
}

function errorMessageFor(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const {
    runId,
    conversationId,
    userMessage,
    history,
    provider,
    runtime,
    signal,
    onEvent,
    timeZone,
    locale,
    language,
  } = input

  const traces: ToolTrace[] = []
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        now: input.now(),
        timeZone,
        locale,
        language,
      }),
    },
    ...historyToMessages(history),
    { role: 'user', content: userMessage.content },
  ]

  onEvent({ type: 'run_started', runId, conversationId, userMessage })

  try {
    for (let step = 0; step < input.maxSteps; step += 1) {
      if (signal.aborted) throw new AgentError('Run was cancelled', 'cancelled')

      const response = await provider.chat({
        messages,
        tools: runtime.specs(),
        signal,
      })

      if (response.toolCalls.length === 0) {
        const text = response.text.trim() || 'Done.'
        const message = input.saveAssistant({ content: text, tools: traces })
        onEvent({ type: 'assistant_message', runId, conversationId, message })
        onEvent({ type: 'run_finished', runId, conversationId })
        return { text, message, traces, steps: step + 1 }
      }

      messages.push({
        role: 'assistant',
        content: response.text,
        toolCalls: response.toolCalls,
      })

      for (const call of response.toolCalls) {
        if (signal.aborted) throw new AgentError('Run was cancelled', 'cancelled')
        const args = parseArguments(call.argumentsJson)
        const startedAt = Date.now()
        onEvent({
          type: 'tool_started',
          runId,
          conversationId,
          callId: call.id,
          name: call.name,
          args,
        })

        let confirmed: boolean | null = null
        if (runtime.requiresConfirmation(call.name, args)) {
          const request: ConfirmationRequest = {
            id: newId('cfm'),
            runId,
            toolName: call.name,
            summary: runtime.describe(call.name, args),
            args,
            risk: 'high',
            expiresAt: new Date(input.now().getTime() + CONFIRMATION_TTL_MS).toISOString(),
          }
          onEvent({
            type: 'confirmation_required',
            runId,
            conversationId,
            request,
          })
          confirmed = await input.requestConfirmation(request)
          onEvent({
            type: 'confirmation_resolved',
            runId,
            conversationId,
            confirmationId: request.id,
            approved: confirmed,
          })
        }

        const outcome = await runtime.execute(call.name, args, {
          confirmed,
          signal,
          conversationId,
        })
        const durationMs = Date.now() - startedAt

        traces.push({
          callId: call.id,
          name: call.name,
          args,
          status: outcome.status,
          summary: outcome.summary,
          durationMs,
        })

        onEvent({
          type: 'tool_finished',
          runId,
          conversationId,
          callId: call.id,
          name: call.name,
          status: outcome.status,
          summary: outcome.summary,
          result: outcome.result,
          durationMs,
        })

        messages.push({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          content: JSON.stringify(outcome.result),
        })
      }
    }

    throw new AgentError(
      `The assistant exceeded the maximum of ${input.maxSteps} tool steps without finishing.`,
      'max_steps',
    )
  } catch (error) {
    onEvent({
      type: 'run_failed',
      runId,
      conversationId,
      message: errorMessageFor(error),
      code: errorCodeFor(error),
    })
    throw error
  }
}

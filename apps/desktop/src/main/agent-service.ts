import { createProvider, runAgent, ProviderError } from '@permutation/agent'
import type { PermutationDatabase } from '@permutation/db'
import type { ReminderScheduler } from '@permutation/scheduler'
import { defaultTools, ToolRegistry } from '@permutation/tools'
import {
  CONFIRMATION_TTL_MS,
  MAX_CONTEXT_MESSAGES,
  newId,
  type ChatSendInput,
  type ChatSendResult,
  type ConfirmationRequest,
  type Conversation,
  type LLMProvider,
  type StoredMessage,
  type ToolTrace,
} from '@permutation/shared'
import { broadcast } from './events'
import type { Notifier } from './notifier'
import type { SettingsService } from './settings'

interface AgentServiceDeps {
  db: PermutationDatabase
  settings: SettingsService
  scheduler: ReminderScheduler
  notifier: Notifier
  onRemindersChanged: () => void
}

interface RunState {
  controller: AbortController
  confirmations: Map<string, { finish: (approved: boolean) => void }>
}

export class AgentService {
  private readonly runs = new Map<string, RunState>()

  constructor(private readonly deps: AgentServiceDeps) {}

  async send(input: ChatSendInput): Promise<ChatSendResult> {
    const text = input.text.trim()
    if (!text) throw new Error('Message cannot be empty')
    if (text.length > 4000) throw new Error('Message is too long (maximum 4000 characters)')

    // Fail before creating a conversation so a missing key never leaves an
    // empty thread behind.
    const providerConfig = this.deps.settings.providerConfig()
    const provider = createProvider(providerConfig)

    const conversation =
      (input.conversationId ? this.deps.db.conversations.get(input.conversationId) : null) ??
      this.deps.db.conversations.create(text.slice(0, 60))

    const history = this.deps.db.messages.recent(conversation.id, MAX_CONTEXT_MESSAGES)
    const userMessage = this.deps.db.messages.add({
      conversationId: conversation.id,
      role: 'user',
      content: text,
    })
    this.deps.db.conversations.touch(conversation.id)
    broadcast({ type: 'conversations_changed' })

    const runId = newId('run')
    const run: RunState = {
      controller: new AbortController(),
      confirmations: new Map(),
    }
    this.runs.set(runId, run)

    void this.execute({ runId, run, conversation, history, userMessage, provider })

    return { runId, conversationId: conversation.id, userMessage }
  }

  cancel(runId: string): void {
    const run = this.runs.get(runId)
    if (!run) return
    run.controller.abort()
    for (const confirmation of run.confirmations.values()) {
      confirmation.finish(false)
    }
    run.confirmations.clear()
  }

  respondConfirmation(confirmationId: string, approved: boolean): void {
    for (const run of this.runs.values()) {
      const pending = run.confirmations.get(confirmationId)
      if (pending) {
        pending.finish(approved)
        return
      }
    }
  }

  private async execute(input: {
    runId: string
    run: RunState
    conversation: Conversation
    history: StoredMessage[]
    userMessage: StoredMessage
    provider: LLMProvider
  }): Promise<void> {
    const { runId, run, conversation, history, userMessage, provider } = input
    const settings = this.deps.settings.get()
    const language = this.deps.settings.language()
    const locale = this.deps.settings.locale()

    const registry = new ToolRegistry(
      {
        db: this.deps.db,
        now: () => new Date(),
        timeZone: settings.timezone,
        locale,
        language,
        notify: (notification) => {
          this.deps.notifier.notify(notification.title, notification.body)
        },
      },
      defaultTools,
    )

    try {
      await runAgent({
        runId,
        conversationId: conversation.id,
        userMessage,
        history,
        provider,
        runtime: registry,
        maxSteps: settings.maxAgentSteps,
        signal: run.controller.signal,
        timeZone: settings.timezone,
        locale,
        language,
        now: () => new Date(),
        requestConfirmation: (request: ConfirmationRequest) =>
          this.awaitConfirmation(run, request, run.controller.signal),
        onEvent: broadcast,
        saveAssistant: ({ content, tools }: { content: string; tools: ToolTrace[] }) => {
          const message = this.deps.db.messages.add({
            conversationId: conversation.id,
            role: 'assistant',
            content,
            tools,
          })
          this.deps.db.conversations.touch(conversation.id)
          return message
        },
      })
    } catch (error) {
      if (!(error instanceof ProviderError && error.code === 'aborted')) {
        console.error('[agent] run failed', error)
      }
    } finally {
      this.runs.delete(runId)
      broadcast({ type: 'conversations_changed' })
      broadcast({ type: 'reminders_changed' })
      this.deps.onRemindersChanged()
      void this.deps.scheduler.checkNow()
    }
  }

  private awaitConfirmation(
    run: RunState,
    request: ConfirmationRequest,
    signal: AbortSignal,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (approved: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        run.confirmations.delete(request.id)
        resolve(approved)
      }
      const onAbort = () => finish(false)
      const timer = setTimeout(() => finish(false), CONFIRMATION_TTL_MS)
      signal.addEventListener('abort', onAbort, { once: true })
      run.confirmations.set(request.id, { finish })
    })
  }
}

import { describe, expect, it } from 'vitest'
import { ProviderError, runAgent, type AgentRunInput } from '@permutation/agent'
import type {
  AgentEvent,
  LLMChatRequest,
  LLMChatResponse,
  LLMProvider,
  StoredMessage,
  ToolRuntime,
} from '@permutation/shared'

class FakeProvider implements LLMProvider {
  readonly id = 'fake'
  readonly calls: LLMChatRequest[] = []

  constructor(private readonly responses: LLMChatResponse[]) {}

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    this.calls.push(request)
    const response = this.responses.shift()
    if (!response) throw new ProviderError('No scripted response left', 'invalid_response')
    return response
  }

  async ping(): Promise<{ text: string; latencyMs: number }> {
    return { text: 'OK', latencyMs: 1 }
  }
}

class FakeRuntime implements ToolRuntime {
  readonly calls: Array<{
    name: string
    args: Record<string, unknown>
    confirmed: boolean | null
  }> = []

  constructor(private readonly confirmationRequired = false) {}

  specs() {
    return [
      {
        name: 'create_reminder',
        description: 'Create a reminder',
        parameters: { type: 'object' },
      },
    ]
  }

  describe(name: string): string {
    return `${name} needs approval`
  }

  requiresConfirmation(): boolean {
    return this.confirmationRequired
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    options: { confirmed: boolean | null },
  ) {
    this.calls.push({ name, args, confirmed: options.confirmed })
    if (options.confirmed === false) {
      return {
        status: 'denied' as const,
        result: { ok: false, error: 'User denied' },
        summary: 'Denied',
        durationMs: 1,
      }
    }
    return {
      status: 'ok' as const,
      result: { ok: true, reminder: { id: 'rem_1', content: args.content } },
      summary: 'Created reminder',
      durationMs: 1,
    }
  }
}

const userMessage: StoredMessage = {
  id: 'msg_user',
  conversationId: 'conv_1',
  role: 'user',
  content: '十分钟后提醒我喝水',
  tools: [],
  createdAt: '2026-10-31T06:00:00.000Z',
}

function makeInput(
  overrides: Partial<AgentRunInput> & {
    provider: LLMProvider
    runtime: ToolRuntime
    events: AgentEvent[]
  },
): AgentRunInput {
  const { events, ...rest } = overrides
  return {
    runId: 'run_1',
    conversationId: 'conv_1',
    userMessage,
    history: [],
    maxSteps: 5,
    signal: new AbortController().signal,
    timeZone: 'Asia/Shanghai',
    locale: 'zh-CN',
    language: 'zh',
    now: () => new Date('2026-10-31T14:00:00+08:00'),
    requestConfirmation: async () => true,
    onEvent: (event) => events.push(event),
    saveAssistant: ({ content, tools }) => ({
      id: 'msg_assistant',
      conversationId: 'conv_1',
      role: 'assistant',
      content,
      tools,
      createdAt: '2026-10-31T06:00:01.000Z',
    }),
    ...rest,
  }
}

describe('agent loop', () => {
  it('executes a tool call and returns the final answer', async () => {
    const events: AgentEvent[] = []
    const provider = new FakeProvider([
      {
        text: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'create_reminder',
            argumentsJson: JSON.stringify({
              content: '喝水',
              triggerAt: '2026-10-31T14:10:00+08:00',
            }),
          },
        ],
      },
      { text: '已为你安排 14:10 的喝水提醒。', toolCalls: [] },
    ])
    const runtime = new FakeRuntime()

    const result = await runAgent(makeInput({ provider, runtime, events }))

    expect(result.text).toContain('喝水提醒')
    expect(runtime.calls).toEqual([
      {
        name: 'create_reminder',
        args: { content: '喝水', triggerAt: '2026-10-31T14:10:00+08:00' },
        confirmed: null,
      },
    ])
    expect(events.map((event) => event.type)).toEqual([
      'run_started',
      'tool_started',
      'tool_finished',
      'assistant_message',
      'run_finished',
    ])

    const toolMessage = provider.calls[1]?.messages.at(-1)
    expect(toolMessage?.role).toBe('tool')
    expect(toolMessage?.content).toContain('rem_1')
  })

  it('injects the current time and timezone into the system prompt', async () => {
    const provider = new FakeProvider([{ text: 'Hello', toolCalls: [] }])
    await runAgent(makeInput({ provider, runtime: new FakeRuntime(), events: [] }))

    const system = provider.calls[0]?.messages[0]
    expect(system?.role).toBe('system')
    expect(system?.content).toContain('2026-10-31T14:00:00+08:00')
    expect(system?.content).toContain('Asia/Shanghai')
  })

  it('passes previous tool summaries into the next turn', async () => {
    const provider = new FakeProvider([{ text: '好的', toolCalls: [] }])
    const history: StoredMessage[] = [
      {
        id: 'msg_previous',
        conversationId: 'conv_1',
        role: 'assistant',
        content: '提醒已创建。',
        tools: [
          {
            callId: 'call_old',
            name: 'create_reminder',
            args: { content: '交报告' },
            status: 'ok',
            summary: 'Created reminder 交报告',
          },
        ],
        createdAt: '2026-10-31T05:00:00.000Z',
      },
    ]
    await runAgent(makeInput({ provider, runtime: new FakeRuntime(), events: [], history }))

    const assistantContext = provider.calls[0]?.messages.find(
      (message) => message.role === 'assistant',
    )
    expect(assistantContext?.content).toContain('Previous actions')
    expect(assistantContext?.content).toContain('交报告')
  })

  it('pauses for confirmation and never executes a denied action silently', async () => {
    const events: AgentEvent[] = []
    const provider = new FakeProvider([
      {
        text: '',
        toolCalls: [
          { id: 'call_cancel', name: 'cancel_reminder', argumentsJson: '{"id":"rem_1"}' },
        ],
      },
      { text: '好的，已取消。', toolCalls: [] },
    ])
    const runtime = new FakeRuntime(true)

    await runAgent(
      makeInput({
        provider,
        runtime,
        events,
        requestConfirmation: async () => false,
      }),
    )

    expect(runtime.calls[0]?.confirmed).toBe(false)
    expect(events.some((event) => event.type === 'confirmation_required')).toBe(true)
    expect(events.some((event) => event.type === 'confirmation_resolved')).toBe(true)
    const toolTrace = events.find((event) => event.type === 'tool_finished')
    expect(toolTrace && toolTrace.type === 'tool_finished' ? toolTrace.status : null).toBe('denied')
  })

  it('stops after the maximum number of steps and reports a failure', async () => {
    const events: AgentEvent[] = []
    const provider = new FakeProvider(
      Array.from({ length: 5 }, () => ({
        text: '',
        toolCalls: [
          {
            id: 'call_loop',
            name: 'create_reminder',
            argumentsJson: '{"content":"loop"}',
          },
        ],
      })),
    )

    await expect(
      runAgent(makeInput({ provider, runtime: new FakeRuntime(), events, maxSteps: 2 })),
    ).rejects.toThrow(/maximum of 2/)

    const failed = events.find((event) => event.type === 'run_failed')
    expect(failed && failed.type === 'run_failed' ? failed.code : null).toBe('max_steps')
  })

  it('surfaces provider failures as run_failed events', async () => {
    const events: AgentEvent[] = []
    const provider = new FakeProvider([])

    await expect(
      runAgent(makeInput({ provider, runtime: new FakeRuntime(), events })),
    ).rejects.toThrow(/No scripted response/)

    const failed = events.find((event) => event.type === 'run_failed')
    expect(failed && failed.type === 'run_failed' ? failed.code : null).toBe('provider_error')
  })
})

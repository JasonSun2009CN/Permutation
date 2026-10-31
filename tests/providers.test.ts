import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AnthropicProvider,
  OpenAICompatibleProvider,
  resolveAnthropicUrl,
  resolveOpenAIUrl,
  toAnthropicMessages,
} from '@permutation/agent'
import type { LLMMessage, ProviderConfig } from '@permutation/shared'

const baseConfig: ProviderConfig = {
  protocol: 'openai',
  baseUrl: 'https://example.com/v1',
  model: 'test-model',
  temperature: 0.2,
  apiKey: 'test-key',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('provider URL resolution', () => {
  it('resolves OpenAI-compatible endpoints', () => {
    expect(resolveOpenAIUrl('https://api.deepseek.com/v1')).toBe(
      'https://api.deepseek.com/v1/chat/completions',
    )
    expect(resolveOpenAIUrl('https://example.com')).toBe('https://example.com/v1/chat/completions')
    expect(resolveOpenAIUrl('https://example.com/v1/chat/completions/')).toBe(
      'https://example.com/v1/chat/completions',
    )
  })

  it('resolves Anthropic endpoints', () => {
    expect(resolveAnthropicUrl('https://api.anthropic.com')).toBe(
      'https://api.anthropic.com/v1/messages',
    )
    expect(resolveAnthropicUrl('https://api.anthropic.com/v1')).toBe(
      'https://api.anthropic.com/v1/messages',
    )
    expect(resolveAnthropicUrl('https://proxy.example.com/v1/messages')).toBe(
      'https://proxy.example.com/v1/messages',
    )
  })
})

describe('OpenAI-compatible provider', () => {
  it('sends messages and tools, then parses tool calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Let me check.',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'get_current_time', arguments: '{}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OpenAICompatibleProvider(baseConfig)
    const result = await provider.chat({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'What time is it?' },
      ],
      tools: [
        {
          name: 'get_current_time',
          description: 'Get the time',
          parameters: { type: 'object', properties: {} },
        },
      ],
    })

    expect(result.text).toBe('Let me check.')
    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'get_current_time', argumentsJson: '{}' },
    ])

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://example.com/v1/chat/completions')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.model).toBe('test-model')
    expect(body.tool_choice).toBe('auto')
    expect((body.tools as Array<Record<string, unknown>>)[0]).toMatchObject({
      type: 'function',
    })
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key')
  })

  it('turns tool results into OpenAI tool messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'done' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new OpenAICompatibleProvider(baseConfig)

    await provider.chat({
      messages: [
        { role: 'user', content: 'hi' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'get_current_time', argumentsJson: '{}' }],
        },
        {
          role: 'tool',
          toolCallId: 'call_1',
          toolName: 'get_current_time',
          content: '{"ok":true}',
        },
      ],
      tools: [],
    })

    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as {
      messages: Array<Record<string, unknown>>
    }
    expect(body.messages[1]).toMatchObject({
      role: 'assistant',
      tool_calls: [{ id: 'call_1', type: 'function' }],
    })
    expect(body.messages[2]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_1',
      content: '{"ok":true}',
    })
  })
})

describe('Anthropic provider', () => {
  it('converts system, tool_use and consecutive tool_result blocks', () => {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'System A' },
      { role: 'system', content: 'System B' },
      { role: 'user', content: 'Do two things' },
      {
        role: 'assistant',
        content: 'Working',
        toolCalls: [
          { id: 'toolu_1', name: 'create_reminder', argumentsJson: '{"content":"a"}' },
          { id: 'toolu_2', name: 'create_reminder', argumentsJson: '{"content":"b"}' },
        ],
      },
      { role: 'tool', toolCallId: 'toolu_1', toolName: 'create_reminder', content: '{"ok":true}' },
      { role: 'tool', toolCallId: 'toolu_2', toolName: 'create_reminder', content: '{"ok":true}' },
    ]

    const converted = toAnthropicMessages(messages)
    expect(converted.system).toBe('System A\n\nSystem B')
    expect(converted.messages).toHaveLength(3)
    expect(converted.messages[1]?.content).toEqual([
      { type: 'text', text: 'Working' },
      { type: 'tool_use', id: 'toolu_1', name: 'create_reminder', input: { content: 'a' } },
      { type: 'tool_use', id: 'toolu_2', name: 'create_reminder', input: { content: 'b' } },
    ])
    expect(converted.messages[2]).toMatchObject({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_1' },
        { type: 'tool_result', tool_use_id: 'toolu_2' },
      ],
    })
  })

  it('parses Anthropic content blocks and sends the right headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: 'Checking.' },
          { type: 'tool_use', id: 'toolu_1', name: 'get_current_time', input: {} },
        ],
        stop_reason: 'tool_use',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new AnthropicProvider({
      ...baseConfig,
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
    })
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'What time is it?' }],
      tools: [
        {
          name: 'get_current_time',
          description: 'Get the time',
          parameters: { type: 'object', properties: {} },
        },
      ],
    })

    expect(result.text).toBe('Checking.')
    expect(result.toolCalls).toEqual([
      { id: 'toolu_1', name: 'get_current_time', argumentsJson: '{}' },
    ])

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key')
    expect((init.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.max_tokens).toBe(4096)
    expect((body.tools as Array<Record<string, unknown>>)[0]).toMatchObject({
      name: 'get_current_time',
    })
    expect((body.tools as Array<Record<string, unknown>>)[0]).toHaveProperty('input_schema')
  })
})

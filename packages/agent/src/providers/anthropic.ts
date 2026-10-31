import type {
  LLMChatRequest,
  LLMChatResponse,
  LLMMessage,
  LLMProvider,
  ProviderConfig,
} from '@permutation/shared'
import { ProviderError } from './errors'
import { postJson } from './http'

const ANTHROPIC_VERSION = '2023-06-01'
const MAX_TOKENS = 4096

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicBlock[]
}

interface AnthropicResponse {
  content?: Array<{
    type?: string
    text?: string
    id?: string
    name?: string
    input?: unknown
  }>
  stop_reason?: string
}

export function resolveAnthropicUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new ProviderError('Base URL is required', 'config')
  if (trimmed.endsWith('/v1/messages')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/messages`
  return `${trimmed}/v1/messages`
}

function parseArguments(json: string): Record<string, unknown> {
  try {
    const value = JSON.parse(json) as unknown
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function toAnthropicMessages(messages: LLMMessage[]): {
  system: string
  messages: AnthropicMessage[]
} {
  const systemParts: string[] = []
  const converted: AnthropicMessage[] = []

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content)
      continue
    }

    if (message.role === 'tool') {
      const block: AnthropicBlock = {
        type: 'tool_result',
        tool_use_id: message.toolCallId ?? '',
        content: message.content,
      }
      const previous = converted[converted.length - 1]
      if (
        previous?.role === 'user' &&
        Array.isArray(previous.content) &&
        previous.content.every((item) => item.type === 'tool_result')
      ) {
        previous.content.push(block)
      } else {
        converted.push({ role: 'user', content: [block] })
      }
      continue
    }

    if (message.role === 'assistant') {
      const blocks: AnthropicBlock[] = []
      if (message.content.trim()) {
        blocks.push({ type: 'text', text: message.content })
      }
      for (const call of message.toolCalls ?? []) {
        blocks.push({
          type: 'tool_use',
          id: call.id,
          name: call.name,
          input: parseArguments(call.argumentsJson),
        })
      }
      if (blocks.length === 0) blocks.push({ type: 'text', text: '(no content)' })
      converted.push({ role: 'assistant', content: blocks })
      continue
    }

    converted.push({ role: 'user', content: message.content })
  }

  return { system: systemParts.join('\n\n'), messages: converted }
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic'

  constructor(private readonly config: ProviderConfig) {}

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    if (!this.config.model.trim()) {
      throw new ProviderError('Model is not configured', 'config')
    }
    if (!this.config.apiKey.trim()) {
      throw new ProviderError('API key is not configured', 'config')
    }

    const { system, messages } = toAnthropicMessages(request.messages)
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: MAX_TOKENS,
      temperature: this.config.temperature,
      messages,
    }
    if (system) body.system = system
    if (request.tools.length > 0) {
      body.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }))
    }

    const { data } = await postJson(
      resolveAnthropicUrl(this.config.baseUrl),
      {
        'x-api-key': this.config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body,
      request.signal,
    )

    const response = data as AnthropicResponse
    if (!Array.isArray(response.content)) {
      throw new ProviderError(
        'Provider response did not contain content blocks',
        'invalid_response',
      )
    }

    const text = response.content
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('')

    const toolCalls = response.content
      .filter((block) => block.type === 'tool_use' && block.name)
      .map((block, index) => ({
        id: block.id || `toolu_${Date.now()}_${index}`,
        name: block.name as string,
        argumentsJson: JSON.stringify(block.input ?? {}),
      }))

    return { text, toolCalls, stopReason: response.stop_reason }
  }

  async ping(): Promise<{ text: string; latencyMs: number }> {
    const startedAt = Date.now()
    const response = await this.chat({
      messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
      tools: [],
    })
    return { text: response.text, latencyMs: Date.now() - startedAt }
  }
}

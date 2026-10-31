import type {
  LLMChatRequest,
  LLMChatResponse,
  LLMMessage,
  LLMProvider,
  ProviderConfig,
} from '@permutation/shared'
import { ProviderError } from './errors'
import { postJson } from './http'

interface OpenAIToolCall {
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

interface OpenAIChoice {
  message?: {
    content?: string | null
    tool_calls?: OpenAIToolCall[]
  }
  finish_reason?: string
}

interface OpenAIResponse {
  choices?: OpenAIChoice[]
}

export function resolveOpenAIUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new ProviderError('Base URL is required', 'config')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (/\/v\d+(?:beta)?$/.test(trimmed)) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

function toWireMessage(message: LLMMessage): Record<string, unknown> {
  if (message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: message.toolCallId,
      content: message.content,
    }
  }
  if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.argumentsJson },
      })),
    }
  }
  return { role: message.role, content: message.content }
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id = 'openai'

  constructor(private readonly config: ProviderConfig) {}

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    if (!this.config.model.trim()) {
      throw new ProviderError('Model is not configured', 'config')
    }
    if (!this.config.apiKey.trim()) {
      throw new ProviderError('API key is not configured', 'config')
    }

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages.map(toWireMessage),
      temperature: this.config.temperature,
    }
    if (request.tools.length > 0) {
      body.tools = request.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))
      body.tool_choice = 'auto'
    }

    const { data } = await postJson(
      resolveOpenAIUrl(this.config.baseUrl),
      { authorization: `Bearer ${this.config.apiKey}` },
      body,
      request.signal,
    )

    const response = data as OpenAIResponse
    const choice = response.choices?.[0]
    if (!choice?.message) {
      throw new ProviderError('Provider response did not contain a message', 'invalid_response')
    }

    const toolCalls = (choice.message.tool_calls ?? [])
      .filter((call) => call.function?.name)
      .map((call, index) => ({
        id: call.id || `call_${Date.now()}_${index}`,
        name: call.function?.name as string,
        argumentsJson: call.function?.arguments || '{}',
      }))

    return {
      text: choice.message.content ?? '',
      toolCalls,
      stopReason: choice.finish_reason,
    }
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

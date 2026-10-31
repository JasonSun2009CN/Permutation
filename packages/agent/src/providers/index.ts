import type { LLMProvider, ProviderConfig } from '@permutation/shared'
import { AnthropicProvider } from './anthropic'
import { OpenAICompatibleProvider } from './openai'

export function createProvider(config: ProviderConfig): LLMProvider {
  return config.protocol === 'anthropic'
    ? new AnthropicProvider(config)
    : new OpenAICompatibleProvider(config)
}

export { AnthropicProvider, toAnthropicMessages, resolveAnthropicUrl } from './anthropic'
export { OpenAICompatibleProvider, resolveOpenAIUrl } from './openai'
export { ProviderError } from './errors'

import { createProvider } from '@permutation/agent'
import {
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  type ProviderProtocol,
} from '@permutation/shared'

const protocol = (process.env.LLM_PROTOCOL ?? 'openai') as ProviderProtocol
const apiKey = process.env.LLM_API_KEY
const model = process.env.LLM_MODEL
const baseUrl =
  process.env.LLM_BASE_URL ??
  (protocol === 'anthropic' ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_OPENAI_BASE_URL)

if (!apiKey || !model) {
  console.error(`Usage:
  LLM_API_KEY=... LLM_MODEL=... [LLM_PROTOCOL=openai|anthropic] [LLM_BASE_URL=...] npm run verify:llm`)
  process.exit(1)
}

const provider = createProvider({
  protocol,
  baseUrl,
  model,
  temperature: 0,
  apiKey,
})

try {
  const result = await provider.ping()
  console.log(`[verify-llm] ok (${result.latencyMs} ms): ${result.text.trim()}`)
} catch (error) {
  console.error('[verify-llm] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
}

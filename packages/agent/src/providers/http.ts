import { ProviderError } from './errors'

const REQUEST_TIMEOUT_MS = 120_000

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ data: unknown; latencyMs: number }> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  const startedAt = Date.now()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const latencyMs = Date.now() - startedAt
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 800)
      throw new ProviderError(
        `Provider returned HTTP ${response.status}: ${detail || response.statusText}`,
        'http',
        response.status,
      )
    }
    const data = (await response.json()) as unknown
    return { data, latencyMs }
  } catch (error) {
    if (error instanceof ProviderError) throw error
    if (signal?.aborted) {
      throw new ProviderError('Request was cancelled', 'aborted')
    }
    if (timedOut) {
      throw new ProviderError('Provider request timed out after 120 seconds', 'network')
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new ProviderError(`Network error while calling provider: ${message}`, 'network')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

export function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

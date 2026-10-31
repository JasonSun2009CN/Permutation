export type ProviderErrorCode = 'config' | 'http' | 'network' | 'aborted' | 'invalid_response'

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly status?: number

  constructor(message: string, code: ProviderErrorCode, status?: number) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.status = status
  }
}

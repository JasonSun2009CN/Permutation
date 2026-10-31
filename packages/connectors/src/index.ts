/**
 * Connector contracts live here so the agent never talks to a platform API
 * directly. Phase 1 only ships notifications (implemented in the Electron main
 * process); calendar and mail connectors are scheduled for phases 2 and 4.
 *
 * Decisions recorded in docs/adr/0006-connector-strategy.md:
 * - Mail: IMAP-first (works with NetEase/QQ/Gmail/Outlook without per-provider
 *   OAuth apps), with provider OAuth adapters as an optional fast path later.
 * - Calendar: Apple Calendar via EventKit on macOS first; a built-in calendar
 *   is kept as an option in the roadmap, not assumed.
 */

export interface ConnectorStatus {
  available: boolean
  reason?: string
}

export interface Connector {
  readonly id: string
  status(): Promise<ConnectorStatus>
}

export class ConnectorNotConfiguredError extends Error {
  constructor(connector: string) {
    super(`${connector} connector is not configured. This capability arrives in a later phase.`)
    this.name = 'ConnectorNotConfiguredError'
  }
}

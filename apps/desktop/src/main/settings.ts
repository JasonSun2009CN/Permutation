import {
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  MAX_AGENT_STEPS,
  systemTimeZone,
  type AppSettings,
  type ProviderConfig,
  type ProviderTestInput,
  type SettingsPatch,
  type SettingsView,
} from '@permutation/shared'
import type { PermutationDatabase } from '@permutation/db'
import { app, nativeTheme, safeStorage } from 'electron'
import type { MainLanguage } from './i18n'

const SETTINGS_KEY = 'app_settings'
const API_KEY_SECRET = 'llm_api_key'

export const DEFAULT_SETTINGS: AppSettings = {
  protocol: 'openai',
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  model: '',
  temperature: 0.2,
  language: 'system',
  theme: 'system',
  launchAtLogin: false,
  notificationsEnabled: true,
  notificationSound: true,
  maxAgentSteps: MAX_AGENT_STEPS,
  timezone: systemTimeZone(),
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function pickProtocol(value: unknown): AppSettings['protocol'] {
  return value === 'openai' || value === 'anthropic' ? value : DEFAULT_SETTINGS.protocol
}

function pickLanguage(value: unknown): AppSettings['language'] {
  return value === 'system' || value === 'zh' || value === 'en' ? value : DEFAULT_SETTINGS.language
}

function pickTheme(value: unknown): AppSettings['theme'] {
  return value === 'system' || value === 'light' || value === 'dark'
    ? value
    : DEFAULT_SETTINGS.theme
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export class SettingsService {
  constructor(private readonly db: PermutationDatabase) {}

  get(): AppSettings {
    const raw = this.db.settings.get(SETTINGS_KEY)
    let stored: Record<string, unknown> = {}
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (isRecord(parsed)) stored = parsed
      } catch {
        stored = {}
      }
    }

    // The app has no timezone picker yet; the OS timezone is the source of truth.
    return {
      protocol: pickProtocol(stored.protocol),
      baseUrl:
        typeof stored.baseUrl === 'string' && stored.baseUrl.trim()
          ? stored.baseUrl.trim()
          : DEFAULT_SETTINGS.baseUrl,
      model: typeof stored.model === 'string' ? stored.model : DEFAULT_SETTINGS.model,
      temperature: clamp(
        typeof stored.temperature === 'number' ? stored.temperature : DEFAULT_SETTINGS.temperature,
        0,
        2,
        DEFAULT_SETTINGS.temperature,
      ),
      language: pickLanguage(stored.language),
      theme: pickTheme(stored.theme),
      launchAtLogin:
        typeof stored.launchAtLogin === 'boolean'
          ? stored.launchAtLogin
          : DEFAULT_SETTINGS.launchAtLogin,
      notificationsEnabled:
        typeof stored.notificationsEnabled === 'boolean'
          ? stored.notificationsEnabled
          : DEFAULT_SETTINGS.notificationsEnabled,
      notificationSound:
        typeof stored.notificationSound === 'boolean'
          ? stored.notificationSound
          : DEFAULT_SETTINGS.notificationSound,
      maxAgentSteps: clamp(
        typeof stored.maxAgentSteps === 'number'
          ? stored.maxAgentSteps
          : DEFAULT_SETTINGS.maxAgentSteps,
        1,
        12,
        DEFAULT_SETTINGS.maxAgentSteps,
      ),
      timezone: systemTimeZone(),
    }
  }

  getView(): SettingsView {
    return { ...this.get(), hasApiKey: this.hasApiKey() }
  }

  update(patch: SettingsPatch): SettingsView {
    const current = this.get()
    const next: AppSettings = { ...current }

    if (patch.protocol !== undefined) {
      next.protocol = pickProtocol(patch.protocol)
    }
    if (patch.baseUrl !== undefined) {
      const baseUrl = String(patch.baseUrl).trim().replace(/\/+$/, '')
      if (!/^https?:\/\/.+/i.test(baseUrl)) {
        throw new Error('Base URL must start with http:// or https://')
      }
      next.baseUrl = baseUrl
    }
    if (patch.model !== undefined) {
      next.model = String(patch.model).trim().slice(0, 200)
    }
    if (patch.temperature !== undefined) {
      next.temperature = clamp(Number(patch.temperature), 0, 2, current.temperature)
    }
    if (patch.language !== undefined) next.language = pickLanguage(patch.language)
    if (patch.theme !== undefined) next.theme = pickTheme(patch.theme)
    if (patch.launchAtLogin !== undefined) next.launchAtLogin = Boolean(patch.launchAtLogin)
    if (patch.notificationsEnabled !== undefined) {
      next.notificationsEnabled = Boolean(patch.notificationsEnabled)
    }
    if (patch.notificationSound !== undefined) {
      next.notificationSound = Boolean(patch.notificationSound)
    }
    if (patch.maxAgentSteps !== undefined) {
      next.maxAgentSteps = Math.round(
        clamp(Number(patch.maxAgentSteps), 1, 12, current.maxAgentSteps),
      )
    }

    if (
      patch.protocol !== undefined &&
      patch.protocol !== current.protocol &&
      patch.baseUrl === undefined
    ) {
      next.baseUrl =
        next.protocol === 'anthropic' ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_OPENAI_BASE_URL
    }

    next.timezone = systemTimeZone()
    this.db.settings.set(SETTINGS_KEY, JSON.stringify(next))
    return this.getView()
  }

  hasApiKey(): boolean {
    return this.getApiKey().length > 0
  }

  getApiKey(): string {
    // Developer/CI convenience: allow a throwaway key from the environment in
    // unpackaged runs. Packaged builds always require the encrypted keychain.
    if (!app.isPackaged) {
      const envKey = process.env.PERMUTATION_API_KEY?.trim()
      if (envKey) return envKey
    }
    const encrypted = this.db.secrets.get(API_KEY_SECRET)
    if (!encrypted) return ''
    if (!safeStorage.isEncryptionAvailable()) return ''
    try {
      return safeStorage.decryptString(encrypted)
    } catch {
      return ''
    }
  }

  setApiKey(apiKey: string): SettingsView {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      this.clearApiKey()
      return this.getView()
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('The operating system keychain is unavailable, so the API key was not saved.')
    }
    this.db.secrets.set(API_KEY_SECRET, safeStorage.encryptString(trimmed))
    return this.getView()
  }

  clearApiKey(): SettingsView {
    this.db.secrets.delete(API_KEY_SECRET)
    return this.getView()
  }

  providerConfig(overrides: ProviderTestInput = {}): ProviderConfig {
    const settings = this.get()
    const config: ProviderConfig = {
      protocol: overrides.protocol ?? settings.protocol,
      baseUrl: (overrides.baseUrl ?? settings.baseUrl).trim(),
      model: (overrides.model ?? settings.model).trim(),
      temperature: settings.temperature,
      apiKey: overrides.apiKey?.trim() || this.getApiKey(),
    }
    if (!config.model) throw new Error('MODEL_NOT_CONFIGURED')
    if (!config.apiKey) throw new Error('API_KEY_NOT_CONFIGURED')
    if (!config.baseUrl) throw new Error('BASE_URL_NOT_CONFIGURED')
    return config
  }

  language(): MainLanguage {
    const settings = this.get()
    if (settings.language === 'zh') return 'zh'
    if (settings.language === 'en') return 'en'
    return app.getLocale().toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }

  locale(): string {
    if (this.language() === 'zh') return 'zh-CN'
    return app.getLocale() || 'en-US'
  }

  applyRuntimePreferences(): void {
    const settings = this.get()
    nativeTheme.themeSource = settings.theme
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin })
    }
  }
}

export function isProviderConfigError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ['MODEL_NOT_CONFIGURED', 'API_KEY_NOT_CONFIGURED', 'BASE_URL_NOT_CONFIGURED'].includes(
      error.message,
    )
  )
}

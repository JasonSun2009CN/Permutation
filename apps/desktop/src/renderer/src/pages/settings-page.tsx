import {
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  type LanguagePreference,
  type ProviderProtocol,
  type SettingsPatch,
  type ThemePreference,
} from '@permutation/shared'
import {
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  KeyRound,
  PlugZap,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useI18n } from '../lib/use-i18n'
import { useAppStore } from '../store/app-store'
import { ConfirmDialog } from '../components/confirm-dialog'
import { Badge, Button, Field, inputClass, PageHeader, Segmented, Switch } from '../components/ui'

interface Draft {
  protocol: ProviderProtocol
  baseUrl: string
  model: string
  language: LanguagePreference
  theme: ThemePreference
  launchAtLogin: boolean
  notificationsEnabled: boolean
  notificationSound: boolean
  maxAgentSteps: number
}

interface TestState {
  status: 'idle' | 'loading' | 'ok' | 'error'
  message?: string
  ms?: number
}

export function SettingsPage(): ReactNode {
  const { t } = useI18n()
  const settings = useAppStore((state) => state.settings)
  const appInfo = useAppStore((state) => state.appInfo)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const clearApiKey = useAppStore((state) => state.clearApiKey)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!settings) return
    setDraft({
      protocol: settings.protocol,
      baseUrl: settings.baseUrl,
      model: settings.model,
      language: settings.language,
      theme: settings.theme,
      launchAtLogin: settings.launchAtLogin,
      notificationsEnabled: settings.notificationsEnabled,
      notificationSound: settings.notificationSound,
      maxAgentSteps: settings.maxAgentSteps,
    })
  }, [settings])

  const dirty = useMemo(() => {
    if (!settings || !draft) return false
    return (
      draft.protocol !== settings.protocol ||
      draft.baseUrl !== settings.baseUrl ||
      draft.model !== settings.model ||
      draft.language !== settings.language ||
      draft.theme !== settings.theme ||
      draft.launchAtLogin !== settings.launchAtLogin ||
      draft.notificationsEnabled !== settings.notificationsEnabled ||
      draft.notificationSound !== settings.notificationSound ||
      draft.maxAgentSteps !== settings.maxAgentSteps ||
      apiKey.trim().length > 0
    )
  }, [settings, draft, apiKey])

  if (!settings || !draft) return null

  const patch = (value: Partial<Draft>): void => {
    setDraft((current) => (current ? { ...current, ...value } : current))
    setTest({ status: 'idle' })
  }

  const changeProtocol = (protocol: ProviderProtocol): void => {
    setDraft((current) => {
      if (!current) return current
      const knownDefaults = [DEFAULT_OPENAI_BASE_URL, DEFAULT_ANTHROPIC_BASE_URL]
      const nextBase = knownDefaults.includes(current.baseUrl)
        ? protocol === 'anthropic'
          ? DEFAULT_ANTHROPIC_BASE_URL
          : DEFAULT_OPENAI_BASE_URL
        : current.baseUrl
      return { ...current, protocol, baseUrl: nextBase }
    })
    setTest({ status: 'idle' })
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    const payload: SettingsPatch = {
      protocol: draft.protocol,
      baseUrl: draft.baseUrl,
      model: draft.model,
      language: draft.language,
      theme: draft.theme,
      launchAtLogin: draft.launchAtLogin,
      notificationsEnabled: draft.notificationsEnabled,
      notificationSound: draft.notificationSound,
      maxAgentSteps: draft.maxAgentSteps,
    }
    const ok = await saveSettings(payload, apiKey)
    setSaving(false)
    if (ok) setApiKey('')
  }

  const runTest = async (): Promise<void> => {
    if (!draft.model.trim() || (!apiKey.trim() && !settings.hasApiKey)) {
      setTest({ status: 'error', message: t('settings.testMissing') })
      return
    }
    setTest({ status: 'loading' })
    try {
      const result = await window.permutation.settings.testProvider({
        protocol: draft.protocol,
        baseUrl: draft.baseUrl,
        model: draft.model,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      })
      if (result.ok) {
        setTest({
          status: 'ok',
          ms: result.latencyMs,
          message: t('settings.testSuccess', { ms: result.latencyMs }),
        })
      } else {
        setTest({ status: 'error', message: result.message })
      }
    } catch (error) {
      setTest({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const removeKey = async (): Promise<void> => {
    setClearing(true)
    const ok = await clearApiKey()
    setClearing(false)
    setClearOpen(false)
    if (ok) setApiKey('')
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto px-8 pb-12">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            {dirty ? <span className="text-[11px] text-warm">{t('settings.unsaved')}</span> : null}
            <Button
              variant="primary"
              size="sm"
              disabled={!dirty}
              loading={saving}
              onClick={() => void save()}
            >
              {t('settings.save')}
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-3xl">
        <Section title={t('settings.connection')} description={t('settings.connectionDesc')}>
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Field label={t('settings.protocol')}>
                <Segmented
                  value={draft.protocol}
                  onChange={changeProtocol}
                  options={[
                    { value: 'openai', label: t('settings.openai') },
                    { value: 'anthropic', label: t('settings.anthropic') },
                  ]}
                />
              </Field>
              <Badge tone={settings.hasApiKey ? 'accent' : 'warm'}>
                <KeyRound size={10} />
                {settings.hasApiKey ? t('settings.apiKeyStored') : t('settings.keyMissing')}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={t('settings.baseUrl')}
                hint={t('settings.baseUrlHint')}
                htmlFor="base-url"
              >
                <input
                  id="base-url"
                  value={draft.baseUrl}
                  onChange={(event) => patch({ baseUrl: event.target.value })}
                  spellCheck={false}
                  className={cn(inputClass, 'font-mono text-[12px]')}
                />
              </Field>
              <Field label={t('settings.model')} hint={t('settings.modelHint')} htmlFor="model">
                <input
                  id="model"
                  value={draft.model}
                  onChange={(event) => patch({ model: event.target.value })}
                  placeholder="gpt-4o-mini / claude-sonnet-4-5"
                  spellCheck={false}
                  className={cn(inputClass, 'font-mono text-[12px]')}
                />
              </Field>
            </div>

            <Field label={t('settings.apiKey')} hint={t('settings.apiKeyHint')} htmlFor="api-key">
              <div className="flex gap-2">
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value)
                    setTest({ status: 'idle' })
                  }}
                  placeholder={settings.hasApiKey ? t('settings.apiKeyPlaceholder') : 'sk-…'}
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(inputClass, 'flex-1 font-mono text-[12px]')}
                />
                <Button
                  variant="secondary"
                  onClick={() => void runTest()}
                  loading={test.status === 'loading'}
                  className="shrink-0"
                >
                  {test.status === 'loading' ? t('settings.testing') : t('settings.test')}
                </Button>
              </div>
            </Field>

            {test.status === 'ok' ? (
              <p className="flex items-center gap-1.5 text-[12px] text-accent">
                <CheckCircle2 size={13} />
                {test.message}
              </p>
            ) : null}
            {test.status === 'error' ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-[11.5px] leading-relaxed break-words text-danger">
                {test.message}
              </p>
            ) : null}

            {settings.hasApiKey ? (
              <button
                type="button"
                onClick={() => setClearOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] text-faint transition-colors hover:text-danger"
              >
                <Trash2 size={12} />
                {t('settings.clearKey')}
              </button>
            ) : null}
          </div>
        </Section>

        <Section title={t('settings.preferences')}>
          <SettingRow label={t('settings.language')}>
            <Segmented
              value={draft.language}
              onChange={(language) => patch({ language })}
              options={[
                { value: 'system', label: t('settings.languageSystem') },
                { value: 'zh', label: t('settings.languageZh') },
                { value: 'en', label: t('settings.languageEn') },
              ]}
            />
          </SettingRow>
          <SettingRow label={t('settings.theme')}>
            <Segmented
              value={draft.theme}
              onChange={(theme) => patch({ theme })}
              options={[
                { value: 'system', label: t('settings.themeSystem') },
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
              ]}
            />
          </SettingRow>
          <SettingRow label={t('settings.notifications')} hint={t('settings.notificationsDesc')}>
            <Switch
              label={t('settings.notifications')}
              checked={draft.notificationsEnabled}
              onChange={(notificationsEnabled) => patch({ notificationsEnabled })}
            />
          </SettingRow>
          <SettingRow label={t('settings.sound')} hint={t('settings.soundDesc')}>
            <Switch
              label={t('settings.sound')}
              checked={draft.notificationSound}
              onChange={(notificationSound) => patch({ notificationSound })}
              disabled={!draft.notificationsEnabled}
            />
          </SettingRow>
          <SettingRow label={t('settings.launchAtLogin')} hint={t('settings.launchAtLoginDesc')}>
            <Switch
              label={t('settings.launchAtLogin')}
              checked={draft.launchAtLogin}
              onChange={(launchAtLogin) => patch({ launchAtLogin })}
            />
          </SettingRow>
        </Section>

        <Section title={t('settings.advanced')}>
          <SettingRow label={t('settings.maxSteps')} hint={t('settings.maxStepsDesc')}>
            <input
              type="number"
              min={1}
              max={12}
              value={draft.maxAgentSteps}
              onChange={(event) =>
                patch({
                  maxAgentSteps: Math.min(12, Math.max(1, Number(event.target.value) || 1)),
                })
              }
              className={cn(inputClass, 'w-20 text-center font-mono')}
            />
          </SettingRow>
        </Section>

        <Section title={t('settings.data')}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-ink">{t('settings.dataDirHint')}</p>
              <p className="mt-1 truncate font-mono text-[10.5px] text-faint">{appInfo?.dataDir}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void window.permutation.system.openDataDir()}
            >
              <FolderOpen size={14} />
              {t('settings.openDataDir')}
            </Button>
          </div>
          <div className="flex items-start gap-3 border-t border-line/70 p-5">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-[12.5px] font-medium text-ink">{t('settings.privacy')}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                {t('settings.privacyDesc')}
              </p>
            </div>
          </div>
        </Section>

        <Section title={t('settings.about')}>
          <div className="grid gap-0 sm:grid-cols-3">
            <div className="p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase">
                {t('settings.version')}
              </p>
              <p className="mt-1 font-mono text-[12px] text-ink">{appInfo?.version}</p>
            </div>
            <div className="p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase">
                {t('settings.shortcut')}
              </p>
              <kbd className="mt-1 inline-flex rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink">
                {appInfo?.shortcut}
              </kbd>
            </div>
            <div className="p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase">
                Permutation
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11.5px] text-muted">
                <PlugZap size={12} className="text-accent" />
                {t('app.tagline')}
              </p>
            </div>
          </div>
        </Section>

        <div className="flex items-center justify-between px-1 pb-2">
          <p className="flex items-center gap-1.5 text-[11px] text-faint">
            <ExternalLink size={11} />
            {t('settings.dataDirHint')}
          </p>
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty}
            loading={saving}
            onClick={() => void save()}
          >
            {t('settings.save')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={clearOpen}
        title={t('settings.clearKey')}
        description={t('settings.clearKeyBody')}
        confirmLabel={t('settings.clearKey')}
        loading={clearing}
        onConfirm={() => void removeKey()}
        onClose={() => setClearOpen(false)}
      />
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}): ReactNode {
  return (
    <section className="mb-7">
      <div className="mb-2 px-1">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[11.5px] text-muted">{description}</p> : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-5 py-3.5 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-faint">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

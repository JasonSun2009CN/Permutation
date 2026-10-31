import { useEffect, type ReactNode } from 'react'
import { BrandMark } from './components/brand'
import { ReminderPopup } from './components/reminder-popup'
import { Sidebar } from './components/sidebar'
import { Toast } from './components/toast'
import { Button } from './components/ui'
import { useI18n } from './lib/use-i18n'
import { ActivityPage } from './pages/activity-page'
import { ChatPage } from './pages/chat-page'
import { RemindersPage } from './pages/reminders-page'
import { SettingsPage } from './pages/settings-page'
import { TodayPage } from './pages/today-page'
import { useAppStore } from './store/app-store'

export default function App(): ReactNode {
  const { t, language } = useI18n()
  const bootstrapped = useAppStore((state) => state.bootstrapped)
  const loadError = useAppStore((state) => state.loadError)
  const page = useAppStore((state) => state.page)
  const settings = useAppStore((state) => state.settings)
  const bootstrap = useAppStore((state) => state.bootstrap)
  const handleEvent = useAppStore((state) => state.handleEvent)

  useEffect(() => {
    if (!useAppStore.getState().bootstrapped) void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    return window.permutation.events.on(handleEvent)
  }, [handleEvent])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const theme = settings?.theme ?? 'system'
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings?.theme])

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  }, [language])

  if (!bootstrapped) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg">
        <BrandMark size={48} className="animate-fade" />
        <p className="mt-4 text-[13px] font-medium text-ink">Permutation</p>
        <p className="mt-1 text-[11.5px] text-faint">{t('common.loading')}</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
        <BrandMark size={44} />
        <p className="text-[14px] font-medium text-ink">{t('toast.error')}</p>
        <p className="max-w-md text-[12px] break-words text-muted">{loadError}</p>
        <Button variant="secondary" size="sm" onClick={() => void bootstrap()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-ink">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="drag-region h-8 shrink-0" />
        <div className="main-surface min-h-0 flex-1">
          {page === 'chat' ? <ChatPage /> : null}
          {page === 'today' ? <TodayPage /> : null}
          {page === 'reminders' ? <RemindersPage /> : null}
          {page === 'activity' ? <ActivityPage /> : null}
          {page === 'settings' ? <SettingsPage /> : null}
        </div>
      </main>
      <ReminderPopup />
      <Toast />
    </div>
  )
}

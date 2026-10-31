import { Activity, Bell, MessageCircle, Plus, Settings, SunMedium } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useI18n } from '../lib/use-i18n'
import { useAppStore, type Page } from '../store/app-store'
import { BrandMark } from './brand'
import { IconButton } from './ui'

const navItems: Array<{
  page: Page
  icon: typeof MessageCircle
  labelKey: 'nav.chat' | 'nav.today' | 'nav.reminders' | 'nav.activity'
}> = [
  { page: 'chat', icon: MessageCircle, labelKey: 'nav.chat' },
  { page: 'today', icon: SunMedium, labelKey: 'nav.today' },
  { page: 'reminders', icon: Bell, labelKey: 'nav.reminders' },
  { page: 'activity', icon: Activity, labelKey: 'nav.activity' },
]

export function Sidebar(): ReactNode {
  const { t } = useI18n()
  const page = useAppStore((state) => state.page)
  const navigate = useAppStore((state) => state.navigate)
  const conversations = useAppStore((state) => state.conversations)
  const selectedConversationId = useAppStore((state) => state.selectedConversationId)
  const selectConversation = useAppStore((state) => state.selectConversation)
  const newChat = useAppStore((state) => state.newChat)
  const settings = useAppStore((state) => state.settings)
  const appInfo = useAppStore((state) => state.appInfo)

  const isMac = appInfo?.platform === 'darwin'
  const ready = Boolean(settings?.hasApiKey && settings?.model)
  const statusKey = !settings?.hasApiKey
    ? 'nav.keyMissing'
    : !settings?.model
      ? 'nav.modelMissing'
      : 'nav.modelReady'

  return (
    <aside className="flex w-[252px] shrink-0 flex-col border-r border-line bg-sidebar">
      <div className={cn('drag-region w-full shrink-0', isMac ? 'h-[42px]' : 'h-4')} />

      <div className="flex items-center gap-2.5 px-5 pb-6">
        <BrandMark />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-ink">Permutation</p>
          <p className="truncate text-[11px] text-faint">{t('app.tagline')}</p>
        </div>
      </div>

      <nav className="space-y-0.5 px-3" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = page === item.page
          return (
            <button
              key={item.page}
              type="button"
              onClick={() => navigate(item.page)}
              data-page={item.page}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                active
                  ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-muted hover:bg-surface/60 hover:text-ink',
              )}
            >
              <Icon
                size={17}
                strokeWidth={active ? 2 : 1.8}
                className={active ? 'text-accent' : ''}
              />
              <span>{t(item.labelKey)}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-7 flex min-h-0 flex-1 flex-col px-3">
        <div className="mb-1.5 flex items-center justify-between px-2">
          <span className="text-[10.5px] font-semibold tracking-[0.12em] text-faint uppercase">
            {t('nav.recent')}
          </span>
          <IconButton label={t('nav.newChat')} onClick={newChat} className="h-6 w-6">
            <Plus size={14} />
          </IconButton>
        </div>
        <div className="thin-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-3">
          {conversations.length === 0 ? (
            <p className="px-2 py-2 text-[12px] text-faint">{t('nav.noConversations')}</p>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === selectedConversationId && page === 'chat'
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void selectConversation(conversation.id)}
                  data-conversation={conversation.id}
                  className={cn(
                    'block w-full cursor-pointer truncate rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors duration-150',
                    active
                      ? 'bg-accent-soft/80 font-medium text-accent'
                      : 'text-muted hover:bg-surface/70 hover:text-ink',
                  )}
                  title={conversation.title}
                >
                  {conversation.title}
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-line/80 px-3 py-3">
        <button
          type="button"
          onClick={() => navigate('settings')}
          data-page="settings"
          className={cn(
            'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150',
            page === 'settings'
              ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
              : 'text-muted hover:bg-surface/60 hover:text-ink',
          )}
        >
          <Settings
            size={17}
            strokeWidth={page === 'settings' ? 2 : 1.8}
            className={page === 'settings' ? 'text-accent' : ''}
          />
          {t('nav.settings')}
        </button>
        <button
          type="button"
          onClick={() => navigate('settings')}
          className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-faint transition-colors hover:text-muted"
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', ready ? 'bg-accent' : 'bg-warm')}
            aria-hidden
          />
          <span className="truncate">{t(statusKey)}</span>
          {settings?.model ? (
            <span className="ml-auto max-w-[86px] truncate font-mono text-[10px] opacity-80">
              {settings.model}
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  )
}

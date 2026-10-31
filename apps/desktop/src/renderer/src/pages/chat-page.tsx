import { AlertCircle, ArrowUp, ArrowUpRight, Plus, ShieldAlert, Square } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { formatClock, greetingKey, toolLabelKey } from '../lib/format'
import { useI18n } from '../lib/use-i18n'
import { useAppStore } from '../store/app-store'
import { BrandMark } from '../components/brand'
import { Markdown } from '../components/markdown'
import { ToolTraceList } from '../components/tool-trace'
import { Badge, Button, IconButton, PageHeader, Spinner } from '../components/ui'

export function ChatPage(): ReactNode {
  const { t, language } = useI18n()
  const messages = useAppStore((state) => state.messages)
  const selectedConversationId = useAppStore((state) => state.selectedConversationId)
  const conversations = useAppStore((state) => state.conversations)
  const runs = useAppStore((state) => state.runs)
  const settings = useAppStore((state) => state.settings)
  const isSending = useAppStore((state) => state.isSending)
  const loadingMessages = useAppStore((state) => state.loadingMessages)
  const confirmation = useAppStore((state) => state.confirmation)
  const composerFocusToken = useAppStore((state) => state.composerFocusToken)
  const sendMessage = useAppStore((state) => state.sendMessage)
  const cancelRun = useAppStore((state) => state.cancelRun)
  const respondConfirmation = useAppStore((state) => state.respondConfirmation)
  const newChat = useAppStore((state) => state.newChat)
  const navigate = useAppStore((state) => state.navigate)

  const [text, setText] = useState('')
  const [now, setNow] = useState(new Date())
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const run = selectedConversationId ? runs[selectedConversationId] : undefined
  const running = Boolean(run && !run.error)
  const failed = run?.error
  const conversation = conversations.find((item) => item.id === selectedConversationId)
  const activeConfirmation =
    confirmation &&
    (!selectedConversationId || confirmation.conversationId === selectedConversationId)
      ? confirmation
      : null
  const configured = Boolean(settings?.hasApiKey && settings.model)
  const canSend = Boolean(text.trim()) && !running && !isSending

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }, [messages.length, run?.traces.length, run?.error, activeConfirmation])

  useEffect(() => {
    if (composerFocusToken > 0) {
      textareaRef.current?.focus()
    }
  }, [composerFocusToken])

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${Math.min(element.scrollHeight, 168)}px`
  }, [text])

  const submit = async (override?: string): Promise<void> => {
    const content = (override ?? text).trim()
    if (!content || running || isSending) return
    setText('')
    await sendMessage(content)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!event.nativeEvent.isComposing) void submit()
    }
  }

  const retry = (): void => {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user')
    if (lastUser) void sendMessage(lastUser.content)
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-8">
      <PageHeader
        eyebrow={selectedConversationId ? t('chat.title') : undefined}
        title={conversation?.title ?? t('chat.title')}
        actions={
          <Button variant="secondary" size="sm" onClick={newChat}>
            <Plus size={14} />
            {t('chat.newChat')}
          </Button>
        }
      />

      <div ref={scrollRef} className="thin-scroll min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          {messages.length === 0 && !run ? (
            <EmptyState
              greeting={t(greetingKey(now))}
              subtitle={t('chat.emptySubtitle')}
              examplesLabel={t('chat.exampleLabel')}
              examples={[t('chat.example1'), t('chat.example2'), t('chat.example3')]}
              onExample={(value) => void submit(value)}
            />
          ) : (
            <div className="space-y-7 pt-2">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    'animate-rise',
                    message.role === 'user' ? 'flex justify-end' : 'flex gap-3',
                  )}
                >
                  {message.role === 'assistant' ? <BrandMark size={28} className="mt-0.5" /> : null}
                  <div
                    className={cn(
                      'min-w-0',
                      message.role === 'user' ? 'max-w-[82%]' : 'max-w-[86%] flex-1',
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        {message.tools.length > 0 ? (
                          <div className="mb-3">
                            <ToolTraceList traces={message.tools} compact />
                          </div>
                        ) : null}
                        <Markdown>{message.content}</Markdown>
                      </div>
                    ) : (
                      <div className="rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-bg">
                        {message.content}
                      </div>
                    )}
                    <p
                      className={cn(
                        'mt-1.5 text-[10.5px] text-faint',
                        message.role === 'user' && 'text-right',
                      )}
                    >
                      {formatClock(message.createdAt, language)}
                    </p>
                  </div>
                </article>
              ))}

              {run ? (
                <div className="flex gap-3 animate-fade">
                  <BrandMark size={28} className="mt-0.5" />
                  <div className="max-w-[86%] min-w-0 flex-1">
                    <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                      {run.traces.length > 0 ? (
                        <div className={cn(run.error ? 'mb-3' : '')}>
                          <ToolTraceList traces={run.traces} compact />
                        </div>
                      ) : null}

                      {!failed ? (
                        <div className="flex items-center gap-2.5 py-1">
                          <span className="flex items-center gap-1">
                            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
                            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
                            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
                          </span>
                          <span className="text-[12px] text-muted">{t('chat.thinking')}</span>
                          {selectedConversationId ? (
                            <button
                              type="button"
                              onClick={() => void cancelRun(selectedConversationId)}
                              className="ml-auto cursor-pointer text-[11.5px] text-faint underline-offset-2 hover:text-ink hover:underline"
                            >
                              {t('chat.stop')}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <RunError
                          code={failed.code}
                          onRetry={
                            messages.some((message) => message.role === 'user') ? retry : undefined
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {loadingMessages ? (
                <div className="flex items-center gap-2 text-[12px] text-faint">
                  <Spinner size={14} />
                  {t('common.loading')}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl pb-5">
        {activeConfirmation ? (
          <ConfirmationCard
            summary={activeConfirmation.request.summary}
            toolName={activeConfirmation.request.toolName}
            args={activeConfirmation.request.args}
            onApprove={() => void respondConfirmation(true)}
            onDeny={() => void respondConfirmation(false)}
          />
        ) : null}

        {!configured ? (
          <div className="mb-3 flex items-start gap-3 rounded-xl border border-warm/25 bg-warm-soft/80 px-4 py-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-warm" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-warm">{t('chat.notConfiguredTitle')}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                {t('chat.notConfiguredBody')}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('settings')}>
              {t('chat.goSettings')}
            </Button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-line bg-surface p-2 shadow-card transition-colors duration-150 focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/10">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            className="thin-scroll max-h-[168px] w-full resize-none bg-transparent px-3 pt-2 pb-1 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-0.5">
            <span className="truncate text-[10.5px] text-faint">{t('chat.hint')}</span>
            <div className="flex items-center gap-1.5">
              {running && selectedConversationId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void cancelRun(selectedConversationId)}
                >
                  <Square size={12} />
                  {t('chat.stop')}
                </Button>
              ) : null}
              <IconButton
                label={t('chat.send')}
                data-send
                onClick={() => void submit()}
                disabled={!canSend}
                className={cn(
                  'h-9 w-9 rounded-full',
                  canSend
                    ? 'bg-accent text-accent-contrast hover:bg-accent-hover hover:text-accent-contrast'
                    : 'bg-surface-2 text-faint',
                )}
              >
                {isSending ? <Spinner size={15} /> : <ArrowUp size={17} strokeWidth={2.4} />}
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  greeting,
  subtitle,
  examplesLabel,
  examples,
  onExample,
}: {
  greeting: string
  subtitle: string
  examplesLabel: string
  examples: string[]
  onExample: (value: string) => void
}): ReactNode {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12">
      <div className="animate-rise text-center">
        <BrandMark size={54} className="mx-auto mb-5" />
        <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">{greeting}</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-muted">{subtitle}</p>
      </div>

      <div className="mt-9 w-full max-w-xl animate-rise">
        <p className="mb-2.5 text-center text-[10.5px] font-semibold tracking-[0.14em] text-faint uppercase">
          {examplesLabel}
        </p>
        <div className="space-y-1.5">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onExample(example)}
              className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface/80 px-4 py-3 text-left text-[13px] text-ink transition-all duration-150 hover:border-accent/40 hover:bg-surface hover:shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
            >
              <span className="truncate">{example}</span>
              <ArrowUpRight
                size={15}
                className="shrink-0 text-faint transition-colors group-hover:text-accent"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RunError({ code, onRetry }: { code: string; onRetry?: () => void }): ReactNode {
  const { t } = useI18n()
  const cancelled = code === 'cancelled'
  const message = cancelled
    ? t('chat.errorCancelled')
    : code === 'provider_error'
      ? t('chat.errorProvider')
      : code === 'max_steps'
        ? t('chat.errorMaxSteps')
        : t('chat.errorUnknown')

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-3 py-2.5',
        cancelled ? 'bg-surface-2' : 'bg-danger-soft',
      )}
    >
      <AlertCircle
        size={15}
        className={cn('mt-0.5 shrink-0', cancelled ? 'text-faint' : 'text-danger')}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-[12px]', cancelled ? 'text-muted' : 'text-danger')}>{message}</p>
      </div>
      {onRetry && !cancelled ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 cursor-pointer text-[11.5px] font-medium text-danger underline-offset-2 hover:underline"
        >
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  )
}

function ConfirmationCard({
  summary,
  toolName,
  args,
  onApprove,
  onDeny,
}: {
  summary: string
  toolName: string
  args: Record<string, unknown>
  onApprove: () => void
  onDeny: () => void
}): ReactNode {
  const { t } = useI18n()
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-warm/35 bg-warm-soft/80 animate-rise">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warm/15 text-warm">
          <ShieldAlert size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-ink">{t('chat.confirmTitle')}</p>
            <Badge tone="warm">{t(toolLabelKey(toolName))}</Badge>
          </div>
          <p className="mt-1 text-[12.5px] text-ink/85">{summary}</p>
          <p className="mt-0.5 text-[11.5px] text-muted">{t('chat.confirmBody')}</p>
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[11px] text-faint select-none">
              {t('tool.details')}
            </summary>
            <pre className="thin-scroll mt-1 max-h-32 overflow-auto rounded-lg bg-surface/70 p-2 font-mono text-[10.5px] whitespace-pre-wrap text-muted">
              {JSON.stringify(args, null, 2)}
            </pre>
          </details>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-warm/20 bg-surface/40 px-4 py-2.5">
        <Button size="sm" variant="secondary" onClick={onDeny}>
          {t('chat.confirmDeny')}
        </Button>
        <Button size="sm" variant="primary" onClick={onApprove}>
          {t('chat.confirmApprove')}
        </Button>
      </div>
    </div>
  )
}

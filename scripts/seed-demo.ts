/**
 * Seeds a throwaway database with realistic data for visual QA and demos.
 *
 *   npx tsx scripts/seed-demo.ts /tmp/permutation-demo/permutation.db
 */
import { openDatabase } from '@permutation/db'

const dbPath = process.argv[2]
if (!dbPath) {
  console.error('Usage: npx tsx scripts/seed-demo.ts <path-to-permutation.db>')
  process.exit(1)
}

const db = openDatabase(dbPath)
const now = Date.now()
const at = (minutesFromNow: number): string => new Date(now + minutesFromNow * 60_000).toISOString()

const seed = [
  { content: '喝水，站起来活动一下', triggerAt: at(-24), status: 'pending' },
  { content: '给客户回一封邮件', triggerAt: at(35), status: 'pending' },
  { content: '整理本周的项目笔记', triggerAt: at(180), status: 'pending' },
  { content: '明天的产品评审会材料', triggerAt: at(60 * 20), status: 'pending' },
  { content: '预约牙医', triggerAt: at(60 * 24 * 2), status: 'pending' },
  { content: '提交周报', triggerAt: at(-60 * 5), status: 'completed' },
] as const

for (const item of seed) {
  const reminder = db.reminders.create({
    content: item.content,
    triggerAt: item.triggerAt,
    source: 'manual',
  })
  if (item.status === 'completed') {
    db.reminders.complete(reminder.id)
  }
}

db.logs.add({
  toolName: 'create_reminder',
  args: { content: '喝水，站起来活动一下', triggerAt: at(-24) },
  result: { ok: true },
  status: 'ok',
  confirmed: null,
  durationMs: 12,
  source: 'chat',
})
db.logs.add({
  toolName: 'cancel_reminder',
  args: { id: 'rem_demo' },
  result: {
    ok: false,
    error: 'The user denied this action. It was not executed.',
    denied: true,
  },
  status: 'denied',
  confirmed: false,
  durationMs: 3,
  source: 'chat',
})
db.logs.add({
  toolName: 'reminder_fired',
  args: { ids: ['rem_demo'], missed: false },
  result: { count: 1 },
  status: 'ok',
  confirmed: null,
  durationMs: 0,
  source: 'system',
})
db.logs.add({
  toolName: 'send_notification',
  args: { title: '提醒', body: '站起来活动一下' },
  result: { ok: true },
  status: 'ok',
  confirmed: null,
  durationMs: 8,
  source: 'notification',
})

const language = process.env.DEMO_LANGUAGE === 'en' ? 'en' : 'zh'
const theme = process.env.DEMO_THEME === 'light' ? 'light' : 'dark'

const conversation = db.conversations.create('安排今天的任务', new Date(now - 60 * 60_000))
db.messages.add(
  {
    conversationId: conversation.id,
    role: 'user',
    content: '十分钟后提醒我喝水',
  },
  new Date(now - 20 * 60_000),
)
db.messages.add(
  {
    conversationId: conversation.id,
    role: 'assistant',
    content: '已为你安排 **14:10** 的喝水提醒。到点会弹出通知，也可以直接在应用内点击完成。',
    tools: [
      {
        callId: 'call_demo',
        name: 'get_current_time',
        args: {},
        status: 'ok',
        summary: language === 'zh' ? '读取当前时间。' : 'Reading the current time.',
        durationMs: 2,
      },
      {
        callId: 'call_demo_2',
        name: 'create_reminder',
        args: { content: '喝水', triggerAt: '2026-10-31T14:10:00+08:00' },
        status: 'ok',
        summary: language === 'zh' ? '已创建提醒“喝水”。' : 'Created reminder "喝水".',
        durationMs: 11,
      },
    ],
  },
  new Date(now - 19 * 60_000),
)
db.conversations.touch(conversation.id, new Date(now - 19 * 60_000))

db.settings.set(
  'app_settings',
  JSON.stringify({
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    temperature: 0.2,
    language,
    theme,
    launchAtLogin: false,
    notificationsEnabled: true,
    notificationSound: true,
    maxAgentSteps: 8,
  }),
)

console.log(`Seeded ${seed.length} reminders into ${dbPath}`)
db.close()

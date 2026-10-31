export type MainLanguage = 'zh' | 'en'

interface MainStrings {
  trayOpen: string
  trayNewReminder: string
  trayUpcoming: string
  trayNoUpcoming: string
  traySettings: string
  trayQuit: string
  menuEdit: string
  menuView: string
  menuWindow: string
  reminderTitle: string
  reminderDue: string
  missedSummaryTitle: (count: number) => string
  missedSummaryBody: string
  notificationComplete: string
  notificationSnooze: string
  notificationDismiss: string
  notificationOpen: string
  openApp: string
  notificationPermissionDenied: string
  connectionTestFailed: string
  providerNotConfigured: string
}

const strings: Record<MainLanguage, MainStrings> = {
  zh: {
    trayOpen: '打开 Permutation',
    trayNewReminder: '新建提醒',
    trayUpcoming: '待处理提醒',
    trayNoUpcoming: '暂无待处理提醒',
    traySettings: '设置…',
    trayQuit: '退出 Permutation',
    menuEdit: '编辑',
    menuView: '视图',
    menuWindow: '窗口',
    reminderTitle: 'Permutation · 提醒',
    reminderDue: '提醒时间到',
    missedSummaryTitle: (count) => `有 ${count} 个提醒已错过`,
    missedSummaryBody: '打开 Permutation 查看并处理这些提醒。',
    notificationComplete: '完成',
    notificationSnooze: '推迟 10 分钟',
    notificationDismiss: '忽略',
    notificationOpen: '打开',
    openApp: '打开 Permutation',
    notificationPermissionDenied: '系统通知不可用，请检查 macOS 通知权限。',
    connectionTestFailed: '连接失败',
    providerNotConfigured: '请先在设置中填写模型、API Key 和 Base URL。',
  },
  en: {
    trayOpen: 'Open Permutation',
    trayNewReminder: 'New reminder',
    trayUpcoming: 'Upcoming reminders',
    trayNoUpcoming: 'No reminders waiting',
    traySettings: 'Settings…',
    trayQuit: 'Quit Permutation',
    menuEdit: 'Edit',
    menuView: 'View',
    menuWindow: 'Window',
    reminderTitle: 'Permutation · Reminder',
    reminderDue: 'Reminder',
    missedSummaryTitle: (count) => `${count} reminders were missed`,
    missedSummaryBody: 'Open Permutation to review and handle them.',
    notificationComplete: 'Complete',
    notificationSnooze: 'Snooze 10 min',
    notificationDismiss: 'Dismiss',
    notificationOpen: 'Open',
    openApp: 'Open Permutation',
    notificationPermissionDenied:
      'System notifications are unavailable. Check macOS notification permissions.',
    connectionTestFailed: 'Connection failed',
    providerNotConfigured: 'Add a model, API key, and base URL in Settings first.',
  },
}

export function mainT<K extends keyof MainStrings>(language: MainLanguage, key: K): MainStrings[K] {
  return strings[language][key]
}

export function mainStrings(language: MainLanguage): MainStrings {
  return strings[language]
}

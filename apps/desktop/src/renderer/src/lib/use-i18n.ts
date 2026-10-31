import { useAppStore } from '../store/app-store'
import { localeFor, resolveLanguage, translate, type TKey } from './i18n'

export function useI18n(): {
  language: 'zh' | 'en'
  locale: string
  t: (key: TKey, vars?: Record<string, string | number>) => string
} {
  const settings = useAppStore((state) => state.settings)
  const language = resolveLanguage(settings?.language)
  return {
    language,
    locale: localeFor(language),
    t: (key, vars) => translate(language, key, vars),
  }
}

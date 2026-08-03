import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setRequestLanguage, tokenStore } from './api'
import {
  DEFAULT_LOCALE,
  LocaleContext,
  detectLocale,
  storeLocale,
  type Dictionary,
  type Locale,
} from './i18n'
import { en } from './locales/en'
import { ru } from './locales/ru'
import { uz } from './locales/uz'

const DICTIONARIES: Record<Locale, Dictionary> = { uz, ru, en }

/**
 * Sits above the router so every screen can read the language. The choice is stored locally
 * for instant startup and mirrored to the account, so it follows the learner to another
 * device instead of living only in one browser.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  // `lang` matters for hyphenation, spell-check and screen-reader pronunciation. The same
  // value goes onto every request so the server answers its messages in this language too.
  useEffect(() => {
    document.documentElement.lang = locale
    setRequestLanguage(locale)
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    storeLocale(next)
    setRequestLanguage(next)

    // Best effort: not being signed in, or a failed write, must not block the switch.
    if (tokenStore.access()) {
      void api.patch('/auth/me', { uiLanguage: next }).catch(() => {})
    }
  }, [])

  const value = useMemo(
    () => ({ locale, t: DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE], setLocale }),
    [locale, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

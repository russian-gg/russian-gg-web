import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setRequestLanguage, tokenStore } from './api'
import {
  DEFAULT_LOCALE,
  LocaleContext,
  isLocale,
  readStoredLocale,
  startingLocale,
  storeLocale,
  type Dictionary,
  type Locale,
} from './i18n'
import { en } from './locales/en'
import { ru } from './locales/ru'
import { uz } from './locales/uz'

const DICTIONARIES: Record<Locale, Dictionary> = { uz, ru, en }

/**
 * Sits above the router so every screen can read the language. Uzbek is where every visitor
 * starts. A switch is stored locally for instant startup and mirrored to the account, so it
 * follows the learner to another device instead of living only in one browser.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [locale, setLocaleState] = useState<Locale>(startingLocale)

  // `lang` matters for hyphenation, spell-check and screen-reader pronunciation. The same
  // value goes onto every request so the server answers its messages in this language too.
  useEffect(() => {
    document.documentElement.lang = locale
    setRequestLanguage(locale)
  }, [locale])

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next)
      storeLocale(next)
      setRequestLanguage(next)

      /*
       * Not every string on the screen comes from the dictionary. Some are written by the
       * server in the language of the request that fetched them — a mission's lock reason, a
       * degraded-voice message — and they sit in the query cache in that language until
       * whatever holds them goes stale. Switching to English left Russian sentences sitting
       * under English headings.
       *
       * Refetching everything is the right cost here: changing language is a deliberate act
       * that happens rarely, and a page in two languages is worse than a moment of loading.
       */
      void queryClient.invalidateQueries()

      // Best effort: not being signed in, or a failed write, must not block the switch.
      if (tokenStore.access()) {
        void api.patch('/auth/me', { uiLanguage: next }).catch(() => {})
      }
    },
    [queryClient],
  )

  /**
   * Applied on sign-in. It is not written to storage: local storage means "chosen on this
   * device", and an account preference is not that. A learner who switched language here
   * keeps it, because that choice is stored and this one yields to it.
   */
  const adoptAccountLocale = useCallback((language: string | null | undefined) => {
    if (readStoredLocale() || !isLocale(language)) return
    setLocaleState(language)
    setRequestLanguage(language)
    void queryClient.invalidateQueries()
  }, [queryClient])

  const value = useMemo(
    () => ({
      locale,
      t: DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE],
      setLocale,
      adoptAccountLocale,
    }),
    [locale, setLocale, adoptAccountLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setRequestLanguage, tokenStore } from './api'
import {
  LocaleContext,
  isLocale,
  readStoredLocale,
  startingLocale,
  storeLocale,
  type Dictionary,
  type Locale,
} from './i18n'
import { uz } from './locales/uz'

/**
 * Uzbek is compiled in; Russian and English are fetched when somebody asks for them.
 *
 * The three dictionaries are 802 keys each and were all three in the entry chunk, so every
 * learner downloaded two languages they had not chosen. Uzbek stays static because it is the
 * default and the overwhelming majority case — making it async too would put a loading state
 * in front of the first paint for everyone, to save nobody anything.
 */
const LOADERS: Record<Exclude<Locale, 'uz'>, () => Promise<Dictionary>> = {
  ru: () => import('./locales/ru').then((module) => module.ru),
  en: () => import('./locales/en').then((module) => module.en),
}

const loaded: Partial<Record<Locale, Dictionary>> = { uz }

/**
 * Sits above the router so every screen can read the language. Uzbek is where every visitor
 * starts. A switch is stored locally for instant startup and mirrored to the account, so it
 * follows the learner to another device instead of living only in one browser.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [locale, setLocaleState] = useState<Locale>(startingLocale)
  /*
   * What is actually on screen, which is not the same as `locale` for the moment between
   * choosing Russian and its dictionary arriving. Holding the previous language for those few
   * hundred milliseconds is the right behaviour: the alternative is every label on the page
   * blanking or falling back to Uzbek and then changing again.
   */
  const [dictionary, setDictionary] = useState<Dictionary>(() => loaded[startingLocale()] ?? uz)

  /*
   * Fetches whatever `locale` needs and is not held yet. A learner whose account or stored
   * choice is Russian lands here on the first render, so the switch below is not the only
   * path that can need a load.
   */
  useEffect(() => {
    const held = loaded[locale]
    if (held) {
      setDictionary(held)
      return
    }

    let current = true

    void LOADERS[locale as Exclude<Locale, 'uz'>]()
      .then((next) => {
        loaded[locale] = next
        if (current) setDictionary(next)
      })
      // A failed chunk leaves the previous language up rather than an empty screen. The next
      // switch tries again.
      .catch(() => {})

    return () => {
      current = false
    }
  }, [locale])

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
      t: dictionary,
      setLocale,
      adoptAccountLocale,
    }),
    [locale, dictionary, setLocale, adoptAccountLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

import { createContext, useContext } from 'react'
import type { uz } from './locales/uz'

/**
 * The three languages the server already accepts (`AuthService.NormalizeLanguage`). Uzbek is
 * the product default — the audience is Uzbek-speaking, and Russian is the subject being
 * taught, not the language of the interface.
 */
export const LOCALES = ['uz', 'ru', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'uz'

/** Names are written in their own language: a learner looks for the word they recognise. */
export const LOCALE_NAMES: Record<Locale, string> = {
  uz: "O'zbek",
  ru: 'Русский',
  en: 'English',
}

const STORAGE_KEY = 'rgg.locale'

/**
 * The Uzbek dictionary is the source of truth for the shape. Every other locale must supply
 * the same keys, so a missing translation is a build error rather than a blank label.
 */
export type Dictionary = typeof uz

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale)
}

export function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

export function storeLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Private mode: the choice still applies for this session.
  }
}

/**
 * First visit: follow the browser, since that is the best evidence of what the visitor reads.
 * Anything we do not speak falls back to Uzbek rather than to English.
 */
export function detectLocale(): Locale {
  const stored = readStoredLocale()
  if (stored) return stored

  if (typeof navigator === 'undefined') return DEFAULT_LOCALE

  for (const candidate of navigator.languages ?? [navigator.language]) {
    const base = candidate?.split('-')[0]?.toLowerCase()
    if (isLocale(base)) return base
  }

  return DEFAULT_LOCALE
}

export interface LocaleState {
  locale: Locale
  t: Dictionary
  setLocale: (next: Locale) => void
}

export const LocaleContext = createContext<LocaleState | null>(null)

export function useLocale(): LocaleState {
  const value = useContext(LocaleContext)
  if (!value) {
    throw new Error('useLocale must be used inside <LocaleProvider>.')
  }

  return value
}

/** Shorthand for the common case: only the strings are needed. */
export function useT(): Dictionary {
  return useLocale().t
}

/**
 * Fills `{name}` placeholders. Kept deliberately small — the alternative is a formatting
 * library for what is a dozen interpolations across the app.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}

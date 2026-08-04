import type { Locale } from './i18n'

/** The three variants of a piece of content, as the server stores them. */
export interface Translated {
  uz: string
  ru?: string | null
  en?: string | null
}

/**
 * Picks the right language for text the server stores rather than the dictionary holds —
 * mission titles, milestone names, a day's focus. It is content, written per row, and it
 * arrives in as many languages as somebody has written.
 *
 * Chosen here rather than resolved on the server for a specific reason: switching language in
 * this app is instant, and a server-resolved title would stay in the old language until the
 * query that owns it refetched.
 *
 * Uzbek is the fallback because it is the language every row is guaranteed to have. A blank
 * line is never the right answer: showing the language that exists is honest about a
 * translation nobody has written yet.
 */
export function pickContent(locale: Locale, text: Translated): string {
  if (locale === 'ru') return text.ru?.trim() || text.uz
  if (locale === 'en') return text.en?.trim() || text.uz

  return text.uz
}

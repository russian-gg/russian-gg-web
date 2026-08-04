import type { Locale } from './i18n'

/**
 * Picks the right language for text the server stores rather than the dictionary holds —
 * mission titles, milestone names, a day's focus. These are content, written per row in the
 * database, and they arrive as a pair.
 *
 * Chosen here rather than resolved on the server for a specific reason: switching language in
 * this app is instant and does not refetch anything. A server-resolved title would stay in
 * the old language until whatever query happens to own it goes stale.
 *
 * English falls back to Uzbek, the product default, because there is no English content in
 * the database — only Uzbek and Russian. That is a content gap, not a rendering one, and it
 * is honest to show the language that exists rather than an empty line.
 */
export function pickContent(locale: Locale, uz: string, ru?: string | null): string {
  return locale === 'ru' && ru ? ru : uz
}

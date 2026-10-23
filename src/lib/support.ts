import { api } from './api'
import type { TelegramLink } from './types'

/**
 * Where a learner reaches a person.
 *
 * The bot, not the channel: this is the button somebody presses when they are stuck or about
 * to give up, and the bot is the end that answers. A channel would have taken them somewhere
 * they can read but not be heard.
 *
 * One constant because more than one screen offers it, and a support address that drifts
 * between two places is one of them being wrong.
 */
export const SUPPORT_TELEGRAM_URL = 'https://t.me/russian_gg_bot'

/**
 * The bot link for somebody who is signed in: the same bot, carrying a one-time token that
 * ties the chat to their account. Without it every conversation starts as a stranger's, and
 * whoever answers — the agent or a person — cannot see that this learner already paid, or
 * where they stopped.
 *
 * Falls back to the plain link rather than failing: a learner who is stuck must always reach
 * the bot, linked or not.
 */
export async function linkedTelegramUrl(): Promise<string> {
  try {
    const link = await api.post<TelegramLink>('/integrations/telegram/link')
    return link.deepLink || SUPPORT_TELEGRAM_URL
  } catch {
    return SUPPORT_TELEGRAM_URL
  }
}

/**
 * The public feed. A learner checks this before trusting the product with their voice — a
 * different job from the bot, which answers once they are already stuck. Constant for the same
 * reason: a handle spelled two ways in two places is one of them being wrong.
 */
export const SUPPORT_INSTAGRAM_URL = 'https://instagram.com/russian_gg.app'

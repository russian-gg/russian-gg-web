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
 * The public feed. A learner checks this before trusting the product with their voice — a
 * different job from the bot, which answers once they are already stuck. Constant for the same
 * reason: a handle spelled two ways in two places is one of them being wrong.
 */
export const SUPPORT_INSTAGRAM_URL = 'https://instagram.com/russian_gg.app'

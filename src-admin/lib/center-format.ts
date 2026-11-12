import { formatDate, formatNumber } from './api'
import { somFromTiyin } from './center-types'

export const formatSom = (tiyin: number) => `${formatNumber(somFromTiyin(tiyin))} so'm`

export const fieldClass =
  'h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none'

/** "3 kun oldin", or the date once it is more than a week away. */
export function lastActiveLabel(date: string | null) {
  if (!date) return '—'
  const days = Math.floor((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000)
  if (days <= 0) return 'Bugun'
  if (days === 1) return 'Kecha'
  if (days < 7) return `${days} kun oldin`
  return formatDate(date)
}

/** "12 нояб. 2026 – 11 дек. 2026": the month an invoice pays for. */
export const formatPeriod = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`

/** Today as a calendar date in the browser's own zone, for a date input's default. */
export function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** The public page a center pays an invoice on. It lives on this same admin host. */
export const payLink = (token: string) => `${window.location.origin}/pay/${token}`

/** The token in "/pay/{token}", or null on every other path. */
export function payTokenFromPath(pathname: string) {
  const match = /^\/pay\/([A-Za-z0-9_-]{8,64})\/?$/.exec(pathname)
  return match ? match[1] : null
}

// ------------------------------------------------------------------------------- phones


/**
 * The nine digits after +998 out of whatever was typed or pasted: "90 123 45 67",
 * "+998 (90) 123-45-67", "998901234567". Null when it is not an Uzbek mobile number.
 */
export function uzLocalDigits(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 9) return digits
  if (digits.length === 12 && digits.startsWith('998')) return digits.slice(3)
  return null
}

/** "+998901234567", or null — what is sent to the server. */
export function toUzPhone(value: string) {
  const local = uzLocalDigits(value)
  return local ? `+998${local}` : null
}

/**
 * Up to nine digits shown as they are read aloud: "90 123 45 67". Used while typing, so a
 * half-written number grows in the same groups instead of jumping around.
 */
export function maskUzLocal(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.length > 9 && digits.startsWith('998')) digits = digits.slice(3)
  digits = digits.slice(0, 9)
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(' ')
}

/** "+998 90 123 45 67" for showing a stored number. */
export function formatUzPhone(value: string | null) {
  if (!value) return ''
  const local = uzLocalDigits(value)
  return local ? `+998 ${maskUzLocal(local)}` : value
}

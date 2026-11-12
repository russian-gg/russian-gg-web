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


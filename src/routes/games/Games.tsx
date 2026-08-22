import { Link } from 'react-router-dom'
import { useOpenGames } from '../../lib/games'
import { Spinner } from '../../components/ui'
import { cx } from '../../lib/cx'

/**
 * The shelf. Built like a store rather than a menu: a grid of tiles, each with its own mark,
 * because what makes somebody try a game is recognising it at a glance and wanting that one.
 *
 * What is on it is the panel's decision, not this file's. Only the artwork lives here — a game
 * the server has not opened is not drawn at all, so nobody is shown a door that does not open.
 */
/** Everything the app can draw, keyed by the slug the server switches on. */
const ART: Record<string, { emoji: string; tint: string; to?: string }> = {
  arra: { emoji: '🪚', tint: 'from-signal/25 to-signal/5', to: '/games/arra' },
  'rod-runner': { emoji: '🏃', tint: 'from-caution/30 to-signal/10', to: '/games/rod-runner' },
  'soz-ovi': { emoji: '🎯', tint: 'from-milestone/25 to-milestone/5' },
  'tez-javob': { emoji: '⚡️', tint: 'from-caution/25 to-caution/5' },
  dialog: { emoji: '💬', tint: 'from-signal/25 to-signal/5' },
  'eshitib-top': { emoji: '🎧', tint: 'from-milestone/25 to-milestone/5' },
  xotira: { emoji: '🃏', tint: 'from-caution/25 to-caution/5' },
}

export function Games() {
  const open = useOpenGames()

  if (!open) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">O'yinlar</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Gapirishni mashq qilishning eng qisqa yo'li — o'ynab.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {open.map((game) => {
          const art = ART[game.slug]

          return (
            <Link
              key={game.slug}
              to={art?.to ?? '/home'}
              className="flex items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-3.5 text-left transition-colors hover:border-signal"
            >
              <span
                className={cx(
                  'grid size-14 shrink-0 place-items-center rounded-[var(--radius-card)] bg-gradient-to-br text-3xl',
                  art?.tint ?? 'from-signal/25 to-signal/5',
                )}
                aria-hidden
              >
                {art?.emoji ?? '🎮'}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-base font-black text-ink">{game.titleUz}</span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-muted">{game.bodyUz}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

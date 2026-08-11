import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'

/**
 * The shelf. Built like a store rather than a menu: a grid of tiles, each with its own mark,
 * because what makes somebody try a game is recognising it at a glance and wanting that one.
 *
 * The unbuilt ones are shown rather than hidden. A shelf with a single item reads as a feature
 * nobody finished; a shelf with one open door and five behind it reads as a place worth
 * coming back to — and it is honest about which is which.
 */
const GAMES = [
  {
    to: '/games/arra',
    title: 'Arra',
    body: "To'xtamay gapiring — jim qolsangiz, arra yaqinlashadi.",
    emoji: '🪚',
    tint: 'from-signal/25 to-signal/5',
    ready: true,
  },
  { title: "So'z ovi", body: "Rasm bo'yicha ruscha so'zni toping.", emoji: '🎯', tint: 'from-milestone/25 to-milestone/5' },
  { title: 'Tez javob', body: '10 soniyada javob bering.', emoji: '⚡️', tint: 'from-caution/25 to-caution/5' },
  { title: 'Dialog', body: "Suhbatni to'g'ri tartibda tuzing.", emoji: '💬', tint: 'from-signal/25 to-signal/5' },
  { title: 'Eshitib top', body: 'Eshitgan gapingizni tanlang.', emoji: '🎧', tint: 'from-milestone/25 to-milestone/5' },
  { title: 'Xotira', body: "Juftlarni toping — so'z va tarjimasi.", emoji: '🃏', tint: 'from-caution/25 to-caution/5' },
] as const

export function Games() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">O'yinlar</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Gapirishni mashq qilishning eng qisqa yo'li — o'ynab.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {GAMES.map((game) => {
          const tile = (
            <>
              <span
                className={cx(
                  'grid size-14 shrink-0 place-items-center rounded-[var(--radius-card)] bg-gradient-to-br text-3xl',
                  game.tint,
                )}
                aria-hidden
              >
                {game.emoji}
              </span>

              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-base font-black text-ink">{game.title}</span>
                  {!('ready' in game) && (
                    <span className="shrink-0 rounded-[var(--radius-control)] bg-signal px-2 py-0.5 text-[11px] font-bold text-on-signal">
                      Tez orada
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-muted">{game.body}</span>
              </span>
            </>
          )

          const shell =
            'flex items-center gap-3.5 rounded-[var(--radius-card)] border-2 p-3.5 text-left transition-colors'

          return 'ready' in game ? (
            <Link
              key={game.title}
              to={game.to}
              className={cx(shell, 'border-hairline bg-ground-raised hover:border-signal')}
            >
              {tile}
            </Link>
          ) : (
            // Not a link and not a button: there is nothing behind it, and a tile that
            // depresses under the finger promises something it cannot do.
            <div key={game.title} className={cx(shell, 'border-hairline bg-ground-raised/60 opacity-75')}>
              {tile}
            </div>
          )
        })}
      </div>
    </div>
  )
}

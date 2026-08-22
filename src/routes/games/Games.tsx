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

      <div className="grid gap-4 sm:grid-cols-2">
        {[...open].sort((left, right) => Number(right.slug === 'rod-runner') - Number(left.slug === 'rod-runner')).map((game) => {
          const art = ART[game.slug]

          if (game.slug === 'rod-runner') return <RunnerCard key={game.slug} title={game.titleUz} body={game.bodyUz} />

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

function RunnerCard({ title, body }: { title: string; body: string }) {
  let highScore = 0
  try {
    const saved = Number(localStorage.getItem('rgg_gender_runner_highscore'))
    highScore = Number.isFinite(saved) ? saved : 0
  } catch {
    // The card still works when private browsing blocks local storage.
  }

  return (
    <Link
      to="/games/rod-runner"
      className="group relative overflow-hidden rounded-[32px] border border-slate-700 bg-gradient-to-br from-[#111827] via-[#1e293b] to-[#0f172a] p-5 text-white shadow-2xl transition duration-300 hover:-translate-y-1 sm:col-span-2 sm:p-7"
    >
      <span className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-amber-500/10 blur-3xl transition group-hover:bg-amber-500/20" />
      <span className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-blue-500/10 blur-3xl" />

      <span className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/20 px-3 py-1 text-[11px] font-black tracking-wider text-rose-300 uppercase">
          <span className="size-2 animate-pulse rounded-full bg-rose-500" /> Yangi o‘yin
        </span>
        <span className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">🏆 Rekord: {highScore}</span>
      </span>

      <span className="relative mt-4 grid gap-5 md:grid-cols-[1.25fr_1fr] md:items-center">
        <span className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-blue-900 via-slate-900 to-black">
          <span className="absolute inset-x-[18%] bottom-0 h-32 origin-bottom bg-gradient-to-t from-amber-800 to-amber-600/30 [clip-path:polygon(43%_0,57%_0,100%_100%,0_100%)]" />
          <span className="relative z-10 flex flex-col items-center gap-3 transition duration-300 group-hover:scale-105">
            <span className="rounded-xl border-2 border-amber-600 bg-amber-100 px-4 py-1.5 text-sm font-black text-amber-950 shadow-xl">«ПЕРСИК»</span>
            <span className="flex gap-1.5 text-[9px] font-black uppercase min-[370px]:text-[10px]">
              <span className="rounded border border-blue-400 bg-blue-600/90 px-2 py-1">Мужской</span>
              <span className="rounded border border-rose-400 bg-rose-600/90 px-2 py-1">Женский</span>
              <span className="rounded border border-amber-300 bg-amber-500/90 px-2 py-1 text-amber-950">Средний</span>
            </span>
            <span className="text-4xl drop-shadow-xl" aria-hidden>🐼</span>
          </span>
        </span>

        <span>
          <strong className="block text-2xl font-black sm:text-3xl">{title || 'Gender Runner'}</strong>
          <span className="mt-2 block text-sm leading-relaxed text-slate-300">{body}</span>
          <span className="mt-2 block text-xs leading-relaxed text-slate-400">Pandani uch yo‘lakda boshqaring, tangalarni yig‘ing, yog‘ochlardan sakrang va ruscha otlarning rodini toping.</span>
          <span className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-black shadow-lg shadow-rose-500/20 transition group-hover:scale-105">
            ▶ O‘ynash
          </span>
          <span className="ml-3 text-xs font-bold text-slate-400">3D o‘rmon yugurishi</span>
        </span>
      </span>
    </Link>
  )
}

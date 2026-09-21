import { Link } from 'react-router-dom'
import { BarChart3, ClipboardList, Clock, Gamepad2, GraduationCap, Target } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { missionPath } from '../../lib/mission-path'
import type { MissionSummary } from '../../lib/types'
import { Badge } from '../ui'

/**
 * The five doors into the rest of the product.
 *
 * Every one of these is already in the sidebar, which is the point rather than a duplication:
 * the sidebar is furniture a returning learner stops seeing, and this is the one place a new
 * one is told what the course actually contains. Coming-soon entries stay in the grid and say
 * so — a door that is not there yet is still worth knowing about, and hiding it means the
 * learner finds out by looking for something that seems to be missing.
 */
export function FeatureTiles() {
  const t = useT()

  const tiles = [
    { key: 'today', to: '/path', icon: <CapGlyph />, tone: 'signal' as const },
    { key: 'tasks', to: '/practice', icon: <TargetGlyph />, tone: 'signal' as const },
    { key: 'tests', to: null, icon: <TestGlyph />, tone: 'muted' as const },
    { key: 'games', to: '/games', icon: <GameGlyph />, tone: 'signal' as const },
    { key: 'progress', to: '/progress', icon: <ChartGlyph />, tone: 'signal' as const },
  ] as const

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => {
        const copy = t.home.features[tile.key]
        const body = (
          <>
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-[var(--radius-control)] bg-signal-soft text-signal"
            >
              {tile.icon}
            </span>
            {tile.to === null && (
              <span className="absolute top-3 right-3">
                <Badge tone="signal">{t.nav.comingSoon}</Badge>
              </span>
            )}
            <span className="mt-4 block text-[15px] font-extrabold text-ink">{copy.title}</span>
            <span className="text-support mt-1 block text-xs leading-snug">{copy.body}</span>
          </>
        )

        const shell =
          'relative flex h-full flex-col rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-4 text-left'

        return tile.to === null ? (
          <div key={tile.key} className={`${shell} opacity-70`}>
            {body}
          </div>
        ) : (
          <Link
            key={tile.key}
            to={tile.to}
            className={`${shell} transition hover:-translate-y-0.5 hover:border-signal hover:shadow-md`}
          >
            {body}
          </Link>
        )
      })}
    </div>
  )
}

/**
 * The practice shelf, as a row that scrolls sideways.
 *
 * The cards carry a tinted panel rather than a photograph. The product has exactly one lesson
 * scene image, so a picture on every card would mean the same one five times or four
 * invented ones; the tint is derived from the slug, which at least makes a given lesson look
 * like itself every time it appears.
 */
export function RecommendedLessons({ missions }: { missions: MissionSummary[] }) {
  const t = useT()

  if (missions.length === 0) return null

  return (
    <ul className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
      {missions.map((mission) => (
        <li key={mission.id} className="w-56 shrink-0 snap-start">
          <Link
            to={missionPath(mission)}
            className="block h-full overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-ground-raised transition hover:-translate-y-0.5 hover:border-signal hover:shadow-md"
          >
            <span
              aria-hidden="true"
              className="relative block h-24"
              style={{ background: tintFor(mission.slug) }}
            >
              <span className="absolute top-2.5 left-2.5 rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-black text-[#12315f]">
                {t.labels.level[mission.targetLevel]}
              </span>
            </span>
            <span className="block p-3.5">
              <span className="line-clamp-2 block text-sm font-bold text-ink">
                {mission.titleUz}
              </span>
              <span className="text-support mt-2 flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <ClockGlyph />
                  {t.home.recommended.minutes.replace(
                    '{count}',
                    String(mission.estimatedMinutes),
                  )}
                </span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * A stable colour per lesson, derived from its slug so the same card is the same colour on
 * every visit and two neighbours are rarely the same. Hue only — saturation and lightness are
 * fixed, which keeps every card in the same family as the hero rather than a rainbow.
 */
function tintFor(slug: string) {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 360
  }

  // Kept inside the blues and violets the product already uses.
  const hue = 195 + (hash % 70)
  return `linear-gradient(135deg, hsl(${hue} 72% 72%), hsl(${hue + 18} 68% 58%))`
}

function ClockGlyph() {
  return (
    <Clock aria-hidden="true" strokeWidth={2} className="size-3.5" />
  )
}

function CapGlyph() {
  return (
    <GraduationCap aria-hidden="true" strokeWidth={1.9} className="size-5" />
  )
}

function TargetGlyph() {
  return (
    <Target aria-hidden="true" strokeWidth={1.9} className="size-5" />
  )
}

function TestGlyph() {
  return (
    <ClipboardList aria-hidden="true" strokeWidth={1.9} className="size-5" />
  )
}

function GameGlyph() {
  return (
    <Gamepad2 aria-hidden="true" strokeWidth={1.9} className="size-5" />
  )
}

function ChartGlyph() {
  return (
    <BarChart3 aria-hidden="true" strokeWidth={1.9} className="size-5" />
  )
}

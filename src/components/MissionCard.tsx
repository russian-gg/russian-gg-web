import { Link } from 'react-router-dom'
import { fill, useT } from '../lib/i18n'
import type { MissionSummary } from '../lib/types'
import { Badge } from './ui'

export function MissionCard({ mission }: { mission: MissionSummary }) {
  const t = useT()
  const isProLock =
    mission.isLocked && (mission.lockReason?.toLowerCase().includes('pro') ?? false)

  const needsRegisterLabel =
    mission.category === 'StreetRussian' ||
    mission.formality === 'Informal' ||
    mission.formality === 'Slang' ||
    mission.workplaceUse !== 'Safe'

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t.labels.category[mission.category]}</Badge>
        {mission.courseDay && <Badge>{fill(t.common.day, { day: mission.courseDay })}</Badge>}
        {mission.isCompleted && <Badge tone="milestone">{t.path.done}</Badge>}
        {mission.isLocked && <Badge tone="caution">{isProLock ? t.path.needsPro : t.common.later}</Badge>}
      </div>

      <h3 className="mt-3 text-lg font-extrabold leading-snug text-ink">{mission.titleUz}</h3>
      <p className="text-support">{mission.objectiveUz}</p>

      {/*
        Register and workplace-appropriateness are surfaced on the card itself, not buried
        inside the mission: a learner should know before they open it (PRD principle 5).
      */}
      {needsRegisterLabel && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="caution">{t.labels.formality[mission.formality]}</Badge>
          <Badge tone={mission.workplaceUse === 'Safe' ? 'neutral' : 'caution'}>
            {t.labels.workplace[mission.workplaceUse]}
          </Badge>
        </div>
      )}

      <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
        {fill(t.common.minutes, { count: mission.estimatedMinutes })} · {mission.targetLevel}
        {mission.isLocked && mission.lockReason ? ` · ${mission.lockReason}` : ''}
      </p>
    </>
  )

  // A mission card is a thing you push, so it behaves like one: it rests on a solid edge,
  // rises toward the cursor and sinks onto that edge when tapped.
  const className =
    'block rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-5 ' +
    'shadow-[0_4px_0_0_var(--color-control-depth)] ' +
    'transition-[border-color,box-shadow,transform] duration-150 ' +
    'hover:-translate-y-0.5 hover:border-signal hover:shadow-[0_6px_0_0_var(--color-control-depth)] ' +
    'focus-visible:border-signal active:translate-y-1 active:shadow-none'

  if (mission.isLocked) {
    return (
      <Link to={isProLock ? '/paywall' : '/home'} className={`${className} opacity-75`}>
        {body}
      </Link>
    )
  }

  return (
    <Link to={`/missions/${mission.id}`} className={className}>
      {body}
    </Link>
  )
}

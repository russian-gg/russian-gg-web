import { Link } from 'react-router-dom'
import { formalityLabelUz, workplaceLabelUz } from '../lib/format'
import type { MissionSummary } from '../lib/types'
import { Badge } from './ui'

const categoryLabelUz = {
  Work: 'Ish',
  DailyLife: 'Kundalik hayot',
  Social: 'Muloqot',
  StreetRussian: 'Jonli nutq',
  Repair: 'Mustahkamlash',
} as const

export function MissionCard({ mission }: { mission: MissionSummary }) {
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
        <Badge>{categoryLabelUz[mission.category]}</Badge>
        {mission.courseDay && <Badge>{mission.courseDay}-kun</Badge>}
        {mission.isCompleted && <Badge tone="milestone">Bajarildi</Badge>}
        {mission.isLocked && <Badge tone="caution">{isProLock ? 'Pro kerak' : 'Keyinroq'}</Badge>}
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug text-ink">{mission.titleUz}</h3>
      <p className="text-support">{mission.objectiveUz}</p>

      {/*
        Register and workplace-appropriateness are surfaced on the card itself, not buried
        inside the mission: a learner should know before they open it (PRD principle 5).
      */}
      {needsRegisterLabel && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="caution">{formalityLabelUz[mission.formality]}</Badge>
          <Badge tone={mission.workplaceUse === 'Safe' ? 'neutral' : 'caution'}>
            {workplaceLabelUz[mission.workplaceUse]}
          </Badge>
        </div>
      )}

      <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
        {mission.estimatedMinutes} daqiqa · {mission.targetLevel}
        {mission.isLocked && mission.lockReason ? ` · ${mission.lockReason}` : ''}
      </p>
    </>
  )

  const className =
    'block rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-5 transition ' +
    'hover:border-signal focus-visible:border-signal'

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

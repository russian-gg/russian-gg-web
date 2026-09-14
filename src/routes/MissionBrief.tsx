import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { characterName, characterPalette } from '../lib/character'
import { fill, useT } from '../lib/i18n'
import { mascotAlt, mascotImage } from '../lib/mascot-images'
import type { Mascot } from '../lib/foundation-lessons'
import type { MissionDetail } from '../lib/types'
import { Button, Card, ErrorNote, Spinner } from '../components/ui'
import { MissionPlayer } from './MissionPlayer'

/**
 * The route every mission opens on. A converted mission gets its brief — who you are about to
 * talk to, what you are trying to do, and how long you have — and the rest keep the step
 * player they have always used.
 */
export function MissionEntry() {
  const { missionId } = useParams<{ missionId: string }>()
  const { data, isLoading, error } = useQuery({
    queryKey: ['mission-detail', missionId],
    queryFn: () => api.get<MissionDetail>(`/missions/${missionId}`),
    enabled: Boolean(missionId),
  })

  if (isLoading) return <Spinner />
  if (error || !data) return <MissionPlayer />

  return data.dialogue ? <MissionBrief mission={data} /> : <MissionPlayer />
}

type MissionBriefProps = {
  mission: MissionDetail
}

const MASCOT_BY_CHARACTER: Record<string, Mascot> = {
  Penguin: 'penguin',
  Panda: 'panda',
  Pero: 'pero',
}

export function MissionBrief({ mission }: MissionBriefProps) {
  const t = useT()
  const navigate = useNavigate()
  const [showCooldown, setShowCooldown] = useState(false)
  const dialogue = mission.dialogue!
  const copy = t.missionBrief
  const palette = characterPalette(dialogue.character)
  const mascot = MASCOT_BY_CHARACTER[dialogue.character]
  const name = characterName(dialogue.character, t)
  const remaining = useCountdown(dialogue.retry.retryAvailableAt)
  const locked = !dialogue.retry.canStart

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <header className="flex items-center gap-4">
        {mascot && (
          <span
            className="grid size-20 shrink-0 place-items-center rounded-full sm:size-24"
            style={{ background: `${palette.light}22` }}
          >
            <img src={mascotImage(mascot)} alt={mascotAlt(mascot)} className="size-16 sm:size-20" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-[0.14em] uppercase" style={{ color: palette.deep }}>
            {fill(copy.eyebrow, { character: name })}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{mission.summary.titleUz}</h1>
          <p className="mt-1 text-sm text-ink-muted">{mission.summary.objectiveUz}</p>
        </div>
      </header>

      <Card className="space-y-4">
        <Row title={copy.goalTitle} value={dialogue.goalUz ?? mission.summary.objectiveUz} />
        <Row title={copy.timeTitle} value={fill(copy.timeValue, { count: Math.round(dialogue.conversationSeconds / 60) })} />
        <Row title={copy.passTitle} value={fill(copy.passValue, { score: dialogue.passScore })} />
      </Card>

      {mission.targetPhrases.length > 0 && (
        <Card>
          <h2 className="text-sm font-extrabold text-ink">{copy.phrasesTitle}</h2>
          <ul className="mt-3 space-y-2">
            {mission.targetPhrases.map((phrase) => (
              <li key={phrase.order} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold text-ink">{phrase.russian}</span>
                <span className="text-sm text-ink-muted">{phrase.uzbekMeaning}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-extrabold text-ink">{copy.howTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{copy.howBody}</p>
      </Card>

      {locked && remaining && <ErrorNote>{fill(copy.cooldownBody, { time: remaining })}</ErrorNote>}

      <div className="space-y-2">
        <Button
          block
          size="lg"
          disabled={locked}
          aria-disabled={locked}
          onClick={() => (locked ? setShowCooldown(true) : navigate(`/missions/${mission.summary.id}/live`))}
        >
          {locked ? copy.retryLocked : copy.start}
        </Button>
        {!locked && dialogue.retry.immediateRetriesLeft > 0 && (
          <p className="text-center text-xs text-ink-faint">
            {fill(copy.retriesLeft, { count: dialogue.retry.immediateRetriesLeft })}
          </p>
        )}
      </div>

      {/*
        The button is disabled rather than hidden, and pressing it explains why: a learner who
        came back for another go should be told when they can have one, not met with a control
        that silently does nothing.
      */}
      {showCooldown && (
        <button
          type="button"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setShowCooldown(false)}
        >
          <span className="w-full max-w-sm rounded-[var(--radius-card)] bg-ground-raised p-6 text-left shadow-2xl">
            <span className="block text-lg font-extrabold text-ink">{copy.cooldownTitle}</span>
            <span className="mt-2 block text-sm text-ink-muted">
              {fill(copy.cooldownBody, { time: remaining ?? '—' })}
            </span>
            <span className="mt-5 block rounded-[var(--radius-control)] bg-signal px-4 py-3 text-center text-sm font-extrabold text-on-signal">
              {copy.cooldownOk}
            </span>
          </span>
        </button>
      )}
    </div>
  )
}

type RowProps = {
  title: string
  value: string
}

function Row({ title, value }: RowProps) {
  return (
    <div>
      <span className="text-xs font-extrabold tracking-[0.12em] text-ink-faint uppercase">{title}</span>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

/** Counts a cooldown down while the learner watches it, so the wait is visibly finite. */
function useCountdown(until?: string | null) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!until) {
      setLabel(null)
      return
    }

    const target = new Date(until).getTime()
    const tick = () => {
      const left = Math.max(0, Math.round((target - Date.now()) / 1000))
      const hours = Math.floor(left / 3600)
      const minutes = Math.floor((left % 3600) / 60)
      const seconds = left % 60
      setLabel(
        hours > 0
          ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          : `${minutes}:${String(seconds).padStart(2, '0')}`,
      )
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [until])

  return label
}

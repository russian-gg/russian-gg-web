import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { useFocusTrap } from '../lib/focus-trap'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { characterName, characterPalette } from '../lib/character'
import { fill, useT } from '../lib/i18n'
import { mascotAlt, mascotImage } from '../lib/mascot-images'
import type { Mascot } from '../lib/foundation-lessons'
import type { MissionDetail } from '../lib/types'
import { Button, Card, Spinner } from '../components/ui'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { backdrop, sheet } from '../lib/motion'
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
  const dialogRef = useFocusTrap<HTMLDivElement>()
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
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/*
        The character comes first and fills the width, the way the day card does on Home. A
        learner is about to talk to somebody: who that is should be the largest thing here,
        and the tint is theirs so the brief and the conversation read as one place.
      */}
      <header
        className="relative overflow-hidden rounded-[var(--radius-card)] border border-hairline px-6 py-7 sm:px-8"
        style={{
          background: `linear-gradient(140% 120% at 82% 0%, ${palette.light}2e 0%, var(--color-ground-raised) 62%)`,
        }}
      >
        <div className="flex items-center gap-4 sm:gap-5">
          {mascot && (
            <span
              className="grid size-24 shrink-0 place-items-center rounded-full sm:size-28"
              style={{ background: `${palette.light}26`, boxShadow: `inset 0 0 0 1px ${palette.light}40` }}
            >
              <img src={mascotImage(mascot)} alt={mascotAlt(mascot)} className="size-20 sm:size-24" />
            </span>
          )}
          <div className="min-w-0">
            <span
              className="inline-flex items-center rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-extrabold tracking-[0.12em] uppercase"
              style={{ background: `${palette.light}2b`, color: palette.deep }}
            >
              {fill(copy.eyebrow, { character: name })}
            </span>
            <h1 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight text-ink sm:text-3xl">
              {mission.summary.titleUz}
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-ink-muted sm:text-base">
          {mission.summary.objectiveUz}
        </p>
      </header>

      {/* The goal is the one thing that decides whether the conversation ends, so it leads. */}
      <Card className="border-l-4" style={{ borderLeftColor: palette.light }}>
        <span className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
          {copy.goalTitle}
        </span>
        <p className="mt-2 text-base leading-relaxed font-bold text-ink">
          {dialogue.goalUz ?? mission.summary.objectiveUz}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label={copy.timeTitle} value={fill(copy.timeValue, { count: Math.round(dialogue.conversationSeconds / 60) })} />
        <Stat label={copy.passTitle} value={fill(copy.passValue, { score: dialogue.passScore })} />
      </div>

      {mission.targetPhrases.length > 0 && (
        <Card>
          <h2 className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
            {copy.phrasesTitle}
          </h2>
          <ul className="mt-4 divide-y divide-hairline">
            {mission.targetPhrases.map((phrase) => (
              <li key={phrase.order} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <span className="font-bold text-ink">{phrase.russian}</span>
                <span className="text-sm text-ink-muted">{phrase.uzbekMeaning}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="bg-ground-sunken/60">
        <h2 className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
          {copy.howTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{copy.howBody}</p>
      </Card>

      {/*
        The start control sits on its own raised strip, pinned on a phone: it is the only
        action on this screen and should never be the thing a learner has to scroll for.
      */}
      <div className="sticky bottom-3 z-10 space-y-2 rounded-[var(--radius-card)] border border-hairline bg-ground-raised/95 p-3 shadow-[0_10px_30px_rgb(22_24_29/0.10)] backdrop-blur-sm">
        <Button
          block
          size="lg"
          disabled={locked}
          aria-disabled={locked}
          onClick={() => (locked ? setShowCooldown(true) : navigate(`/missions/${mission.summary.id}/live`))}
        >
          {locked ? copy.retryLocked : copy.start}
        </Button>
        <p className="text-center text-xs font-semibold text-ink-faint">
          {locked && remaining
            ? fill(copy.cooldownBody, { time: remaining })
            : dialogue.retry.immediateRetriesLeft > 0
              ? fill(copy.retriesLeft, { count: dialogue.retry.immediateRetriesLeft })
              : ''}
        </p>
      </div>

      {/*
        The button is disabled rather than hidden, and pressing it explains why: a learner who
        came back for another go should be told when they can have one, not met with a control
        that silently does nothing.
      */}
      <AnimatePresence>
        {showCooldown && (
        <m.div
          key="cooldown"
          ref={dialogRef}
          tabIndex={-1}
          variants={backdrop}
          initial="hidden"
          animate="shown"
          exit="exit"
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mission-cooldown-title"
        >
          <m.div variants={sheet} className="w-full max-w-sm rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-6 shadow-2xl">
            <div
              className="grid size-12 place-items-center rounded-full"
              style={{ background: `${palette.light}26`, color: palette.deep }}
            >
              <ClockGlyph />
            </div>
            <h2 id="mission-cooldown-title" className="mt-4 text-lg font-extrabold text-ink">
              {copy.cooldownTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {fill(copy.cooldownBody, { time: remaining ?? '—' })}
            </p>
            <Button block className="mt-5" onClick={() => setShowCooldown(false)}>
              {copy.cooldownOk}
            </Button>
          </m.div>
        </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type StatProps = {
  label: string
  value: string
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-ground-raised px-4 py-3.5">
      <span className="text-xs font-extrabold tracking-[0.12em] text-ink-faint uppercase">{label}</span>
      <p className="mt-1.5 text-base font-extrabold text-ink">{value}</p>
    </div>
  )
}

function ClockGlyph() {
  return (
    <Clock aria-hidden="true" strokeWidth={1.8} className="size-6" />
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

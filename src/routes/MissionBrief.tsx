import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { useFocusTrap } from '../lib/focus-trap'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { characterName, characterPalette } from '../lib/character'
import { missionPath } from '../lib/mission-path'
import { pickContent } from '../lib/content'
import { fill, useLocale, useT, type Dictionary } from '../lib/i18n'
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
  if (data.dialogue) return <MissionBrief mission={data} />

  /*
   * A course day with an authored lesson is played as that lesson. Links that only know the
   * mission id — the level test's "first exercise", search, a repair suggestion — used to land
   * here and open the old step player for day 1 instead.
   */
  const lessonPath = missionPath(data.summary)
  if (lessonPath.startsWith('/lessons/')) return <Navigate to={lessonPath} replace />

  return <MissionPlayer />
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
  const { locale } = useLocale()
  const palette = characterPalette(dialogue.character)
  const mascot = MASCOT_BY_CHARACTER[dialogue.character]
  const name = characterName(dialogue.character, t)
  const remaining = useCountdown(dialogue.retry.retryAvailableAt)
  const locked = !dialogue.retry.canStart
  const queryClient = useQueryClient()

  // When the wait runs out the server is asked again, so the button opens without a reload.
  const waitOver = locked && remaining === '0:00'
  useEffect(() => {
    if (waitOver) void queryClient.invalidateQueries({ queryKey: ['mission-detail', mission.summary.id] })
  }, [waitOver, queryClient, mission.summary.id])

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
              className="grid size-16 shrink-0 place-items-center rounded-full min-[400px]:size-24 sm:size-28"
              style={{ background: `${palette.light}26`, boxShadow: `inset 0 0 0 1px ${palette.light}40` }}
            >
              <img src={mascotImage(mascot)} alt={mascotAlt(mascot)} className="size-14 min-[400px]:size-20 sm:size-24" />
            </span>
          )}
          <div className="min-w-0">
            <span
              className="inline-flex items-center rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-extrabold tracking-[0.12em] uppercase"
              style={{ background: `${palette.light}2b`, color: palette.deep }}
            >
              {fill(copy.eyebrow, { character: name })}
            </span>
            <h1 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight wrap-break-word text-ink sm:text-3xl">
              {pickContent(locale, { uz: mission.summary.titleUz, ru: mission.summary.titleRu, en: mission.summary.titleEn })}
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-ink-muted sm:text-base">
          {pickContent(locale, { uz: mission.summary.objectiveUz, ru: mission.summary.objectiveRu, en: mission.summary.objectiveEn })}
        </p>
      </header>

      {/* The goal is the one thing that decides whether the conversation ends, so it leads. */}
      <Card className="border-l-4" style={{ borderLeftColor: palette.light }}>
        <span className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
          {copy.goalTitle}
        </span>
        <p className="mt-2 text-base leading-relaxed font-bold text-ink">
          {pickContent(locale, {
            uz: dialogue.goalUz ?? mission.summary.objectiveUz,
            ru: dialogue.goalRu ?? mission.summary.objectiveRu,
            en: mission.summary.objectiveEn,
          })}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label={copy.timeTitle} value={fill(copy.timeValue, { count: Math.round(dialogue.conversationSeconds / 60) })} />
        <Stat label={copy.passTitle} value={fill(copy.passValue, { score: dialogue.passScore })} />
        {/* The real rule, before the first try: the old copy promised unlimited retries. */}
        <div className="col-span-2">
          <Stat
            label={copy.attemptsTitle}
            value={fill(copy.attemptsValue, { count: MISSION_ATTEMPTS, hours: RETRY_COOLDOWN_HOURS })}
          />
        </div>
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
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 md:bottom-3 space-y-2 rounded-[var(--radius-card)] border border-hairline bg-ground-raised/95 p-3 shadow-[0_10px_30px_rgb(22_24_29/0.10)] backdrop-blur-sm">
        {/*
          Not `disabled`: a disabled button takes no taps at all, so the explanation below was
          never reachable. It looks unavailable and says why when pressed.
        */}
        <Button
          block
          size="lg"
          variant={locked ? 'secondary' : 'primary'}
          aria-disabled={locked}
          className={locked ? 'opacity-60' : undefined}
          onClick={() => (locked ? setShowCooldown(true) : navigate(`/missions/${mission.summary.id}/live`))}
        >
          {locked ? copy.retryLocked : copy.start}
        </Button>
        <p className="text-center text-xs font-semibold text-ink-faint">
          {locked && remaining
            ? fill(copy.cooldownBody, { time: remaining })
            : attemptsCaption(dialogue.retry, copy)}
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
          onClick={() => setShowCooldown(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setShowCooldown(false)
          }}
        >
          <m.div variants={sheet} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-6 shadow-2xl">
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
            {/* The wait is for this conversation only; the rest of the library is open. */}
            <Button block className="mt-5" onClick={() => navigate('/practice')}>
              {copy.cooldownNext}
            </Button>
            <Button variant="ghost" block className="mt-2" onClick={() => setShowCooldown(false)}>
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

/*
 * The server's rule (MissionService: ImmediateAttempts, RetryCooldown): two counted runs, and
 * two fails in a row buy a three-hour wait. The brief states it up front.
 */
const MISSION_ATTEMPTS = 2
const RETRY_COOLDOWN_HOURS = 3

/**
 * The line under the start button. The server counts the retries left *after* the run about to
 * start, so a new learner's "1" read as "1 attempt left" before trying at all; the attempt about
 * to start is added back here, and the last one says it is the last.
 */
function attemptsCaption(retry: { failedAttempts: number; immediateRetriesLeft: number }, copy: Dictionary['missionBrief']) {
  const left = retry.immediateRetriesLeft + 1
  if (left <= 1) return fill(copy.lastAttempt, { hours: RETRY_COOLDOWN_HOURS })
  if (retry.failedAttempts === 0) return fill(copy.attemptsAhead, { count: left, hours: RETRY_COOLDOWN_HOURS })
  return fill(copy.retriesLeft, { count: left })
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

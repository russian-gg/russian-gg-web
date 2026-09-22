import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, track } from '../lib/api'
import { pickContent } from '../lib/content'
import { fill, useLocale, useT } from '../lib/i18n'
import type { MissionResult as MissionResultDto, MissionRetryState, SkillArea } from '../lib/types'
import { Badge, Card, QueryError, SectionHeading, Spinner, UzHint } from '../components/ui'
import { AnimatePresence } from 'motion/react'
import { CountUp, Reveal, Sequence } from '../components/motion'
import { pop, rise, stagger } from '../lib/motion'

/** Detailed scoring appears only after the mission, never during it (PRD §6). */
export function MissionResult() {
  const geminiReply = useT().dayPreview.geminiReply
  const t = useT()
  const { locale } = useLocale()
  const { attemptId = '' } = useParams()
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attempt-result', attemptId],
    queryFn: () => api.get<MissionResultDto>(`/missions/attempts/${attemptId}/result`),
    // The enrichment job fills in detail shortly after completion; poll until it lands.
    refetchInterval: (query) => (query.state.data?.enrichmentPending ? 3000 : false),
  })

  if (isLoading) return <Spinner label={t.result.preparing} />
  if (isError || !data) return <QueryError onRetry={() => void refetch()} />

  // A conversation that fell short is not a completed mission: say so, and say when the next
  // attempt is allowed rather than leaving a learner to guess.
  const failed = data.passed === false

  const skills = Object.entries(data.skillScores) as Array<[SkillArea, number]>

  async function goHome() {
    await queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        ['course-map', 'day-missions', 'progress', 'home'].includes(String(queryKey[0])),
    })
    navigate('/home')
  }

  return (
    /*
      The screen a learner reaches the end of a mission for, so it is the one place in the
      product where the sequence is allowed to be a small performance: the verdict, then the
      score, then the reason, then everything that explains it.
    */
    <Sequence className="grid items-start gap-6 xl:grid-cols-2 xl:gap-8" gap={stagger.wide}>
      <Reveal className="xl:col-span-2">
        <Sequence gap={stagger.wide}>
          <Reveal as="span" variants={pop}>
            <Badge tone={failed ? 'caution' : 'milestone'}>
              {failed ? t.result.notPassed : t.result.completed}
            </Badge>
          </Reveal>
          <Reveal>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">
              {/*
                The one number in this product that earns a count-up.

                It is a standalone figure rather than a digit inside a translated sentence, it
                is the thing the learner came to this screen to find out, and counting to it
                is the difference between being handed a mark and watching it be totted up.

                A failed attempt counts too. Withholding the animation from a low score would
                make the interface visibly disappointed in somebody, which is not this course's
                job - and the number is the same kind of fact either way.
              */}
              <CountUp value={data.overallScore} />{' '}
              <span className="text-lg font-medium text-ink-faint">/ 100</span>
            </h1>
          </Reveal>
          <Reveal>
            <UzHint>{failed ? t.result.notPassedBody : data.strengthNoteUz}</UzHint>
          </Reveal>
        </Sequence>
      </Reveal>

      {failed && (
        <Reveal className="xl:col-span-2">
          <RetryPanel missionId={data.missionId} retry={data.retry ?? null} />
        </Reveal>
      )}

      {data.unlockedMilestone && (
        <Reveal variants={rise}>
        <Card>
          <Badge tone="milestone">{fill(t.result.milestoneUnlocked, { day: data.unlockedMilestone.day })}</Badge>
          <h2 className="mt-3 text-lg font-extrabold text-ink">{pickContent(locale, {
            uz: data.unlockedMilestone.titleUz,
            ru: data.unlockedMilestone.titleRu,
            en: data.unlockedMilestone.titleEn,
          })}</h2>
          <UzHint>{pickContent(locale, {
              uz: data.unlockedMilestone.outcomeUz,
              ru: data.unlockedMilestone.outcomeRu,
              en: data.unlockedMilestone.outcomeEn,
            })}</UzHint>
        </Card>
        </Reveal>
      )}

      <Reveal as="section">
        <SectionHeading>{t.result.mainCorrection}</SectionHeading>
        <Card>
          <p className="text-base text-ink">{pickContent(locale, { uz: data.headlineFeedbackUz, ru: data.headlineFeedbackRu })}</p>
          <p className="text-support mt-2">{data.headlineFeedbackRu}</p>
        </Card>
        <p className="text-support mt-2">
          {t.result.aiDisclaimer}
        </p>
      </Reveal>

      {skills.length > 0 && (
        <Reveal as="section">
          <SectionHeading>{t.result.skills}</SectionHeading>
          <Card>
            <Sequence gap={stagger.tight}>
              {skills.map(([skill, score]) => (
                <Reveal
                  key={skill}
                  className="flex items-center justify-between border-b border-hairline py-2.5 last:border-b-0"
                >
                  <span className="text-sm font-medium text-ink">{t.labels.skill[skill]}</span>
                  <span className="text-sm tabular-nums text-ink-muted">{score}</span>
                </Reveal>
              ))}
            </Sequence>
          </Card>
        </Reveal>
      )}

      <Reveal as="section">
        <SectionHeading
          action={
            <button
              type="button"
              onClick={() => {
                setExpanded((value) => !value)
                if (!expanded) track('feedback_viewed')
              }}
              className="text-sm font-semibold text-signal-ink"
            >
              {expanded ? t.result.hide : t.result.details}
            </button>
          }
        >
          {t.result.yourAnswers}
        </SectionHeading>

        {/*
          The transcript opens and closes, so it has to be able to do both.

          Held by `AnimatePresence` and keyed on which of the two states is showing, so the
          summary line and the full list hand over to each other rather than one of them
          simply ceasing to exist. `mode="wait"` because they occupy the same slot and would
          otherwise overlap while the taller of the two is mid-flight.

          Inside, the turns arrive on the tight beat. A long conversation can be a dozen of
          them, and this is a list to be read down rather than a set of separate claims.
        */}
        <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <Sequence drive key="turns" className="space-y-3" gap={stagger.tight}>
            {data.turns.map((turn) => (
              <Reveal key={turn.turnIndex}>
              <Card as="article">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    {fill(t.result.step, { index: turn.stepIndex + 1 })}
                    {turn.wasRetry && ` · ${t.result.retryTag}`}
                  </span>
                  {turn.score !== null && turn.score !== undefined && (
                    <span className="text-sm tabular-nums text-ink-muted">{turn.score}</span>
                  )}
                </div>

                <p className="mt-2 text-base text-ink">{turn.learnerTranscript || '—'}</p>

                {turn.tutorTranscript ? (
                  <div className="mt-3 rounded-lg bg-ground-sunken px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      {geminiReply}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink">{turn.tutorTranscript}</p>
                  </div>
                ) : null}

                <dl className="mt-3 space-y-1.5">
                  {turn.pronunciationNote && <Note term={t.result.pronunciation} value={turn.pronunciationNote} />}
                  {turn.wordChoiceNote && <Note term={t.result.wordChoice} value={turn.wordChoiceNote} />}
                  {turn.grammarNote && <Note term={t.result.grammar} value={turn.grammarNote} />}
                </dl>
              </Card>
              </Reveal>
            ))}
          </Sequence>
        ) : (
          <Reveal drive key="summary">
            <p className="text-support">{fill(t.result.turnsRecorded, { count: data.turns.length })}</p>
          </Reveal>
        )}
        </AnimatePresence>
      </Reveal>

      <Reveal className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void goHome()}
          className="inline-flex items-center justify-center rounded-xl bg-signal px-6 py-4 text-base font-semibold text-on-signal shadow-soft transition hover:-translate-y-px hover:bg-signal-ink focus:outline-none focus:ring-4 focus:ring-signal-soft disabled:cursor-not-allowed disabled:opacity-60 w-full"
        >
          {t.result.backHome}
        </button>
        <Link
          to="/practice"
          className="inline-flex items-center justify-center rounded-xl border-2 border-hairline px-6 py-4 text-base font-semibold text-ink"
        >
          {t.result.practiceMore}
        </Link>
      </Reveal>

      {data.newCurrentDay && (
        <Reveal>
          <p className="text-support text-center">{fill(t.result.movedToDay, { day: data.newCurrentDay })}</p>
        </Reveal>
      )}
    </Sequence>
  )
}

type RetryPanelProps = {
  missionId: string
  retry: MissionRetryState | null
}

/**
 * The way back into the mission. While the cooldown runs the button is disabled and says when
 * it opens, because the alternative — a button that silently refuses — reads as a broken app.
 */
function RetryPanel({ missionId, retry }: RetryPanelProps) {
  const t = useT()
  const remaining = useCountdown(retry?.retryAvailableAt)
  const canRetry = retry?.canStart !== false

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-ink">
        {canRetry ? t.result.notPassedBody : fill(t.result.retryIn, { time: remaining ?? '—' })}
      </p>
      <div className="flex gap-2">
        <Link
          to={canRetry ? `/missions/${missionId}/live` : '#'}
          aria-disabled={!canRetry}
          onClick={(event) => {
            if (!canRetry) event.preventDefault()
          }}
          className={`inline-flex items-center justify-center rounded-[var(--radius-control)] px-5 py-3 text-sm font-extrabold ${
            canRetry ? 'bg-signal text-on-signal' : 'cursor-not-allowed bg-ground-sunken text-ink-faint'
          }`}
        >
          {t.result.retryNow}
        </Link>
        <Link
          to="/path"
          className="inline-flex items-center justify-center rounded-[var(--radius-control)] border-2 border-hairline px-5 py-3 text-sm font-extrabold text-ink"
        >
          {t.result.nextMission}
        </Link>
      </div>
    </Card>
  )
}

/** Counts the cooldown down on screen, so the wait is visibly finite. */
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

function Note({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-sm font-medium text-ink-faint">{term}</dt>
      <dd className="text-sm text-ink-muted">{value}</dd>
    </div>
  )
}

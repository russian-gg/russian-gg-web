import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, track } from '../lib/api'
import { pickContent } from '../lib/content'
import { fill, useLocale, useT } from '../lib/i18n'
import type { MissionResult as MissionResultDto, MissionRetryState, SkillArea } from '../lib/types'
import { Badge, Card, SectionHeading, Spinner, UzHint } from '../components/ui'

/** Detailed scoring appears only after the mission, never during it (PRD §6). */
export function MissionResult() {
  const t = useT()
  const { locale } = useLocale()
  const { attemptId = '' } = useParams()
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['attempt-result', attemptId],
    queryFn: () => api.get<MissionResultDto>(`/missions/attempts/${attemptId}/result`),
    // The enrichment job fills in detail shortly after completion; poll until it lands.
    refetchInterval: (query) => (query.state.data?.enrichmentPending ? 3000 : false),
  })

  if (isLoading || !data) return <Spinner label={t.result.preparing} />

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
    <div className="space-y-8">
      <header>
        <Badge tone={failed ? 'caution' : 'milestone'}>
          {failed ? t.result.notPassed : t.result.completed}
        </Badge>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">
          {data.overallScore} <span className="text-lg font-medium text-ink-faint">/ 100</span>
        </h1>
        <UzHint>{failed ? t.result.notPassedBody : data.strengthNoteUz}</UzHint>
      </header>

      {failed && <RetryPanel missionId={data.missionId} retry={data.retry ?? null} />}

      {data.unlockedMilestone && (
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
      )}

      <section>
        <SectionHeading>{t.result.mainCorrection}</SectionHeading>
        <Card>
          <p className="text-base text-ink">{pickContent(locale, { uz: data.headlineFeedbackUz, ru: data.headlineFeedbackRu })}</p>
          <p className="text-support mt-2">{data.headlineFeedbackRu}</p>
        </Card>
        <p className="text-support mt-2">
          {t.result.aiDisclaimer}
        </p>
      </section>

      {skills.length > 0 && (
        <section>
          <SectionHeading>{t.result.skills}</SectionHeading>
          <Card>
            {skills.map(([skill, score]) => (
              <div
                key={skill}
                className="flex items-center justify-between border-b border-hairline py-2.5 last:border-b-0"
              >
                <span className="text-sm font-medium text-ink">{t.labels.skill[skill]}</span>
                <span className="text-sm tabular-nums text-ink-muted">{score}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
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

        {expanded ? (
          <div className="space-y-3">
            {data.turns.map((turn) => (
              <Card key={turn.turnIndex} as="article">
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
                      Gemini javobi
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
            ))}
          </div>
        ) : (
          <p className="text-support">{fill(t.result.turnsRecorded, { count: data.turns.length })}</p>
        )}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
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
      </div>

      {data.newCurrentDay && (
        <p className="text-support text-center">{fill(t.result.movedToDay, { day: data.newCurrentDay })}</p>
      )}
    </div>
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

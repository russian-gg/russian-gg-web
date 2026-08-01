import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, track } from '../lib/api'
import { skillLabelUz } from '../lib/format'
import type { MissionResult as MissionResultDto, SkillArea } from '../lib/types'
import { Badge, Card, LinkButton, SectionHeading, Spinner, UzHint } from '../components/ui'

/** Detailed scoring appears only after the mission, never during it (PRD §6). */
export function MissionResult() {
  const { attemptId = '' } = useParams()
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['attempt-result', attemptId],
    queryFn: () => api.get<MissionResultDto>(`/missions/attempts/${attemptId}/result`),
    // The enrichment job fills in detail shortly after completion; poll until it lands.
    refetchInterval: (query) => (query.state.data?.enrichmentPending ? 3000 : false),
  })

  if (isLoading || !data) return <Spinner label="Natija tayyorlanmoqda" />

  const skills = Object.entries(data.skillScores) as Array<[SkillArea, number]>

  return (
    <div className="space-y-8">
      <header>
        <Badge tone="milestone">Mashq bajarildi</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
          {data.overallScore} <span className="text-lg font-medium text-ink-faint">/ 100</span>
        </h1>
        <UzHint>{data.strengthNoteUz}</UzHint>
      </header>

      {data.unlockedMilestone && (
        <Card>
          <Badge tone="milestone">{data.unlockedMilestone.day}-kun bosqichi ochildi</Badge>
          <h2 className="mt-3 text-lg font-semibold text-ink">{data.unlockedMilestone.titleUz}</h2>
          <UzHint>{data.unlockedMilestone.outcomeUz}</UzHint>
        </Card>
      )}

      <section>
        <SectionHeading>Asosiy tuzatish</SectionHeading>
        <Card>
          <p className="text-base text-ink">{data.headlineFeedbackUz}</p>
          <p className="text-support mt-2">{data.headlineFeedbackRu}</p>
        </Card>
        <p className="text-support mt-2">
          Bu AI izohi, rasmiy baholash emas. Xato deb hisoblasangiz, bizga xabar bering.
        </p>
      </section>

      {skills.length > 0 && (
        <section>
          <SectionHeading>Ko'nikmalar</SectionHeading>
          <Card>
            {skills.map(([skill, score]) => (
              <div
                key={skill}
                className="flex items-center justify-between border-b border-hairline py-2.5 last:border-b-0"
              >
                <span className="text-sm font-medium text-ink">{skillLabelUz[skill]}</span>
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
              {expanded ? 'Yopish' : 'Batafsil'}
            </button>
          }
        >
          Javoblaringiz
        </SectionHeading>

        {expanded ? (
          <div className="space-y-3">
            {data.turns.map((turn) => (
              <Card key={turn.turnIndex} as="article">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    Qadam {turn.stepIndex + 1}
                    {turn.wasRetry && ' · takror'}
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
                  {turn.pronunciationNote && <Note term="Talaffuz" value={turn.pronunciationNote} />}
                  {turn.wordChoiceNote && <Note term="So'z tanlash" value={turn.wordChoiceNote} />}
                  {turn.grammarNote && <Note term="Grammatika" value={turn.grammarNote} />}
                </dl>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-support">{data.turns.length} ta javob yozib olindi.</p>
        )}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <LinkButton to="/home" block>
          Bugungi sahifaga qaytish
        </LinkButton>
        <Link
          to="/practice"
          className="inline-flex items-center justify-center rounded-xl border border-hairline px-6 py-4 text-base font-semibold text-ink"
        >
          Yana mashq qilish
        </Link>
      </div>

      {data.newCurrentDay && (
        <p className="text-support text-center">Siz {data.newCurrentDay}-kunga o'tdingiz.</p>
      )}
    </div>
  )
}

function Note({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-sm font-medium text-ink-faint">{term}</dt>
      <dd className="text-sm text-ink-muted">{value}</dd>
    </div>
  )
}

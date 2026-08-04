import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { fill, useT } from '../lib/i18n'
import type { ProgressView, SkillArea } from '../lib/types'
import { ConfidenceTrend, MilestoneTimeline, SkillRow } from '../components/Progress'
import { Badge, Card, SectionHeading, Spinner, UzHint } from '../components/ui'

const SKILLS: SkillArea[] = ['Listening', 'Speaking', 'Pronunciation', 'Vocabulary', 'Grammar']

export function Progress() {
  const t = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
  })

  if (isLoading || !data) return <Spinner />

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="signal">{fill(t.common.dayOfTotal, { day: data.currentDay, total: 90 })}</Badge>
          <Badge>{t.labels.phase[data.phase]}</Badge>
          {data.streakDays > 1 && <Badge tone="milestone">{fill(t.home.streak, { count: data.streakDays })}</Badge>}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{t.progress.title}</h1>
      </header>

      <Card>
        <ConfidenceTrend value={data.confidenceIndex} delta={data.confidenceDelta30d} />

        <div className="mt-6 flex flex-wrap gap-8 border-t border-hairline pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {t.progress.comprehension}
            </p>
            <p className="mt-1 text-2xl font-semibold text-ink">{data.comprehensionLevel}</p>
            <p className="text-support">{t.labels.level[data.comprehensionLevel]}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {t.progress.speaking}
            </p>
            <p className="mt-1 text-2xl font-semibold text-ink">{data.speakingLevel}</p>
            <p className="text-support">{t.labels.level[data.speakingLevel]}</p>
          </div>
        </div>

        {/* The estimate follows demonstrated ability; it is never a certificate (PRD §6). */}
        <UzHint>
          {t.progress.levelNote}
        </UzHint>
      </Card>

      <section>
        <SectionHeading>{t.progress.skills}</SectionHeading>
        <Card>
          {SKILLS.map((skill) => (
            <SkillRow
              key={skill}
              skill={skill}
              value={data.skills[skill]}
              delta={data.skillDeltas30d[skill]}
            />
          ))}
        </Card>
      </section>

      {data.repairs.length > 0 && (
        <section>
          <SectionHeading>{t.progress.repairs}</SectionHeading>
          <div className="space-y-3">
            {data.repairs.map((repair) => (
              <Card key={repair.id} as="article">
                <p className="text-base text-ink">{repair.reasonUz}</p>
                <p className="text-support mt-1">
                  {fill(t.progress.repairEvidence, { count: repair.evidenceCount })}
                </p>
                {repair.missionId && repair.missionTitleUz && (
                  <Link
                    to={`/missions/${repair.missionId}`}
                    className="mt-3 inline-block text-sm font-semibold text-signal-ink"
                  >
                    {repair.missionTitleUz} →
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading>{t.progress.milestones}</SectionHeading>
        <MilestoneTimeline milestones={data.milestones} currentDay={data.currentDay} />
      </section>

      <p className="text-support border-t border-hairline pt-5">
        {fill(t.progress.totalMissions, { count: data.totalMissionsCompleted })}
      </p>
    </div>
  )
}

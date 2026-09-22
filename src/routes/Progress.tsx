import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { LESSON_ONE_SECTIONS, readLessonOneProgress } from '../lib/demo-lesson-one'
import { fill, useT } from '../lib/i18n'
import type { ProgressView, SkillArea } from '../lib/types'
import { ConfidenceTrend, MilestoneTimeline, SkillRow } from '../components/Progress'
import { Badge, Card, ProgressBar, QueryError, SectionHeading, Spinner, UzHint } from '../components/ui'
import { Reveal, Sequence } from '../components/motion'
import { pop, stagger } from '../lib/motion'

const SKILLS: SkillArea[] = ['Listening', 'Speaking', 'Pronunciation', 'Vocabulary', 'Grammar']

export function Progress() {
  const t = useT()
  const { user } = useAuth()
  const lessonOne = readLessonOneProgress(user?.id)
  const lesson = useT().lessonOne
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
  })

  if (isLoading) return <Spinner />
  if (isError || !data) return <QueryError onRetry={() => void refetch()} />

  return (
    <Sequence className="grid items-start gap-6 xl:grid-cols-2 xl:gap-8" gap={stagger.base}>
      <Reveal className="xl:col-span-2">
        {/*
          The three standing chips pop in rather than fading up, and they do it one after
          another. This is the screen a learner opens to be told how they are doing, and these
          are the three facts it opens with - the day, the phase, the streak. A badge is a
          small, emphatic thing, so it gets the small, emphatic entrance.
        */}
        <Sequence className="flex flex-wrap items-center gap-2" gap={stagger.wide}>
          <Reveal as="span" variants={pop}>
            <Badge tone="signal">{fill(t.common.dayOfTotal, { day: data.currentDay, total: 90 })}</Badge>
          </Reveal>
          <Reveal as="span" variants={pop}>
            <Badge>{t.labels.phase[data.phase]}</Badge>
          </Reveal>
          {data.streakDays > 1 && (
            <Reveal as="span" variants={pop}>
              <Badge tone="milestone">{fill(t.home.streak, { count: data.streakDays })}</Badge>
            </Reveal>
          )}
        </Sequence>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{t.progress.title}</h1>
      </Reveal>

      {lessonOne.completed.length > 0 && (
        <Reveal as="section">
          <SectionHeading>{lesson.dayOneHeading}</SectionHeading>
          <Card className={lessonOne.isComplete ? 'border-milestone bg-milestone-soft/35' : undefined}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-extrabold text-ink">Знакомство с соседом</h2>
              <span className="text-xs font-bold tracking-wide text-ink-faint uppercase">
                {fill(lesson.sectionsDone, {
                  done: lessonOne.completed.length,
                  total: LESSON_ONE_SECTIONS.length,
                })}
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar
                value={lessonOne.completed.length}
                max={LESSON_ONE_SECTIONS.length}
                label={lesson.overallLabel}
              />
            </div>
            <ul aria-label={lesson.sectionsCompleted} className="mt-4 flex flex-wrap gap-2">
              {LESSON_ONE_SECTIONS
                .filter((section) => lessonOne.completed.includes(section.id))
                .map((section) => (
                  <li
                    key={section.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-milestone-soft px-3 py-1.5 text-xs font-extrabold text-milestone"
                  >
                    <span aria-hidden="true">✓</span>
                    {lesson.sections[section.id].short}
                  </li>
                ))}
            </ul>
          </Card>
        </Reveal>
      )}

      <Reveal>
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
      </Reveal>

      <Reveal as="section">
        <SectionHeading>{t.progress.skills}</SectionHeading>
        <Card>
          {/*
            Five skill rows, on the tight beat. They are a table, not five separate claims -
            the learner reads down them to compare, and a wide stagger would make the
            comparison wait for the animation to finish.
          */}
          <Sequence gap={stagger.tight}>
            {SKILLS.map((skill) => (
              <Reveal key={skill}>
                <SkillRow
                  skill={skill}
                  value={data.skills[skill]}
                  delta={data.skillDeltas30d[skill]}
                />
              </Reveal>
            ))}
          </Sequence>
        </Card>
      </Reveal>

      {data.repairs.length > 0 && (
        <Reveal as="section">
          <SectionHeading>{t.progress.repairs}</SectionHeading>
          <Sequence className="space-y-3" gap={stagger.base}>
            {data.repairs.map((repair) => (
              <Reveal key={repair.id}>
              <Card as="article">
                <p className="text-base text-ink">{t.repairReasons[repair.gapCode as keyof typeof t.repairReasons] ?? t.repairReasons.fallback}</p>
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
              </Reveal>
            ))}
          </Sequence>
        </Reveal>
      )}

      <Reveal as="section">
        <SectionHeading>{t.progress.milestones}</SectionHeading>
        <MilestoneTimeline milestones={data.milestones} />
      </Reveal>

      {/*
        Deliberately not a counter.

        This is the one running total on the screen and it was tempting, but the number only
        exists inside an already-translated sentence, and the only way to animate it would be
        to split that sentence on its own digits and splice a counter into the gap. That works
        until a locale writes the number differently, or the total is 1 and the sentence
        happens to contain another 1 — at which point the copy quietly breaks in a language
        nobody on the team reads. A counter is not worth that.
      */}
      <Reveal>
        <p className="text-support border-t border-hairline pt-5">
          {fill(t.progress.totalMissions, { count: data.totalMissionsCompleted })}
        </p>
      </Reveal>
    </Sequence>
  )
}

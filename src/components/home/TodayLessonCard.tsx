import { useMemo, useState } from 'react'
import { Clock, Lock, MessageSquareText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as m from 'motion/react-m'
import { useAuth } from '../../lib/auth-context'
import { pickContent } from '../../lib/content'
import { cx } from '../../lib/cx'
import { LESSON_ONE_SECTIONS, readFoundationLessonProgress } from '../../lib/demo-lesson-one'
import { hasFoundationLesson } from '../../lib/foundation-days'
import { fill, useLocale, useT } from '../../lib/i18n'
import { missionPath } from '../../lib/mission-path'
import { ease, rise } from '../../lib/motion'
import type { MissionSummary } from '../../lib/types'
import { ArrowGlyph, CompletedGlyph, MissionPreviewDialog } from '../MissionCard'
import { Meter } from '../motion'

/**
 * The learner's next step, as the one wide card under the banner.
 *
 * It replaces the generic mission card here for two reasons. That card is built for a shelf —
 * a narrow tile among others — and on its own it sat a third of the width of its section. And
 * its words are a practice mission's: "start the practice", "not tried yet". What this section
 * holds is usually the day's lesson, so the card says what the thing actually is — a lesson or
 * a speaking practice — and what the learner will get from it, in the mission's own objective
 * rather than a category name.
 *
 * A lesson the learner has already begun shows how far they got — sections done out of the
 * lesson's nine, as a bar — and its button says "continue". That progress is the lesson
 * player's own, kept in this browser, the same figure the ninety-day path shows for the day.
 * A lesson not yet opened shows neither: an empty bar under it says nothing.
 *
 * Tapping it still answers "what is this?" in the preview dialog before the learner commits,
 * the same step every other mission card takes. A locked one skips that and goes where the
 * lock points.
 */
export function TodayLessonCard({ mission }: { mission: MissionSummary }) {
  const t = useT()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const [previewOpen, setPreviewOpen] = useState(false)

  const title = pickContent(locale, { uz: mission.titleUz, ru: mission.titleRu, en: mission.titleEn })
  const objective = pickContent(locale, { uz: mission.objectiveUz, ru: mission.objectiveRu, en: mission.objectiveEn })
  // A day with an authored lesson opens the lesson; anything else is a speaking practice.
  const isLesson = !mission.isDialogue && hasFoundationLesson(mission.courseDay)
  const isProLock = mission.isLocked && (mission.lockReason?.toLowerCase().includes('pro') ?? false)
  const destination = mission.isLocked ? (isProLock ? '/paywall' : '/path') : missionPath(mission)
  const best = mission.bestScore ?? null

  // How far into the lesson the learner is. Read when the card appears; the home screen is
  // remounted on the way back from the lesson, so it is current by the time anyone looks.
  const { user } = useAuth()
  const sectionsDone = useMemo(
    () =>
      isLesson && mission.courseDay != null ? readFoundationLessonProgress(user?.id, mission.courseDay).completed.length : 0,
    [isLesson, mission.courseDay, user?.id],
  )
  const sectionsTotal = LESSON_ONE_SECTIONS.length
  const started = !mission.isCompleted && !mission.isLocked && sectionsDone > 0

  const startLabel = mission.isCompleted
    ? t.home.repeat
    : started
      ? t.dayPreview.resume
      : isLesson
        ? t.home.start
        : t.home.startPractice

  return (
    <>
      <m.button
        type="button"
        variants={rise}
        whileTap={mission.isLocked ? undefined : { scale: 0.99, y: 1 }}
        transition={{ duration: 0.09, ease: ease.move }}
        onClick={() => (mission.isLocked ? navigate(destination) : setPreviewOpen(true))}
        data-ui-sound="select"
        aria-label={title}
        aria-haspopup={mission.isLocked ? undefined : 'dialog'}
        className={cx(
          'group flex w-full flex-col gap-5 rounded-[var(--radius-card)] border p-5 text-left sm:p-6 lg:flex-row lg:items-center lg:gap-6',
          'transition-[border-color,box-shadow,transform] duration-150',
          'focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:outline-none',
          mission.isCompleted ? 'border-milestone/20 bg-milestone-soft/55' : 'border-milestone/20 bg-ground-raised',
          mission.isLocked
            ? 'opacity-80 hover:border-caution/40'
            : 'shadow-[0_8px_24px_rgb(15_115_85/0.06)] hover:-translate-y-0.5 hover:border-signal/55 hover:shadow-[0_10px_28px_rgb(22_24_29/0.08)]',
        )}
      >
        {mission.courseDay != null && (
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 flex-col items-center justify-center self-start rounded-2xl bg-signal-soft text-signal-ink"
          >
            <span className="text-2xl leading-none font-black tabular-nums">{mission.courseDay}</span>
            <span className="mt-1 text-[11px] leading-none font-extrabold tracking-wide uppercase">{t.home.dayUnit}</span>
          </span>
        )}

        <span className="block min-w-0 flex-1">
          <span className="block text-xs font-black tracking-[.12em] text-signal-ink uppercase">
            {isLesson ? t.home.kindLesson : t.home.kindPractice}
            <span className="text-ink-faint"> · {t.labels.category[mission.category]}</span>
          </span>

          <span className="mt-1.5 flex items-start gap-2">
            <span className="min-w-0 text-xl leading-snug font-extrabold wrap-break-word text-ink sm:text-2xl">{title}</span>
            {mission.isCompleted && <CompletedGlyph label={t.path.done} />}
          </span>

          {objective && <span className="mt-1.5 line-clamp-2 block text-sm leading-6 text-ink-muted">{objective}</span>}

          <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden="true" strokeWidth={1.9} className="size-4" />
              {fill(t.common.minutes, { count: mission.estimatedMinutes })}
            </span>
            {mission.targetPhraseCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <MessageSquareText aria-hidden="true" strokeWidth={1.9} className="size-4" />
                {fill(t.home.phrases, { count: mission.targetPhraseCount })}
              </span>
            )}
            <span className={cx('inline-flex items-center gap-2', mission.isCompleted && 'text-milestone')}>
              <span
                aria-hidden="true"
                className={cx('size-2 rounded-full', mission.isCompleted ? 'bg-milestone' : started || best !== null ? 'bg-signal' : 'bg-ink-faint')}
              />
              {mission.isCompleted
                ? t.path.done
                : started
                  ? `${sectionsDone} / ${sectionsTotal} ${t.dayPreview.sections}`
                  : best !== null
                    ? fill(t.practice.bestScore, { score: best })
                    : t.home.notStarted}
            </span>
          </span>

          {/* A started lesson shows how far it has got; nothing is drawn for one nobody has opened. */}
          {started ? (
            <Meter
              value={sectionsDone}
              max={sectionsTotal}
              label={title}
              delay={0.2}
              className="mt-3 h-2.5 max-w-md overflow-hidden rounded-full bg-ground-sunken"
              fillClassName="rounded-full bg-signal"
            />
          ) : best !== null && (
            <Meter
              value={best}
              max={100}
              label={title}
              delay={0.2}
              className="mt-3 h-2 max-w-sm overflow-hidden rounded-full bg-ground-sunken"
              fillClassName={cx('rounded-full', mission.isCompleted ? 'bg-milestone' : 'bg-signal')}
            />
          )}
        </span>

        <span className="flex shrink-0 lg:justify-end">
          {mission.isLocked ? (
            <span className="inline-flex items-center gap-2 text-sm font-extrabold text-caution">
              <Lock aria-hidden="true" strokeWidth={2.2} className="size-4" />
              {isProLock ? t.path.needsPro : t.path.locked}
            </span>
          ) : (
            <span
              className={cx(
                'raised-group inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-5 py-3 text-base font-extrabold lg:w-auto',
                mission.isCompleted
                  ? 'border border-milestone/20 bg-ground-raised text-milestone'
                  : 'bg-milestone text-on-signal raised-milestone',
              )}
            >
              {startLabel}
              <ArrowGlyph />
            </span>
          )}
        </span>
      </m.button>

      {!mission.isLocked && (
        <MissionPreviewDialog
          open={previewOpen}
          mission={mission}
          title={title}
          featured
          startLabel={startLabel}
          onDismiss={() => setPreviewOpen(false)}
          onStart={() => navigate(destination)}
        />
      )}
    </>
  )
}

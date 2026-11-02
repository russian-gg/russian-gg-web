import { useEffect } from 'react'
import { AnimatePresence, type Variants } from 'motion/react'
import * as m from 'motion/react-m'
import { AudioLines, Check, Layers, Play, Repeat2, RotateCcw, SpellCheck, Timer, X } from 'lucide-react'
import { cx } from '../lib/cx'
import { foundationLessons, type LessonData } from '../lib/foundation-lessons'
import { fill, useLocale, useT } from '../lib/i18n'
import { duration, ease, fade, springSoft } from '../lib/motion'
import { Reveal } from './motion'
import { ColorScopeProvider, RussianText } from './RussianText'
import { Badge, Button } from './ui'

export type LessonStatus = 'new' | 'inProgress' | 'done'

/**
 * A lesson day, read before it is started — the same card the missions open on the map.
 *
 * Tapping a day used to open a small dialog whose only content was one general sentence, the
 * same on every day, and an empty progress bar: "what to expect" said nothing about this lesson.
 * The card says what the day teaches, read from the lesson's own outcomes (which until now only
 * appeared on the closing card), how much is in it, and starts the lesson from its one button —
 * no page in between.
 *
 * It rises from the bottom and is part of the page rather than a dialog over it, as the mission
 * card is: the path stays usable, and choosing another day swaps what the card says in place.
 * `day` outlives `open` on purpose, so the card does not empty out on its way off the screen.
 *
 * The lesson is read here rather than passed in, so the path loads the lesson content — the
 * largest module in the app — only once a day is tapped and this card is fetched.
 */
export function LessonDetailsSheet({
  day,
  open,
  status,
  completed,
  total,
  isOpening,
  onStart,
  onDismiss,
}: {
  day: number
  open: boolean
  status: LessonStatus
  /** Sections finished in this browser, for a lesson in progress. */
  completed: number
  total: number
  isOpening: boolean
  /** `restart` is true for a new or finished lesson, false to resume where the learner stopped. */
  onStart: (restart: boolean) => void
  onDismiss: () => void
}) {
  const t = useT()
  const lesson: LessonData | undefined = foundationLessons[day]

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onDismiss])

  return (
    <AnimatePresence initial={false}>
      {open && lesson && (
        <m.section
          key="lesson-details"
          aria-labelledby="lesson-details-title"
          variants={rising}
          initial="hidden"
          animate="shown"
          exit="exit"
          className={cx(
            // Clears the phone's tab bar; from `md` up there is none. One layer above the
            // floating Telegram button, which would otherwise sit on the card's action.
            'sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[45] md:bottom-6',
            'max-h-[min(62dvh,34rem)] overflow-y-auto md:max-h-[70dvh] rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-4 sm:p-5',
            'shadow-[0_-8px_40px_rgb(22_24_29/0.14)]',
          )}
        >
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.common.close}
            className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-ground-raised/90 text-ink-muted transition hover:bg-ground-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-signal"
          >
            <X aria-hidden="true" strokeWidth={1.9} className="size-5" />
          </button>
          {/* Keyed by day, so a new choice arrives rather than the old text being swapped in place. */}
          <Reveal key={lesson.day} variants={fade}>
            <ColorScopeProvider day={lesson.day}>
              <Details
                lesson={lesson}
                status={status}
                completed={completed}
                total={total}
                isOpening={isOpening}
                onStart={onStart}
              />
            </ColorScopeProvider>
          </Reveal>
        </m.section>
      )}
    </AnimatePresence>
  )
}

/** Up from below, on the spring the product's other surfaces settle on; down and away to close. */
const rising: Variants = {
  hidden: { opacity: 0, y: 56 },
  shown: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: 40, transition: { duration: duration.quick, ease: ease.exit } },
}

function Details({ lesson, status, completed, total, isOpening, onStart }: {
  lesson: LessonData
  status: LessonStatus
  completed: number
  total: number
  isOpening: boolean
  onStart: (restart: boolean) => void
}) {
  const t = useT()
  const copy = t.dayPreview
  const { locale } = useLocale()
  const action = status === 'done' ? copy.repeat : status === 'inProgress' ? copy.resume : copy.start

  /*
   * One phone screen, no picture: the scene image and the mascot pushed what the day teaches
   * below the fold. Four small tiles say it instead — the day's sound, its rule, and how many
   * words and phrases it brings. How far the learner has got rides on the status chip; the
   * "0 / 9 bo‘lim" tile only repeated it.
   */
  const topics = [
    { icon: AudioLines, label: t.lesson.sections.phonetics, value: lesson.phonetics.title, russian: true },
    { icon: SpellCheck, label: t.lesson.sections.grammar, value: lesson.grammar.title, russian: true },
    { icon: Layers, label: copy.statWords, value: fill(copy.countValue, { count: lesson.vocabulary.length }), russian: false },
    { icon: Repeat2, label: copy.statPhrases, value: fill(copy.countValue, { count: lesson.phrases.length }), russian: false },
  ]
  return (
    <div className="w-full">
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-10">
          <Badge tone="signal">{fill(copy.lessonDay, { day: lesson.day })}</Badge>
          <StatusBadge status={status} progress={fill(copy.progressOf, { done: completed, total })} />
        </div>

        <h2 id="lesson-details-title" className="mt-2.5 text-2xl leading-tight font-extrabold tracking-tight wrap-break-word text-ink">
          <RussianText text={lesson.titleRu} />
          {/* The Uzbek title translates the Russian one, so it shows to Uzbek readers only. */}
          {locale === 'uz' && <span className="ml-2 text-base font-bold text-ink-muted">{lesson.titleUz}</span>}
        </h2>

        <ul aria-label={t.preview.whatYouLearn} className="mt-4 grid grid-cols-2 gap-2 border-t border-hairline pt-4 lg:grid-cols-4">
          {topics.map(({ icon: Icon, label, value, russian }) => (
            <li key={label} className="flex min-w-0 items-start gap-2 rounded-2xl bg-ground-sunken p-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal-ink">
                <Icon aria-hidden="true" strokeWidth={2} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black tracking-[.08em] text-ink-faint uppercase">{label}</span>
                <span className="line-clamp-2 text-xs leading-4 font-extrabold sm:text-sm sm:leading-5 wrap-break-word text-ink">
                  {russian ? <RussianText text={value} /> : value}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {/* On a phone the card can outgrow the screen; the action stays pinned to its bottom edge. */}
        <div className="sticky -bottom-4 -mx-4 mt-auto bg-ground-raised px-4 pt-4 pb-4 sm:static sm:mx-0 sm:flex sm:justify-end sm:p-0 sm:pt-4">
          {/* A finished lesson offers its repeat on the quieter button; the others lead with the action. */}
          <Button
            variant={status === 'done' ? 'secondary' : 'primary'}
            size="lg"
            disabled={isOpening}
            onClick={() => onStart(status !== 'inProgress')}
            data-ui-sound="whoosh"
            className="w-full sm:w-auto"
          >
            {status === 'done' ? (
              <RotateCcw aria-hidden="true" strokeWidth={2.2} className="size-5" />
            ) : (
              <Play aria-hidden="true" strokeWidth={2.2} className="size-5 fill-current" />
            )}
            {isOpening ? `${t.common.loading}…` : action}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status, progress }: { status: LessonStatus; progress: string }) {
  const t = useT()
  if (status === 'done') {
    return (
      <Badge tone="milestone">
        <Check aria-hidden="true" strokeWidth={2.6} className="mr-1 size-3.5" />
        {t.dayPreview.completed}
      </Badge>
    )
  }
  if (status === 'inProgress') {
    return (
      <Badge tone="caution">
        <Timer aria-hidden="true" strokeWidth={2.2} className="mr-1 size-3.5" />
        {progress}
      </Badge>
    )
  }
  return null
}


import { useEffect, useRef, useState } from 'react'
import { Check, Star } from 'lucide-react'
import { useFocusTrap } from '../lib/focus-trap'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { fill, useT } from '../lib/i18n'
import type { LessonFeedbackStatus, SubmitLessonFeedbackRequest } from '../lib/types'
import { Button, ErrorNote } from './ui'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import type { Variants } from 'motion/react'
import { backdrop, duration, ease, sheet } from '../lib/motion'

type Score = 1 | 2 | 3 | 4 | 5
type ChoiceOption = { title: string; hint: string }
type Step = 'satisfaction' | 'recommendation' | 'rating' | 'note'
type Direction = 'forward' | 'back'

const STARS: Score[] = [1, 2, 3, 4, 5]
const STEPS: Step[] = ['satisfaction', 'recommendation', 'rating', 'note']
const NOTE_MAX_LENGTH = 2000
/** Long enough to see the choice land before the next question slides in. */
const AUTO_ADVANCE_MS = 320

/** Screens where the learner is mid-lesson or mid-game. The survey waits until they come out. */
function isBusyPath(pathname: string) {
  if (pathname.startsWith('/missions/')) return !pathname.endsWith('/result')
  return ['/lessons/', '/games/', '/onboarding', '/link-phone'].some((prefix) => pathname.startsWith(prefix))
}

/**
 * The check-in after every third completed course day. The server decides when one is due; the
 * three scored questions are required, so it stays until it is answered — but it never
 * interrupts a lesson in progress, and it sits under the welcome gift if both are open.
 */
export function LessonFeedbackGate() {
  const { user } = useAuth()
  const location = useLocation()
  const enabled = Boolean(user?.hasCompletedDiagnostic) && !isBusyPath(location.pathname)

  const { data, refetch } = useQuery({
    queryKey: ['lesson-feedback', user?.id],
    queryFn: () => api.get<LessonFeedbackStatus>('/lesson-feedback'),
    enabled,
    refetchOnWindowFocus: false,
  })

  // Finishing a lesson moves the count, so look again whenever the learner changes screen.
  useEffect(() => {
    if (enabled) void refetch()
  }, [enabled, location.pathname, refetch])

  const checkpoint = enabled && data?.isDue ? data.checkpointDay ?? null : null

  /*
    The gate no longer returns `null` when nothing is due: it returns an empty
    `AnimatePresence`. That is the whole reason the dialog can now play an exit at all — an
    answered survey used to be torn out of the tree in the same commit that recorded the
    answer, so the only way to see it leave was to keep it alive by hand on a timer.
  */
  return (
    <AnimatePresence>
      {checkpoint !== null && <LessonFeedbackDialog key={checkpoint} checkpoint={checkpoint} />}
    </AnimatePresence>
  )
}

type LessonFeedbackDialogProps = {
  checkpoint: number
}

/** One question per step, in order. The last step — the note — is optional and sends the lot. */
function LessonFeedbackDialog({ checkpoint }: LessonFeedbackDialogProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const t = useT()
  const copy = t.lessonFeedback
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<Direction>('forward')
  const [satisfaction, setSatisfaction] = useState<Score | null>(null)
  const [recommendation, setRecommendation] = useState<Score | null>(null)
  const [rating, setRating] = useState<Score | null>(null)
  const [hoveredStar, setHoveredStar] = useState<Score | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const advanceTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => () => window.clearTimeout(advanceTimer.current), [])

  const step = STEPS[stepIndex]
  const isLastStep = stepIndex === STEPS.length - 1
  const answered: Record<Step, boolean> = {
    satisfaction: satisfaction !== null,
    recommendation: recommendation !== null,
    rating: rating !== null,
    note: true,
  }
  const canContinue = answered[step]
  const isComplete = answered.satisfaction && answered.recommendation && answered.rating
  const shownRating = hoveredStar ?? rating

  function goTo(index: number) {
    window.clearTimeout(advanceTimer.current)
    setDirection(index > stepIndex ? 'forward' : 'back')
    setStepIndex(Math.max(0, Math.min(index, STEPS.length - 1)))
    setError(null)
  }

  /** Moves on after a choice, unless the learner has already moved themselves in the meantime. */
  function advanceSoon() {
    const from = stepIndex
    window.clearTimeout(advanceTimer.current)
    advanceTimer.current = window.setTimeout(() => {
      setDirection('forward')
      setStepIndex((current) => (current === from ? Math.min(current + 1, STEPS.length - 1) : current))
    }, AUTO_ADVANCE_MS)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isLastStep) {
      if (canContinue) goTo(stepIndex + 1)
      return
    }
    if (satisfaction === null || recommendation === null || rating === null) return

    setBusy(true)
    setError(null)
    try {
      const body: SubmitLessonFeedbackRequest = {
        satisfaction,
        recommendation,
        rating,
        note: note.trim() || null,
      }
      const result = await api.post<LessonFeedbackStatus>('/lesson-feedback', body)
      /*
        Recorded immediately. The answer flipping `isDue` is what removes the dialog, and
        `AnimatePresence` in the gate above holds it on screen until its exit has finished —
        so the exit no longer has to be choreographed against a `setTimeout` that had to be
        kept equal to a CSS duration in another file.
      */
      queryClient.setQueryData<LessonFeedbackStatus>(['lesson-feedback', user?.id], result)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : copy.error)
      setBusy(false)
    }
  }

  return (
    <m.div
      variants={backdrop}
      initial="hidden"
      animate="shown"
      exit="exit"
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-feedback-title"
    >
      <m.form
        variants={sheet}
        onSubmit={(event) => void submit(event)}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-ground-raised shadow-2xl"
      >
        <header className="px-5 pt-5 sm:px-8 sm:pt-7">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-extrabold tracking-[0.14em] text-signal-ink uppercase">
              {fill(copy.eyebrow, { days: checkpoint })}
            </p>
            <span className="shrink-0 text-xs font-bold text-ink-muted">
              {fill(copy.stepLabel, { current: stepIndex + 1, total: STEPS.length })}
            </span>
          </div>
          <h2 id="lesson-feedback-title" className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{copy.body}</p>
          <div className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden="true">
            {STEPS.map((item, index) => (
              <span
                key={item}
                className={`h-1.5 rounded-full transition-colors duration-300 ${
                  index <= stepIndex ? 'bg-signal' : 'bg-ground-sunken'
                }`}
              />
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pb-5 sm:px-8">
          {/*
            One question at a time, and the pair of them moves as one gesture: the answered
            question leaves towards the side the learner came from while the next arrives from
            the other. `mode="wait"` is what makes that legible — two questions crossing in the
            same column would overlap their text, and the step is the only thing on screen
            worth reading.

            `custom` carries the direction into the variants, so Back is not simply Next played
            again; it retraces. Without it a wizard reads as a stack of unrelated screens.
          */}
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <m.div
              key={step}
              custom={direction}
              variants={stepSlide}
              initial="hidden"
              animate="shown"
              exit="exit"
            >
            {step === 'satisfaction' && (
              <ChoiceGroup
                name="satisfaction"
                legend={copy.satisfactionQuestion}
                requiredLabel={copy.required}
                options={copy.satisfactionOptions}
                value={satisfaction}
                onChange={(score) => {
                  setSatisfaction(score)
                  advanceSoon()
                }}
              />
            )}

            {step === 'recommendation' && (
              <ChoiceGroup
                name="recommendation"
                legend={copy.recommendationQuestion}
                requiredLabel={copy.required}
                options={copy.recommendationOptions}
                value={recommendation}
                onChange={(score) => {
                  setRecommendation(score)
                  advanceSoon()
                }}
              />
            )}

            {step === 'rating' && (
              <fieldset className="mt-6">
                <Legend text={copy.ratingQuestion} requiredLabel={copy.required} />
                <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-ground-sunken/60 px-4 py-8">
                  <div className="flex items-center gap-1 sm:gap-2" onMouseLeave={() => setHoveredStar(null)}>
                    {STARS.map((star) => (
                      <label
                        key={star}
                        className="cursor-pointer rounded-xl p-1 transition-transform hover:scale-110 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-signal"
                        onMouseEnter={() => setHoveredStar(star)}
                      >
                        <input
                          type="radio"
                          name="rating"
                          value={star}
                          checked={rating === star}
                          onChange={() => {
                            setRating(star)
                            advanceSoon()
                          }}
                          className="sr-only"
                          aria-label={fill(copy.starLabel, { count: star })}
                        />
                        <StarGlyph filled={shownRating !== null && star <= shownRating} />
                      </label>
                    ))}
                  </div>
                  <span className="min-h-5 text-sm font-bold text-ink-muted" aria-live="polite">
                    {shownRating ? copy.ratingLabels[shownRating - 1] : ''}
                  </span>
                </div>
              </fieldset>
            )}

            {step === 'note' && (
              <label className="mt-6 block">
                <span className="text-sm font-extrabold text-ink">
                  {copy.noteLabel} <span className="font-semibold text-ink-faint">({copy.optional})</span>
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={NOTE_MAX_LENGTH}
                  rows={6}
                  placeholder={copy.notePlaceholder}
                  className="mt-3 block w-full resize-y rounded-xl border border-hairline bg-ground px-3.5 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
                />
              </label>
            )}

            {!canContinue && <p className="mt-3 text-xs text-ink-faint">{copy.requiredHint}</p>}
            </m.div>
          </AnimatePresence>

          {error && (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-hairline px-5 py-4 sm:px-8">
          {stepIndex > 0 && (
            <Button type="button" variant="ghost" onClick={() => goTo(stepIndex - 1)} disabled={busy}>
              {copy.back}
            </Button>
          )}
          <Button
            type="submit"
            className="ml-auto"
            disabled={busy || (isLastStep ? !isComplete : !canContinue)}
          >
            {isLastStep ? (busy ? copy.sending : copy.submit) : copy.next}
          </Button>
        </footer>
      </m.form>
    </m.div>
  )
}

type ChoiceGroupProps = {
  name: string
  legend: string
  requiredLabel: string
  options: readonly ChoiceOption[]
  value: Score | null
  onChange: (score: Score) => void
}

/** Five cards, best answer first. Scores run 5 → 1 down the list, so 5 always means the best. */
function ChoiceGroup({ name, legend, requiredLabel, options, value, onChange }: ChoiceGroupProps) {
  return (
    <fieldset className="mt-6">
      <Legend text={legend} requiredLabel={requiredLabel} />
      <div className="mt-3 grid gap-2">
        {options.map((option, index) => {
          const score = (STARS.length - index) as Score
          const checked = value === score
          return (
            <label
              key={score}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-signal ${
                checked ? 'border-signal bg-signal-soft' : 'border-hairline bg-ground hover:border-signal/50'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={score}
                checked={checked}
                onChange={() => onChange(score)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors ${
                  checked ? 'border-signal bg-signal text-on-signal' : 'border-control-depth bg-ground'
                }`}
              >
                {checked && <CheckGlyph />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{option.title}</span>
                <span className="block text-xs text-ink-muted">{option.hint}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

type LegendProps = {
  text: string
  requiredLabel: string
}

function Legend({ text, requiredLabel }: LegendProps) {
  return (
    <legend className="text-base font-extrabold text-ink">
      {text} <span className="text-danger" aria-hidden="true">*</span>
      <span className="sr-only"> ({requiredLabel})</span>
    </legend>
  )
}

function CheckGlyph() {
  return (
    <Check aria-hidden="true" strokeWidth={2.5} className="size-3.5" />
  )
}

type StarGlyphProps = {
  filled: boolean
}

function StarGlyph({ filled }: StarGlyphProps) {
  return (
    <Star
      aria-hidden="true"
      className={`size-11 fill-current transition-colors sm:size-12 ${filled ? 'text-coin' : 'text-hairline'}`}
      stroke={filled ? 'var(--color-coin-strong)' : 'var(--color-control-depth)'}
      strokeWidth={1.2}
    />
  )
}

/**
 * The step transition, as a pair of mirrored slides.
 *
 * `custom` arrives here as the direction the learner is travelling, which is the only way a
 * wizard can retrace rather than replay: going forward, the answered question exits left and
 * the next enters from the right; going back, both reverse. A variant that ignored direction
 * would send every step off the same side, so Back would look exactly like Next and the
 * learner would lose the thread of where they are in four questions.
 *
 * 28px of travel, not the 32 the old keyframes used. The panel is narrow on a phone and the
 * questions are short; past roughly this distance the text is still visibly sliding when it
 * becomes readable, which is what makes a carousel tiring to read.
 */
const stepSlide: Variants = {
  hidden: (direction: Direction) => ({ opacity: 0, x: direction === 'forward' ? 28 : -28 }),
  shown: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.base, ease: ease.enter },
  },
  exit: (direction: Direction) => ({
    opacity: 0,
    x: direction === 'forward' ? -28 : 28,
    transition: { duration: duration.quick, ease: ease.exit },
  }),
}

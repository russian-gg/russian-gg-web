import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { fill, useT } from '../lib/i18n'
import type { LessonFeedbackStatus, SubmitLessonFeedbackRequest } from '../lib/types'
import { Button, ErrorNote } from './ui'

type Score = 1 | 2 | 3 | 4 | 5
type ChoiceOption = { title: string; hint: string }
type Step = 'satisfaction' | 'recommendation' | 'rating' | 'note'
type Direction = 'forward' | 'back'

const STARS: Score[] = [1, 2, 3, 4, 5]
const STEPS: Step[] = ['satisfaction', 'recommendation', 'rating', 'note']
const NOTE_MAX_LENGTH = 2000
/** Long enough to see the choice land before the next question slides in. */
const AUTO_ADVANCE_MS = 320
/** Matches `lf-panel-out` below: the dialog is removed only once it has finished leaving. */
const CLOSE_MS = 240

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

  const checkpoint = data?.isDue ? data.checkpointDay ?? null : null
  if (!enabled || checkpoint === null) return null

  return <LessonFeedbackDialog key={checkpoint} checkpoint={checkpoint} />
}

type LessonFeedbackDialogProps = {
  checkpoint: number
}

/** One question per step, in order. The last step — the note — is optional and sends the lot. */
function LessonFeedbackDialog({ checkpoint }: LessonFeedbackDialogProps) {
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
  const [closing, setClosing] = useState(false)
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
      // Play the exit first; once no feedback is due the gate unmounts this dialog.
      setClosing(true)
      window.setTimeout(() => {
        queryClient.setQueryData<LessonFeedbackStatus>(['lesson-feedback', user?.id], result)
      }, CLOSE_MS)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : copy.error)
      setBusy(false)
    }
  }

  return (
    <div
      className={`lf-backdrop fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-6${
        closing ? ' lf-closing' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-feedback-title"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="lf-panel flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-ground-raised shadow-2xl"
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
          <div key={step} className={direction === 'forward' ? 'lf-step-forward' : 'lf-step-back'}>
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
          </div>

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
      </form>

      <style>{LESSON_FEEDBACK_STYLES}</style>
    </div>
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
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  )
}

type StarGlyphProps = {
  filled: boolean
}

function StarGlyph({ filled }: StarGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-11 transition-colors sm:size-12 ${filled ? 'text-coin' : 'text-hairline'}`}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        stroke={filled ? 'var(--color-coin-strong)' : 'var(--color-control-depth)'}
        strokeWidth="1.2"
        strokeLinejoin="round"
        d="M12 2.8l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.13 6.38 20.1l1.07-6.27L2.9 9.4l6.3-.9z"
      />
    </svg>
  )
}

const LESSON_FEEDBACK_STYLES = `
  .lf-backdrop{animation:lf-backdrop-in .25s ease-out both}
  .lf-backdrop.lf-closing{animation:lf-backdrop-out .24s ease-in both}
  .lf-panel{animation:lf-panel-in .42s cubic-bezier(.2,.85,.25,1.1) both}
  .lf-closing .lf-panel{animation:lf-panel-out .24s ease-in both}
  .lf-step-forward{animation:lf-step-forward .32s cubic-bezier(.2,.8,.3,1) both}
  .lf-step-back{animation:lf-step-back .32s cubic-bezier(.2,.8,.3,1) both}
  @keyframes lf-backdrop-in{from{opacity:0}to{opacity:1}}
  @keyframes lf-backdrop-out{from{opacity:1}to{opacity:0}}
  @keyframes lf-panel-in{from{opacity:0;transform:translateY(28px) scale(.95)}to{opacity:1;transform:none}}
  @keyframes lf-panel-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(18px) scale(.96)}}
  @keyframes lf-step-forward{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:none}}
  @keyframes lf-step-back{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){
    .lf-backdrop,.lf-panel,.lf-step-forward,.lf-step-back,.lf-closing .lf-panel{animation-duration:.01ms!important}
  }
`

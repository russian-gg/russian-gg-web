import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Clock, Gamepad2, Mic, Repeat } from 'lucide-react'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import type { UsageAllowance } from '../../lib/types'
import { timeUntil } from '../../lib/usage'

/**
 * Opening a fourth new lesson in a day. Says the day's lessons are done, when this one opens,
 * and what is free to do meanwhile. Design: 8 · Limits & trials › "Kuniga 3 ta dars".
 */
export function LessonLimitScreen({
  usage,
  lessonNumber,
  lessonTitle,
}: {
  usage: UsageAllowance | undefined
  lessonNumber: number
  lessonTitle?: ReactNode
}) {
  const copy = useT().limits
  const navigate = useNavigate()
  const perDay = usage?.lessonsPerDay ?? 3
  const wait = timeUntil(usage?.resetsAt)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pb-12">
      <header className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={copy.back}
          onClick={() => navigate(-1)}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ground-sunken text-ink"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={2.4} className="size-[18px]" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-[0.12em] text-signal-ink uppercase">{copy.today}</p>
          <p className="text-base leading-snug font-extrabold text-ink">{copy.lessonsHeader}</p>
        </div>
      </header>

      <section className="flex flex-col items-center gap-3.5 text-center">
        {usage && (
          <p className="text-[11px] font-black tracking-[0.12em] text-milestone uppercase">
            {fill(copy.lessonsEyebrow, { day: usage.courseDay })}
          </p>
        )}
        <ul aria-label={fill(copy.lessonsDots, { total: perDay })} className="flex gap-2.5">
          {Array.from({ length: perDay }, (_, index) => (
            <li key={index} className="grid size-11 place-items-center rounded-full bg-milestone text-white">
              <Check aria-hidden="true" strokeWidth={3} className="size-5" />
            </li>
          ))}
        </ul>
        <h1 className="text-[26px] leading-tight font-black text-ink">{fill(copy.lessonsTitle, { count: perDay })}</h1>
        <p className="max-w-[340px] text-[15px] leading-relaxed text-ink-muted">{fill(copy.lessonsBody, { count: perDay })}</p>
        <div className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-ground-raised px-4 py-3.5 text-left">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-signal-soft text-base font-black text-signal-ink">
            {lessonNumber}
          </span>
          <span className="min-w-0 flex-1">
            {lessonTitle && <span className="block text-[15px] leading-5 font-extrabold text-ink">{lessonTitle}</span>}
            <span className="flex items-center gap-1.5 text-[13px] leading-snug font-bold text-ink-muted">
              <Clock aria-hidden="true" strokeWidth={2.2} className="size-4 shrink-0" />
              {wait.hours > 0
                ? fill(copy.lessonsOpensIn, { hours: wait.hours, minutes: wait.minutes })
                : fill(copy.lessonsOpensInMinutes, { minutes: wait.minutes })}
            </span>
          </span>
        </div>
      </section>

      <section aria-labelledby="lesson-limit-now" className="flex flex-col gap-2.5">
        <h2 id="lesson-limit-now" className="text-[11px] font-black tracking-[0.12em] text-ink-faint uppercase">
          {copy.lessonsNowTitle}
        </h2>
        <ul className="flex flex-col gap-2.5">
          <NextAction
            to="/path"
            tone="bg-signal-soft text-signal-ink"
            icon={<Repeat strokeWidth={2.2} className="size-5" />}
            title={copy.reviewTitle}
            body={copy.reviewBody}
          />
          <NextAction
            to="/games"
            tone="bg-milestone-soft text-milestone"
            icon={<Gamepad2 strokeWidth={2.2} className="size-5" />}
            title={copy.gamesTitle}
            body={usage
              ? usage.gameAnswersLeft > 0
                ? fill(copy.gamesBody, { count: usage.gameAnswersLeft })
                : copy.gamesBodyNone
              : undefined}
          />
          <NextAction
            to="/practice"
            tone="bg-coin-faint text-coin-ink"
            icon={<Mic strokeWidth={2.2} className="size-[18px]" />}
            title={copy.liveTitle}
            body={usage
              ? usage.liveTrialsLeft > 0
                ? fill(copy.liveLeft, { count: usage.liveTrialsLeft })
                : copy.liveNone
              : undefined}
          />
        </ul>
      </section>
    </div>
  )
}

function NextAction({
  to,
  tone,
  icon,
  title,
  body,
}: {
  to: string
  tone: string
  icon: ReactNode
  title: string
  body?: string
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-16 items-center gap-3 rounded-2xl border border-hairline bg-ground-raised px-3.5 py-3 text-ink hover:border-ink-faint"
      >
        <span aria-hidden="true" className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tone)}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-5 font-extrabold">{title}</span>
          {body && <span className="block text-[13px] leading-snug text-ink-muted">{body}</span>}
        </span>
        <ChevronRight aria-hidden="true" strokeWidth={2.4} className="size-[18px] text-ink-faint" />
      </Link>
    </li>
  )
}

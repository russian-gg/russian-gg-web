import { useEffect, useState } from 'react'
import type { OnboardingAssessment, OnboardingMilestone } from '../lib/types'
import { cx } from '../lib/cx'

/**
 * What forty seconds of speaking turned into.
 *
 * The order is deliberate and it is the order of the conversation somebody is already having
 * with themselves: this is what you just did, here is the number behind it, here is what it
 * is costing you, and here is what ninety days of daily speaking changes. The measured
 * figures come first because everything after them is only believable if they are.
 */
export function LevelDashboard({
  assessment,
  onContinue,
  continueLabel,
}: {
  assessment: OnboardingAssessment
  onContinue: () => void
  continueLabel: string
}) {
  const { stats } = assessment
  const hasLanguageBreakdown =
    typeof stats.uzbekWords === 'number' && typeof stats.otherWords === 'number'

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <p className="text-xs font-black tracking-[0.16em] text-ink-faint uppercase">Sizning natijangiz</p>
        <h1 className="text-3xl leading-tight font-black text-ink sm:text-4xl">{assessment.headlineUz}</h1>

        <div className="flex flex-wrap gap-2">
          <LevelChip label="Gapirish" value={assessment.speaking} tone="warn" />
          <LevelChip label="Tushunish" value={assessment.comprehension} tone="good" />
        </div>
      </header>

      {/*
        The one number that carries the whole diagnosis. Somebody who produced two Russian
        words in a row has a vocabulary and not a sentence, and seeing the figure said back to
        them is what turns "I struggle a bit" into something specific enough to act on.
      */}
      <section className="rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="text-5xl leading-none font-black tabular-nums text-signal-ink">
              {stats.longestRussianRun}
            </div>
            <div className="mt-1.5 text-sm font-bold text-ink">
              so'z — eng uzun ruscha ketma-ketligingiz
            </div>
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Figure label="Jami so'z" value={stats.words} />
            <Figure label="Ruscha" value={`${stats.russianWords} (${stats.russianShare}%)`} />
            {hasLanguageBreakdown && (
              <>
                <Figure label="O'zbekcha" value={`${stats.uzbekWords} (${stats.uzbekShare}%)`} />
                <Figure label="Boshqa til" value={`${stats.otherWords} (${stats.otherShare}%)`} />
              </>
            )}
            {/* A typed answer has no length, and "0 s" would read as a measurement of one. */}
            {stats.seconds > 0 && <Figure label="Gapirdingiz" value={`${stats.seconds} s`} />}
          </dl>
        </div>

        <p className="mt-4 text-[15px] leading-relaxed text-ink">{assessment.verdictUz}</p>
      </section>

      {assessment.gapsUz.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-sm font-black tracking-[0.14em] text-ink-faint uppercase">
            Hozir uddalay olmaysiz
          </h2>
          <ul className="space-y-2">
            {assessment.gapsUz.map((gap) => (
              <li
                key={gap}
                className="flex items-start gap-3 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-4 py-3"
              >
                <span aria-hidden className="mt-0.5 text-danger">✕</span>
                <span className="text-[15px] text-ink">{gap}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PlanCurve plan={assessment.plan} />

      {assessment.strengthsUz.length > 0 && (
        <section className="rounded-[var(--radius-card)] border-2 border-milestone/35 bg-milestone-soft/40 px-4 py-3">
          <h2 className="text-sm font-black text-milestone">Sizda allaqachon bor</h2>
          <ul className="mt-1.5 space-y-1">
            {assessment.strengthsUz.map((strength) => (
              <li key={strength} className="text-[15px] text-ink">
                {strength}
              </li>
            ))}
          </ul>
        </section>
      )}

      {assessment.transcriptUz && (
        <details className="rounded-[var(--radius-card)] border-2 border-hairline px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-ink-muted">
            Nima deganingizni ko'rish
          </summary>
          <p
            dir="auto"
            className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-muted"
          >
            “{assessment.transcriptUz}”
          </p>
        </details>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-[var(--radius-control)] bg-signal px-6 py-4 text-base font-black text-on-signal transition-colors hover:bg-signal-hover"
      >
        {continueLabel}
      </button>

      <p className="text-center text-xs text-ink-faint">
        Bu dastlabki baho, til sertifikati emas. Har bir ovozli mashqdan keyin yangilanadi.
      </p>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs font-bold text-ink-faint">{label}</dt>
      <dd className="text-lg font-black tabular-nums text-ink">{value}</dd>
    </div>
  )
}

function LevelChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'good' | 'warn'
}) {
  return (
    <span
      className={cx(
        'inline-flex items-baseline gap-2 rounded-[var(--radius-control)] border-2 px-3 py-1.5',
        tone === 'good' ? 'border-milestone/40 bg-milestone-soft/40' : 'border-caution/40 bg-caution-soft/40',
      )}
    >
      <span className="text-xs font-bold text-ink-muted">{label}</span>
      <span className={cx('text-base font-black', tone === 'good' ? 'text-milestone' : 'text-caution')}>
        {value}
      </span>
    </span>
  )
}

/**
 * Ninety days, as one line.
 *
 * One series and one axis: the whole claim is "this goes up, and here is when". The first
 * point is measured and the rest are what the plan is built to reach, which the caption says
 * out loud — a graph that quietly presents a projection as data is a graph that lies politely.
 *
 * It draws itself in on mount, because the point of this screen is that something changes.
 */
function PlanCurve({ plan }: { plan: OnboardingMilestone[] }) {
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const width = 320
  const height = 132
  const padding = { left: 6, right: 6, top: 10, bottom: 22 }

  const points = plan.map((point, index) => ({
    ...point,
    x: padding.left + (index * (width - padding.left - padding.right)) / (plan.length - 1),
    y:
      height -
      padding.bottom -
      (point.speakingScore / 100) * (height - padding.top - padding.bottom),
  }))

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
  const area = `${line} L${points[points.length - 1].x} ${height - padding.bottom} L${points[0].x} ${height - padding.bottom} Z`

  return (
    <section className="rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-5">
      <h2 className="text-sm font-black tracking-[0.14em] text-ink-faint uppercase">
        Obuna bilan 90 kun ichida
      </h2>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 w-full"
        role="img"
        aria-label="90 kunlik gapirish darajasi o'sishi"
      >
        <defs>
          <linearGradient id="planFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d={area}
          fill="url(#planFill)"
          className={cx('transition-opacity duration-700 motion-reduce:transition-none', drawn ? 'opacity-100' : 'opacity-0')}
        />
        <path
          d={line}
          fill="none"
          stroke="var(--color-signal)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={drawn ? 0 : 1}
          className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
        />

        {points.map((point, index) => (
          <g key={point.day}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="var(--color-ground-raised)"
              stroke="var(--color-signal)"
              strokeWidth="2"
            />
            <text
              x={Math.min(Math.max(point.x, 14), width - 14)}
              y={height - 6}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-[var(--color-ink-faint)] text-[9px] font-bold"
            >
              {point.day === 0 ? 'Bugun' : `${point.day}-kun`}
            </text>
          </g>
        ))}
      </svg>

      <ol className="mt-2 space-y-2.5">
        {plan.slice(1).map((point) => (
          <li key={point.day} className="flex gap-3">
            <span className="mt-0.5 w-14 shrink-0 text-sm font-black text-signal-ink tabular-nums">
              {point.day}-kun
            </span>
            <span className="text-[15px] leading-snug text-ink">{point.bodyUz}</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-xs text-ink-faint">
        Birinchi nuqta — hozir o'lchangani. Qolgani — kunda 10 daqiqa gapirsangiz reja
        qayerga olib borishi.
      </p>
    </section>
  )
}

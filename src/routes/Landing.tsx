import { LinkButton } from '../components/ui'
import { fill, useT } from '../lib/i18n'

export function Landing() {
  const t = useT()
  const milestones = [
    { day: 7, text: t.landing.milestone7 },
    { day: 30, text: t.landing.milestone30 },
    { day: 90, text: t.landing.milestone90 },
  ]

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      {/* Same wordmark as the app shell, so the brand does not change at the door. */}
      <span className="text-xl font-semibold tracking-tight text-ink">
        russian<span className="text-signal">.gg</span>
      </span>

      <h1 className="mt-12 text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
        {t.landing.headline}
      </h1>

      <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-muted">
        {t.landing.body}
      </p>

      {/* Straight into the placement check, not into a sign-up form: the visitor should meet
          the product before they are asked to make an account. */}
      <div className="mt-9 flex flex-col gap-2 sm:flex-row sm:items-center">
        <LinkButton to="/onboarding">{t.landing.cta}</LinkButton>
        {/* Borderless on purpose: one action carries the emphasis, the other stays quiet. */}
        <LinkButton to="/signin" variant="ghost">
          {t.landing.signIn}
        </LinkButton>
      </div>

      <ul className="mt-16 space-y-6 border-t border-hairline pt-8">
        {milestones.map((milestone) => (
          <li key={milestone.day} className="flex gap-5">
            <span className="w-20 shrink-0 text-sm font-semibold tracking-[0.12em] whitespace-nowrap text-signal-ink uppercase">
              {fill(t.common.day, { day: milestone.day })}
            </span>
            <span className="text-base text-ink">{milestone.text}</span>
          </li>
        ))}
      </ul>

      {/*
        Said plainly on the first screen. The product must not imply certification or
        guaranteed fluency (PRD §4 "what Russian.gg is not").
      */}
      <p className="text-support mt-12 border-t border-hairline pt-6">
        {t.landing.disclaimer}
      </p>
    </div>
  )
}

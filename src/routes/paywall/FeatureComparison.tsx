import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { Card } from '../../components/ui'
import { cx } from '../../lib/cx'
import { CrownGlyph, GiftGlyph } from './glyphs'

/**
 * What Pro opens, beside what the free plan already covers.
 *
 * Side by side from `md`, because the whole point is the comparison — a column of things you
 * would gain, read three screens above a column of things you already have, is two lists
 * rather than an argument.
 *
 * Both lists are existing product copy, `proBenefits` and `freeLimitItems`, the same two the
 * settings screen renders. Nothing is added here: a benefit that exists only on the checkout
 * page is a benefit nobody has committed to delivering.
 */
export function FeatureComparison() {
  const t = useT()

  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <BenefitCard
        title={t.billing.proUnlocks}
        items={t.billing.proBenefits}
        glyph={<CrownGlyph className="size-8" />}
        emphasis
      />
      <BenefitCard
        title={t.billing.freeLimits}
        items={t.billing.freeLimitItems}
        glyph={<GiftGlyph className="size-8" knockout="var(--color-ground-sunken)" />}
      />
    </div>
  )
}

/**
 * One side of the comparison.
 *
 * Solid marks, not outlines. Everywhere else in this product an icon is a line drawing, and
 * that is right for controls — but these two are emblems standing for a whole plan rather than
 * buttons, and at the head of a card a hairline crown reads as faint where a solid one reads
 * as a seal. Lucide draws in strokes, so `fill="currentColor"` closes the shape and the stroke
 * is dropped to nothing; anything thicker leaves a halo around the filled body.
 *
 * `emphasis` is the Pro side: a tinted card and blue marks against a plain card and grey ones.
 * The difference is weight, not a different kind of mark — both lists are things the learner
 * gets, and giving the free side crosses or dashes would misdescribe it as a list of things
 * they are being denied.
 */
function BenefitCard({
  title,
  items,
  glyph,
  emphasis = false,
}: {
  title: string
  items: readonly string[]
  /** A solid emblem from `glyphs.tsx`, already sized. */
  glyph: ReactNode
  emphasis?: boolean
}) {
  return (
    <Card className={emphasis ? 'border-signal/25 bg-signal-soft/45' : undefined}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cx(
            'grid size-14 shrink-0 place-items-center rounded-full',
            emphasis ? 'bg-signal-soft text-signal' : 'bg-ground-sunken text-ink-faint',
          )}
        >
          {glyph}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>

          <ul className="mt-3 grid gap-2.5">
            {items.map((item) => (
              <li
                key={item}
                className={cx(
                  'flex items-start gap-3 text-[15px] leading-snug',
                  emphasis ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {/*
                  A filled disc with the tick knocked out of it, rather than a ring with a tick
                  inside. Two nested outlines at 20px turn into a smudge; a solid disc holds its
                  shape, and the white tick on it is the highest-contrast mark available.
                */}
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                    emphasis ? 'bg-signal' : 'bg-ink-faint/55',
                  )}
                >
                  <Check strokeWidth={3.5} className="size-3 text-white" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

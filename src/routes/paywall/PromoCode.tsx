import { Tag } from 'lucide-react'
import { formatPrice } from '../../lib/format'
import { fill, useLocale, useT } from '../../lib/i18n'
import type { PromoCodePreview } from '../../lib/types'
import { Badge, Button, Card } from '../../components/ui'

/**
 * The promo code field.
 *
 * A form, so Enter submits it. Somebody typing a code into a single box expects the keyboard
 * to finish the job, and a bare input beside a button does not give them that.
 *
 * The result is shown in full rather than as a tick: the code, what came off, and what is left
 * to pay. A discount the buyer cannot check is a discount they have to take on trust at the
 * exact moment they are deciding whether to trust the screen at all.
 */
export function PromoCode({
  code,
  onCodeChange,
  onApply,
  busy,
  feedback,
  preview,
  percent,
}: {
  code: string
  onCodeChange: (code: string) => void
  onApply: () => void
  busy: boolean
  feedback: string | null
  preview: PromoCodePreview | null
  percent: number
}) {
  const t = useT()
  const { locale } = useLocale()
  const applied = preview?.isValid === true

  return (
    <Card>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy && code.trim()) onApply()
        }}
      >
        <label htmlFor="promo-code" className="block text-base font-extrabold tracking-tight text-ink">
          {t.billing.promoTitle}
        </label>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Tag
              aria-hidden="true"
              strokeWidth={1.9}
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-faint"
            />
            <input
              id="promo-code"
              value={code}
              onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
              placeholder={t.billing.promoPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="h-12 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised pr-4 pl-12 text-sm font-bold tracking-wide text-ink placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-faint focus:border-signal focus:outline-none"
            />
          </div>

          {/* Disabled on an empty box as well as while in flight: applying nothing is a
              round trip that can only come back as an error. */}
          <Button
            type="submit"
            variant="secondary"
            className="h-12 sm:w-auto sm:px-7"
            block
            disabled={busy || !code.trim()}
          >
            {busy ? t.billing.opening : t.billing.promoApply}
          </Button>
        </div>
      </form>

      {feedback && (
        <p className={`mt-3 text-sm ${applied ? 'text-milestone' : 'text-ink-muted'}`}>{feedback}</p>
      )}

      {applied && preview && (
        <div className="mt-4 rounded-[var(--radius-card)] bg-signal-soft/70 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal">{fill(t.billing.promoPercent, { percent })}</Badge>
            <span className="font-extrabold text-ink">{preview.code}</span>
          </div>
          <p className="text-support mt-2">
            {fill(t.billing.promoDiscount, {
              amount: formatPrice(preview.discountAmountTiyin, preview.currency, locale),
            })}
          </p>
          <p className="mt-0.5 font-extrabold text-ink">
            {fill(t.billing.promoFinal, {
              amount: formatPrice(preview.finalAmountTiyin, preview.currency, locale),
            })}
          </p>
        </div>
      )}
    </Card>
  )
}

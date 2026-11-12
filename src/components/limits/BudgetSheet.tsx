import { useEffect } from 'react'
import { CalendarClock } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useFocusTrap } from '../../lib/focus-trap'
import { formatDate } from '../../lib/format'
import { fill, useLocale, useT } from '../../lib/i18n'
import { backdrop, sheet } from '../../lib/motion'
import { Button } from '../ui'

/**
 * The billing period's AI budget is spent: live conversations are closed until it renews.
 * Nothing replaces them; finished lessons stay open for review.
 */
export function BudgetSheet({
  open,
  resetsAt,
  onReview,
  onDismiss,
}: {
  open: boolean
  resetsAt?: string | null
  onReview: () => void
  onDismiss: () => void
}) {
  return (
    <AnimatePresence>
      {open && <BudgetSheetBody resetsAt={resetsAt} onReview={onReview} onDismiss={onDismiss} />}
    </AnimatePresence>
  )
}

function BudgetSheetBody({
  resetsAt,
  onReview,
  onDismiss,
}: {
  resetsAt?: string | null
  onReview: () => void
  onDismiss: () => void
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const copy = useT().limits
  const { locale } = useLocale()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <m.div
      key="budget"
      ref={dialogRef}
      tabIndex={-1}
      variants={backdrop}
      initial="hidden"
      animate="shown"
      exit="exit"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-sheet-title"
      onClick={onDismiss}
    >
      <m.div
        variants={sheet}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-ground-raised px-5 pt-2.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-18px_50px_-24px_rgb(17_24_39/0.55)] sm:rounded-3xl sm:pb-6"
      >
        <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-hairline sm:hidden" />
        <span aria-hidden="true" className="grid size-[52px] place-items-center rounded-2xl bg-signal-soft text-signal-ink">
          <CalendarClock strokeWidth={2.2} className="size-[22px]" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id="budget-sheet-title" className="text-[22px] leading-tight font-black text-ink">
            {copy.budgetTitle}
          </h2>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            {resetsAt ? fill(copy.budgetBody, { date: formatDate(resetsAt, locale) }) : copy.budgetBodyNoDate}
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <Button block size="lg" onClick={onReview}>
            {copy.reviewLesson}
          </Button>
          <Button block size="lg" variant="secondary" onClick={onDismiss}>
            {copy.budgetOk}
          </Button>
        </div>
      </m.div>
    </m.div>
  )
}

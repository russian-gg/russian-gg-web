import { Check, X } from 'lucide-react'
import { RussianText } from '../../components/RussianText'
import { cx } from '../../lib/cx'
import type { TestOptionState } from '../../lib/tests'

const LETTERS = 'ABCDEFGH'

/**
 * One answer option, the same on the player and on the results screen: a lettered tile, the
 * option, and — once it is known — a tick or a cross. The player passes `onClick` and gets a
 * button with the product's pressed edge; the results screen leaves it out and gets a plain
 * row, because nothing there can be pressed.
 *
 * The right answer the learner did not pick is outlined, not filled: it is information, not
 * praise.
 */
export function TestOption({
  index,
  text,
  state,
  disabled = false,
  onClick,
}: {
  index: number
  text: string
  state: TestOptionState
  disabled?: boolean
  onClick?: () => void
}) {
  const face = cx(
    'flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left text-base font-bold text-ink transition-colors',
    state === 'correct' && 'border-milestone bg-milestone-soft',
    state === 'missed' && 'border-milestone bg-ground-raised',
    state === 'wrong' && 'border-danger bg-danger-soft',
    state === 'chosen' && 'border-signal bg-signal-soft',
    state === 'idle' && 'border-hairline bg-ground-raised',
  )

  const content = (
    <>
      <span
        aria-hidden="true"
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-colors',
          (state === 'correct' || state === 'missed') && 'bg-milestone text-white',
          state === 'wrong' && 'bg-danger text-white',
          state === 'chosen' && 'bg-signal text-on-signal',
          state === 'idle' && 'bg-ground-sunken text-ink-muted',
        )}
      >
        {LETTERS[index] ?? index + 1}
      </span>
      <span className="min-w-0 flex-1 wrap-break-word" lang="ru">
        <RussianText text={text} />
      </span>
      {(state === 'correct' || state === 'missed') && (
        <Check aria-hidden="true" strokeWidth={3} className="size-5 shrink-0 animate-in text-milestone zoom-in-50 fade-in-0" />
      )}
      {state === 'wrong' && (
        <X aria-hidden="true" strokeWidth={3} className="size-5 shrink-0 animate-in text-danger zoom-in-50 fade-in-0" />
      )}
    </>
  )

  if (!onClick) return <div className={face}>{content}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        face,
        'raised',
        state === 'correct' && 'raised-milestone-soft',
        state === 'missed' && 'raised-milestone-soft',
        state === 'wrong' && 'raised-danger-soft',
        state === 'chosen' && 'raised-signal-soft',
        !disabled && 'hover:border-signal',
      )}
    >
      {content}
    </button>
  )
}

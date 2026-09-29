import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId } from 'react'
import { cx } from '../../lib/cx'

/**
 * A checkbox on the Radix primitive (shadcn/ui's base), with its label beside it. The tick
 * pops in with shadcn's zoom-and-fade rather than appearing between two frames.
 *
 * The whole row is the hit area: the label is tied to the box, so tapping the words ticks it,
 * which on a phone is most of what a checkbox row is for.
 */
export function Checkbox({
  checked,
  onChange,
  children,
  disabled = false,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  const id = useId()

  return (
    <div className={cx('flex items-center gap-2.5', disabled && 'opacity-50', className)}>
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
        disabled={disabled}
        className={cx(
          'peer flex size-5 shrink-0 items-center justify-center rounded-[7px] border-2 border-control-depth bg-ground-raised',
          'transition-colors duration-150 hover:border-signal',
          'focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-ground focus-visible:outline-none',
          'data-[state=checked]:border-signal data-[state=checked]:bg-signal data-[state=checked]:text-on-signal',
          'disabled:cursor-not-allowed',
        )}
      >
        <CheckboxPrimitive.Indicator className="flex animate-in items-center justify-center duration-150 zoom-in-50 fade-in-0">
          <Check aria-hidden="true" className="size-3.5" strokeWidth={3.5} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label htmlFor={id} className={cx('select-none', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        {children}
      </label>
    </div>
  )
}

import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ComponentProps } from 'react'
import { cx } from '../../lib/cx'
import { floatingLayerAnimation, floatingLayerFrame } from './animations'

export const Popover = PopoverPrimitive.Root

export const PopoverTrigger = PopoverPrimitive.Trigger

/**
 * shadcn/ui's popover panel in the product's frame. Escape closes the panel only — a popover
 * inside a dialog must not take the dialog down with it.
 */
export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  onEscapeKeyDown,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        onEscapeKeyDown={(event) => {
          event.stopPropagation()
          onEscapeKeyDown?.(event)
        }}
        className={cx(
          floatingLayerFrame,
          floatingLayerAnimation,
          'origin-[var(--radix-popover-content-transform-origin)] p-3 outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

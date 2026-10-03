import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cx } from '../../lib/cx'
import { floatingLayerAnimation, floatingLayerFrame } from './animations'

/*
 * Radix keeps "" for "no selection", so an "all" option (value "") is carried under a sentinel
 * inside the primitive and handed back out as "".
 */
const EMPTY_VALUE = '__all__'

const sizes = {
  /** The admin panel's control: pill-shaped, like its buttons and text fields. */
  md: 'h-11 rounded-[var(--radius-control)] px-4 text-sm font-semibold',
  /** The learner app's form control: taller, larger text, card corners. */
  lg: 'h-12 rounded-xl px-4 text-base',
} as const

export type SelectOption = { value: string; label: string; disabled?: boolean }

/**
 * A dropdown in the product's own style, on the Radix Select primitive (the one shadcn/ui
 * builds on), shared by the learner app and the admin panel. The native `<select>` it replaces
 * opened the operating system's list, which looked like no other control in the product.
 *
 * Radix brings the parts a hand-rolled dropdown gets wrong: arrow keys, type-to-jump, Escape,
 * focus return and screen-reader roles. Escape is kept to the list, so closing it does not
 * also close a dialog the select sits in.
 */
export function Select({
  value,
  onChange,
  options,
  label,
  placeholder,
  disabled = false,
  size = 'md',
  block = false,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** The accessible name; shown nowhere, since the visible label sits outside. */
  label: string
  placeholder?: string
  disabled?: boolean
  size?: keyof typeof sizes
  /** Full width, for forms. Filters size to their content. */
  block?: boolean
  className?: string
}) {
  const toInner = (outer: string) => (outer === '' ? EMPTY_VALUE : outer)

  return (
    <SelectPrimitive.Root
      value={toInner(value)}
      onValueChange={(inner) => onChange(inner === EMPTY_VALUE ? '' : inner)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cx(
          'group inline-flex max-w-full items-center justify-between gap-2 border-2 border-hairline bg-ground-raised text-left text-ink',
          'transition-colors hover:border-ink-faint focus:border-signal focus:outline-none data-[state=open]:border-signal',
          'disabled:pointer-events-none disabled:opacity-50',
          'data-[placeholder]:font-normal data-[placeholder]:text-ink-faint',
          sizes[size],
          block && 'w-full',
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-ink-faint transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className={cx(
            floatingLayerFrame,
            floatingLayerAnimation,
            'min-w-[var(--radix-select-trigger-width)] max-h-[min(20rem,var(--radix-select-content-available-height))]',
            'origin-[var(--radix-select-content-transform-origin)]',
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-ink-faint">
            <ChevronUp aria-hidden="true" className="size-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={toInner(option.value)}
                disabled={option.disabled}
                className={cx(
                  'relative flex cursor-pointer items-center rounded-xl py-2 pr-9 pl-3 text-sm text-ink outline-none select-none',
                  'transition-colors data-[highlighted]:bg-ground-sunken',
                  'data-[state=checked]:font-bold data-[state=checked]:text-signal-ink',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex animate-in items-center zoom-in-50 fade-in-0">
                  <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-ink-faint">
            <ChevronDown aria-hidden="true" className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

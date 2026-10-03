import { useState } from 'react'
import { DayPicker, type Locale } from 'react-day-picker'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { Select } from './Select'

const pad = (value: number) => `${value}`.padStart(2, '0')

/** `YYYY-MM-DDTHH:mm` in local time — the same string a native `datetime-local` input holds. */
function parse(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const [, y, m, d, h, min] = match.map(Number)
  return new Date(y, m - 1, d, h, min)
}

function format(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const HOURS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: pad(hour) }))

/**
 * A date and a time, picked from a calendar in a popover — shadcn/ui's date picker (Popover +
 * react-day-picker) with an hour and minute beside it. It replaces `datetime-local`, whose
 * picker is the browser's own and differs on every platform.
 *
 * The value is the same local `YYYY-MM-DDTHH:mm` string the native input used, so a form
 * that held one holds this without change. Copy comes in through props because this module is
 * shared by the learner app and the panel, and neither dictionary belongs here.
 */
export function DateTimePicker({
  value,
  onChange,
  label,
  locale,
  hourLabel,
  minuteLabel,
  placeholder,
  minuteStep = 5,
}: {
  value: string
  onChange: (value: string) => void
  /** Accessible name of the trigger. */
  label: string
  /** react-day-picker locale, e.g. `uz` from `react-day-picker/locale`. */
  locale?: Locale
  hourLabel: string
  minuteLabel: string
  placeholder: string
  minuteStep?: number
}) {
  const [open, setOpen] = useState(false)
  const selected = parse(value)

  // The current minute stays pickable even off the step, so an existing value is never rounded.
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep)
  if (selected && !minutes.includes(selected.getMinutes())) minutes.push(selected.getMinutes())
  minutes.sort((a, b) => a - b)

  const shown = selected
    ? selected.toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : placeholder

  function update(next: { date?: Date; hour?: number; minute?: number }) {
    const base = selected ?? new Date(new Date().setSeconds(0, 0))
    const day = next.date ?? base
    onChange(
      format(
        new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          next.hour ?? base.getHours(),
          next.minute ?? base.getMinutes(),
        ),
      ),
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={cx(
          'inline-flex h-11 w-full items-center gap-2.5 rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-left text-sm text-ink',
          'transition-colors hover:border-ink-faint focus:border-signal focus:outline-none data-[state=open]:border-signal',
        )}
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
        <span className={cx('truncate tabular-nums', !selected && 'text-ink-faint')}>{shown}</span>
      </PopoverTrigger>

      <PopoverContent className="w-auto">
        <DayPicker
          mode="single"
          locale={locale}
          weekStartsOn={1}
          selected={selected ?? undefined}
          defaultMonth={selected ?? undefined}
          onSelect={(date) => date && update({ date })}
          showOutsideDays
          classNames={{
            root: 'text-sm',
            months: 'relative',
            month_caption: 'flex h-9 items-center justify-center font-extrabold capitalize',
            nav: 'absolute inset-x-0 top-0 flex h-9 items-center justify-between',
            button_previous:
              'inline-flex size-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-ground-sunken hover:text-ink',
            button_next:
              'inline-flex size-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-ground-sunken hover:text-ink',
            month_grid: 'mt-2 border-collapse',
            weekdays: 'flex',
            weekday: 'w-9 text-center text-xs font-bold text-ink-faint capitalize',
            week: 'mt-1 flex',
            day: 'size-9 p-0 text-center',
            day_button:
              'inline-flex size-9 items-center justify-center rounded-xl tabular-nums transition-colors hover:bg-ground-sunken focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none',
            selected: '[&>button]:bg-signal [&>button]:font-bold [&>button]:text-on-signal [&>button]:hover:bg-signal',
            today: '[&>button]:font-extrabold [&>button]:text-signal-ink',
            outside: 'opacity-40',
            disabled: 'opacity-30',
          }}
          components={{
            Chevron: ({ orientation }) =>
              orientation === 'left' ? (
                <ChevronLeft aria-hidden="true" className="size-4" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4" />
              ),
          }}
        />

        <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
          <Select
            label={hourLabel}
            value={selected ? String(selected.getHours()) : ''}
            placeholder="--"
            onChange={(hour) => update({ hour: Number(hour) })}
            options={HOURS}
            className="w-24"
          />
          <span className="font-extrabold text-ink-faint">:</span>
          <Select
            label={minuteLabel}
            value={selected ? String(selected.getMinutes()) : ''}
            placeholder="--"
            onChange={(minute) => update({ minute: Number(minute) })}
            options={minutes.map((minute) => ({ value: String(minute), label: pad(minute) }))}
            className="w-24"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

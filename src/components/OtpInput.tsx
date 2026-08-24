import { useEffect, useRef } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { cx } from '../lib/cx'

/**
 * A fixed-length numeric code, drawn as separate boxes. One controlled string, one box per
 * character: typing advances, backspace retreats, and a pasted code fills every box at once.
 * Real <input>s so the keyboard, autofill of the SMS code, and screen readers all work.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 4,
  disabled = false,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  onComplete?: (code: string) => void
  length?: number
  disabled?: boolean
  ariaLabel?: string
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  // The code step exists only to take this input, so land the caret in it on mount.
  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  function set(next: string) {
    const digits = next.replace(/\D/g, '').slice(0, length)
    onChange(digits)
    if (digits.length === length) onComplete?.(digits)
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (!digit) return
    const chars = value.split('')
    chars[index] = digit
    const next = chars.join('').slice(0, length)
    set(next)
    refs.current[Math.min(index + 1, length - 1)]?.focus()
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const chars = value.split('')
      if (chars[index]) {
        chars[index] = ''
        onChange(chars.join(''))
      } else if (index > 0) {
        chars[index - 1] = ''
        onChange(chars.join(''))
        refs.current[index - 1]?.focus()
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    set(pasted)
    refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex justify-center gap-3" role="group" aria-label={ariaLabel}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`${(ariaLabel ?? 'Code') + ' '}${index + 1}`}
          maxLength={1}
          className={cx(
            'size-14 rounded-2xl border-2 bg-ground-raised text-center text-2xl font-extrabold text-ink',
            'transition-colors focus:border-signal focus:outline-none',
            'disabled:opacity-50',
            value[index] ? 'border-signal' : 'border-hairline',
          )}
        />
      ))}
    </div>
  )
}

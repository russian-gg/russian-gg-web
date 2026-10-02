import { useId, useRef } from 'react'
import type { Ref } from 'react'
import { Paperclip, X } from 'lucide-react'
import { cx } from '../../lib/cx'

/**
 * A file picker that looks like the rest of the form. The native `<input type="file">` draws
 * the browser's own grey button and a "No file chosen" line in the browser's language, which
 * on this product is often neither of the learner's two.
 *
 * The real input stays in the DOM (visually hidden), so keyboard, screen readers and drag-and-
 * drop onto the label still work; the visible part is its label. Copy arrives through props —
 * this module is shared and owns no dictionary.
 */
export function FileInput({
  file,
  onChange,
  chooseLabel,
  emptyLabel,
  clearLabel,
  accept,
  inputRef,
}: {
  file: File | null
  onChange: (file: File | null) => void
  chooseLabel: string
  emptyLabel: string
  clearLabel: string
  accept?: string
  /** For a caller that clears the input after submitting. */
  inputRef?: Ref<HTMLInputElement>
}) {
  const id = useId()
  const localRef = useRef<HTMLInputElement | null>(null)

  function setRefs(node: HTMLInputElement | null) {
    localRef.current = node
    if (typeof inputRef === 'function') inputRef(node)
    else if (inputRef) inputRef.current = node
  }

  return (
    <div className="flex min-h-12 w-full items-center gap-3 rounded-xl border-2 border-hairline bg-ground-raised py-1.5 pr-2 pl-1.5 has-[:focus-visible]:border-signal">
      <input
        ref={setRefs}
        id={id}
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className="raised raised-sm inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-ground-sunken px-3 text-sm font-bold text-ink hover:bg-signal-soft hover:text-signal-ink"
      >
        <Paperclip aria-hidden="true" className="size-4" />
        {chooseLabel}
      </label>
      <span className={cx('min-w-0 flex-1 truncate text-sm', file ? 'text-ink' : 'text-ink-faint')}>
        {file ? file.name : emptyLabel}
      </span>
      {file && (
        <button
          type="button"
          aria-label={clearLabel}
          title={clearLabel}
          onClick={() => {
            if (localRef.current) localRef.current.value = ''
            onChange(null)
          }}
          className="inline-flex size-8 shrink-0 animate-in items-center justify-center rounded-lg text-ink-faint zoom-in-75 fade-in-0 hover:bg-danger-soft hover:text-danger"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}

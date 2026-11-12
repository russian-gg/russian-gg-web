import { useEffect, useState } from 'react'
import { currentToasts, listeners, type Item } from '../lib/toast'

/** Draws the toasts raised with `toast()` from `lib/toast`. Mounted once, in the shell. */

export function Toaster() {
  const [shown, setShown] = useState<Item[]>(currentToasts)

  useEffect(() => {
    listeners.add(setShown)
    return () => {
      listeners.delete(setShown)
    }
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {shown.map((item) => (
        <div
          key={item.id}
          className="rounded-[var(--radius-control)] bg-ink px-4 py-2.5 text-sm font-bold text-ground-raised shadow-lg"
        >
          {item.text}
        </div>
      ))}
    </div>
  )
}

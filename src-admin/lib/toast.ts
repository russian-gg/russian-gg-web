/*
 * A one-line confirmation after an action ("12 ta o'quvchi faollashtirildi"). Held outside
 * React so any screen can call `toast()` without threading a context through; the single
 * <Toaster /> in the shell draws them.
 */

export type Item = { id: number; text: string }

let items: Item[] = []
let nextId = 1
/** What is on screen now, for a Toaster that mounts after a toast was raised. */
export const currentToasts = () => items

export const listeners = new Set<(items: Item[]) => void>()

function emit() {
  listeners.forEach((listener) => listener(items))
}

export function toast(text: string) {
  const id = nextId++
  items = [...items, { id, text }]
  emit()
  window.setTimeout(() => {
    items = items.filter((item) => item.id !== id)
    emit()
  }, 3200)
}


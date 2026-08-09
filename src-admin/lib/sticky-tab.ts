import { useCallback, useEffect, useState } from 'react'

/**
 * A tab selection that survives a refresh.
 *
 * The panel is a tool people keep open and reload all day; landing back on the first tab
 * every time is a small tax paid on every reload. The section already works this way, so the
 * tabs inside it doing something different was the inconsistency.
 *
 * The stored value is checked against the tabs that exist right now rather than trusted. A
 * build that renames or removes a tab would otherwise leave whoever had it open looking at a
 * screen with nothing on it, and no way back except clearing their storage.
 */
export function useStickyTab<T extends string>(key: string, options: readonly T[]): [T, (value: T) => void] {
  const storageKey = `rgg.admin.tab.${key}`

  const [tab, setTabState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey)

      return options.includes(stored as T) ? (stored as T) : options[0]
    } catch {
      // Private mode or blocked storage. The first tab is a fine place to be.
      return options[0]
    }
  })

  /*
   * Re-checked when the options change, not only on mount: a tab can disappear while the
   * screen is open — the demo tab only exists on a build that has the feature — and the state
   * would otherwise keep pointing at it.
   */
  useEffect(() => {
    if (!options.includes(tab)) setTabState(options[0])
  }, [options, tab])

  const setTab = useCallback(
    (value: T) => {
      setTabState(value)

      try {
        localStorage.setItem(storageKey, value)
      } catch {
        // Not being able to remember it should not stop it being selected now.
      }
    },
    [storageKey],
  )

  return [tab, setTab]
}

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'rgg.theme'

/**
 * Light is the product default and is deliberately *not* inferred from the operating
 * system: a learner on a dark-mode phone still opens Russian.gg in light. Dark is
 * something they choose, and only then is it remembered.
 */
export const DEFAULT_THEME: Theme = 'light'

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : DEFAULT_THEME
  } catch {
    // Private mode or blocked storage: fall back to the default rather than failing.
    return DEFAULT_THEME
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme

  // Keeps the mobile browser chrome in step with the page.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#101216' : '#ffffff')
}

/**
 * What the learner is actually looking at. The pre-paint script in index.html is what puts
 * the theme on the page, so the DOM — not storage — is the truth about the current state;
 * reading storage alone let the picker claim one thing while the page showed another.
 */
export function readAppliedTheme(): Theme {
  if (typeof document === 'undefined') return readStoredTheme()
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : DEFAULT_THEME
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readAppliedTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not being able to persist the choice should not stop it applying now.
    }
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}

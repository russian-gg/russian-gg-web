import { useEffect, useState } from 'react'
import { api } from './api'

export type OpenGame = {
  slug: string
  titleUz: string
  bodyUz: string
  isBuilt: boolean
  isEnabled: boolean
}

/**
 * The games this learner may open, as the server sees it.
 *
 * Everything is off until somebody turns it on in the panel, so an empty list is the ordinary
 * answer rather than a failure — and it is what makes the section vanish from the menu instead
 * of standing there empty. A failed request is treated as empty for the same reason: a menu
 * item that leads to a shelf we could not load is worse than no menu item.
 */
export function useOpenGames() {
  const [games, setGames] = useState<OpenGame[] | null>(null)

  useEffect(() => {
    let cancelled = false

    void api
      .get<OpenGame[]>('/games')
      .then((open) => {
        if (!cancelled) setGames(Array.isArray(open) ? open : [])
      })
      .catch(() => {
        if (!cancelled) setGames([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  return games
}

import { useEffect, useState } from 'react'
import { api } from './api'

/** GET /api/landing/stats (LandingController.Stats on the server). */
type LandingStats = { learners: number; countedAt: string }

const STORAGE_KEY = 'rgg.landing.learners'

/**
 * Shown only until this browser has heard the real count once — the figure the copy carried
 * before it was live. After the first answer the last real count is remembered instead, so a
 * returning visitor never sees this number flash in front of the true one.
 */
const FALLBACK_LEARNERS = 2500

/** One request per page load, shared by every figure that quotes it (the hero, the proof band). */
let request: Promise<number> | null = null

function remembered(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function load(): Promise<number> {
  request ??= api.get<LandingStats>('/landing/stats').then((stats) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(stats.learners))
    } catch {
      // Private mode or a full quota: the count is still right for this visit.
    }
    return stats.learners
  })
  return request
}

/** The live learner count; the last known (or the fallback) until the server answers. */
export function useLearnerCount(): number {
  const [count, setCount] = useState(() => remembered() ?? FALLBACK_LEARNERS)

  useEffect(() => {
    let live = true
    load()
      .then((learners) => {
        if (live) setCount(learners)
      })
      .catch(() => {
        // Keep what is shown; let the next mount try again.
        request = null
      })
    return () => {
      live = false
    }
  }, [])

  return count
}

/**
 * Rounded down to a figure that reads as a milestone, so the "+" the page puts after it is
 * always true: 2 437 → 2 400, 12 900 → 12 000.
 */
export function roundDownForDisplay(value: number): number {
  const step = value < 100 ? 1 : value < 1000 ? 10 : value < 10000 ? 100 : 1000
  return Math.floor(value / step) * step
}

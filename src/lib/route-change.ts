import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Puts a new screen at the top, and tells a screen reader it arrived.
 *
 * React Router does neither on its own. Without the scroll reset, walking from the bottom of
 * the ninety-day path to Progress opened Progress halfway down — the browser only restores
 * scroll on a real navigation, and this is not one. Without the focus move, nothing is
 * announced at all: focus stays on the link that was clicked, which no longer exists, so a
 * screen reader falls silent and a keyboard user resumes tabbing from the top of the document
 * rather than from the screen they just opened.
 *
 * `main` is focused rather than an offscreen live region because it is the thing that
 * changed. It carries `tabIndex={-1}` so it can take focus without becoming a tab stop.
 *
 * The first render is skipped: a fresh page load already starts at the top, and stealing
 * focus from the document on arrival would interrupt a screen reader mid-announcement.
 */
export function useRouteChange(target: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    // `instant`, not smooth: this is not a gesture the learner made, and animating a jump
    // they did not ask for reads as the page moving under them.
    window.scrollTo({ top: 0, behavior: 'instant' })
    target.current?.focus({ preventScroll: true })
  }, [pathname, target])
}

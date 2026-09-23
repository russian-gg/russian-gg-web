import { useEffect, useRef } from 'react'

/**
 * Anything the browser will stop on when Tab is pressed. `:not([tabindex="-1"])` keeps out
 * the elements a component has deliberately taken out of the order, and the `disabled`
 * filters keep out controls that are on screen but unreachable.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // `offsetParent` is null for anything `display: none`, which is how most of these
    // dialogs hide a step that is not the current one.
    (element) => element.offsetParent !== null || element === document.activeElement,
  )
}

/**
 * Keeps keyboard focus inside an open dialog, and puts it back where it came from on close.
 *
 * Every overlay in this product already declared `role="dialog" aria-modal="true"`, which
 * tells a screen reader the rest of the page is inert — and none of them made it true. Focus
 * stayed wherever it was when the dialog opened, so pressing Tab walked a screen reader
 * through a page its user had been told was not there, and the blocking gates (the welcome
 * gift, the lesson feedback, the phone prompt) could not be reached by keyboard at all.
 *
 * Three things, which are the three halves of the same promise:
 *
 *   1. On open, focus moves to the first thing inside — or to the container itself, which is
 *      why the caller should give it `tabIndex={-1}`. A dialog that opens with focus outside
 *      it is a dialog a screen reader never announces.
 *   2. While open, Tab and Shift+Tab wrap at the ends instead of escaping.
 *   3. On close, focus returns to whatever opened it, so the learner is put back where they
 *      were rather than at the top of the document.
 *
 * Escape is deliberately *not* handled here. Most of these dialogs already bind it, and some
 * of them must not be dismissible — a gate that has to be answered is not a popover.
 */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

    // After paint: the content of a dialog is often decided in the same commit that opens it.
    const frame = requestAnimationFrame(() => {
      const [first] = focusable(container)
      ;(first ?? container).focus()
    })

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return

      const items = focusable(container!)
      if (items.length === 0) {
        // Nothing to move to, so the only correct behaviour is to stay put.
        event.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (!container!.contains(active)) {
        // Focus escaped some other way — a click on the page behind, a programmatic move.
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
      // Only if the page has not already moved focus somewhere deliberate, which is what a
      // dialog that navigates on close does.
      if (previous?.isConnected && document.activeElement === document.body) previous.focus()
    }
  }, [active])

  return containerRef
}

import { useEffect, type RefObject } from 'react'

/**
 * The map can be dragged with the mouse as well as scrolled: press anywhere on it and pull it
 * up or down, and let go with a little glide. Touch screens already drag natively, so this is
 * for the mouse and the pen only.
 *
 * A press that barely moves is still a click (a coin opens); a real drag swallows the click
 * that follows it, so letting go over a coin does not open it.
 */
export function useDragScroll(scroller: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const box = scroller.current
    if (!box) return
    let pointer: number | null = null
    let startY = 0
    let startTop = 0
    let dragged = false
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let glide = 0

    const down = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      cancelAnimationFrame(glide)
      pointer = event.pointerId
      startY = lastY = event.clientY
      startTop = box.scrollTop
      lastT = performance.now()
      velocity = 0
      dragged = false
      // Followed on the window, so a drag that leaves the map still ends where it is let go.
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      const dy = event.clientY - startY
      if (!dragged && Math.abs(dy) < 6) return
      if (!dragged) {
        dragged = true
        box.classList.add('map-dragging')
      }
      box.scrollTop = startTop - dy
      const now = performance.now()
      const dt = Math.max(1, now - lastT)
      velocity = 0.8 * ((lastY - event.clientY) / dt) + 0.2 * velocity
      lastY = event.clientY
      lastT = now
    }
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      pointer = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!dragged) return
      box.classList.remove('map-dragging')
      // Only the click that ends this drag is swallowed, never a later one.
      window.setTimeout(() => {
        dragged = false
      }, 0)
      // Let go with a glide that slows to a stop.
      let v = velocity * 16
      const step = () => {
        if (Math.abs(v) < 0.5) return
        box.scrollTop += v
        v *= 0.92
        glide = requestAnimationFrame(step)
      }
      glide = requestAnimationFrame(step)
    }
    const click = (event: MouseEvent) => {
      if (!dragged) return
      dragged = false
      event.preventDefault()
      event.stopPropagation()
    }
    const stopGlide = () => cancelAnimationFrame(glide)

    box.addEventListener('pointerdown', down)
    box.addEventListener('click', click, true)
    box.addEventListener('wheel', stopGlide, { passive: true })
    return () => {
      cancelAnimationFrame(glide)
      box.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      box.removeEventListener('click', click, true)
      box.removeEventListener('wheel', stopGlide)
    }
  }, [scroller])
}

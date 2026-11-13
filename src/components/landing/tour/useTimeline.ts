import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { captionAfter, easeInOut, plan, stateAfter, type Scene } from './engine'

type Point = { x: number; y: number }

export type Ripple = { id: number; x: number; y: number }

/**
 * Plays a scene.
 *
 * One clock (`elapsed`, in ms) drives everything. It advances on animation frames while
 * `playing` is true and stands still otherwise. Per frame, the cursor and the progress bar are
 * written straight to the DOM; React only re-renders when a step's state applies, a press
 * starts or the caption changes — a dozen times per scene, not sixty times a second.
 *
 * Cursor positions are measured, never hard-coded: each target is found by its `data-tour`
 * name inside `stage`, and its rect is taken relative to the stage box. That makes the demo
 * correct at any width and any CSS scale of the mock. A target can aim the cursor above or
 * below its centre with `data-tour-y` (0 = top edge, 1 = bottom edge).
 *
 * The target under the cursor gets `data-tour-state="hover"`, and `"press"` while it is being
 * clicked, so the mock styles both in CSS (see `tour.css`).
 *
 * With `animate` off (reduced motion) nothing runs: the state is the scene's poster frame.
 */
export function useTimeline<S>({
  scene,
  animate,
  playing,
  stage,
  cursor,
  progress,
  onEnd,
}: {
  scene: Scene<S>
  animate: boolean
  playing: boolean
  stage: RefObject<HTMLDivElement | null>
  cursor: RefObject<HTMLDivElement | null>
  progress: RefObject<HTMLElement | null>
  onEnd: () => void
}) {
  const { times, total } = useMemo(() => plan(scene.steps), [scene])
  const [settled, setSettled] = useState(animate ? 0 : scene.poster + 1)
  const [ripple, setRipple] = useState<Ripple | null>(null)

  const elapsed = useRef(0)
  const settledRef = useRef(settled)
  const moveIndex = useRef(-1)
  const from = useRef<Point | null>(null)
  const last = useRef<Point | null>(null)
  const cache = useRef(new Map<number, Point>())
  const active = useRef<HTMLElement | null>(null)
  const ended = useRef(false)
  const onEndRef = useRef(onEnd)

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  const paint = useCallback(
    (t: number, before: number) => {
      const box = stage.current
      if (!box) return
      const frame = box.getBoundingClientRect()
      if (!frame.width) return

      let count = 0
      while (count < times.length && times[count].settle <= t) count++
      if (count !== settledRef.current) {
        settledRef.current = count
        setSettled(count)
      }

      const find = (name: string | undefined) =>
        name ? box.querySelector<HTMLElement>(`[data-tour="${name}"]`) : null
      const aim = (name: string | undefined): Point | null => {
        const el = find(name)
        if (!el) return null
        const rect = el.getBoundingClientRect()
        if (!rect.width && !rect.height) return null
        const fy = Number(el.dataset.tourY ?? 0.5)
        return { x: rect.left - frame.left + rect.width / 2, y: rect.top - frame.top + rect.height * fy }
      }
      const home = { x: frame.width * 0.84, y: frame.height * 0.92 }

      // The move in progress, or the last one finished.
      let k = -1
      for (let i = 0; i < scene.steps.length; i++) if (scene.steps[i].move && times[i].moveStart <= t) k = i

      let pos: Point = home
      if (k >= 0) {
        if (k !== moveIndex.current) {
          moveIndex.current = k
          from.current = last.current ?? home
        }
        const start = from.current ?? home
        const target = aim(scene.steps[k].move) ?? cache.current.get(k) ?? start
        cache.current.set(k, target)
        const span = times[k].moveEnd - times[k].moveStart
        const e = easeInOut(span > 0 ? Math.min(1, Math.max(0, (t - times[k].moveStart) / span)) : 1)
        const dx = target.x - start.x
        const dy = target.y - start.y
        const length = Math.hypot(dx, dy) || 1
        // A shallow arc, the way a hand moves a mouse, rather than a ruler-straight line.
        const arc = Math.sin(Math.PI * e) * Math.min(36, length * 0.12)
        pos = { x: start.x + dx * e - (dy / length) * arc, y: start.y + dy * e + (dx / length) * arc }
      } else {
        moveIndex.current = -1
      }
      last.current = pos

      // Hover and press on the target under the cursor.
      const onTarget = k >= 0 && t >= times[k].moveEnd
      const pressing = onTarget && !!scene.steps[k].click && t >= times[k].press && t < times[k].settle
      const el = onTarget ? find(scene.steps[k].move) : null
      if (el !== active.current) {
        active.current?.removeAttribute('data-tour-state')
        active.current = el
      }
      const mode = pressing ? 'press' : 'hover'
      if (el && el.dataset.tourState !== mode) el.dataset.tourState = mode

      // A click that started between the previous frame and this one leaves a ripple.
      for (let i = 0; i < scene.steps.length; i++) {
        if (scene.steps[i].click && before < times[i].press && times[i].press <= t) {
          setRipple({ id: i + 1, x: pos.x, y: pos.y })
        }
      }

      const pointer = cursor.current
      if (pointer) {
        pointer.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
        pointer.style.opacity = '1'
        if (pressing) pointer.dataset.pressed = ''
        else delete pointer.dataset.pressed
      }
      progress.current?.style.setProperty('--tour-progress', String(Math.min(1, t / total)))
    },
    [cursor, progress, scene.steps, stage, times, total],
  )

  // The clock.
  useEffect(() => {
    if (!animate || !playing) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      // Clamped, so a dropped frame or a throttled tab never skips a whole step.
      const dt = Math.min(64, now - previous)
      previous = now
      const before = elapsed.current
      const next = Math.min(total, before + dt)
      elapsed.current = next
      paint(next, before)
      if (next >= total) {
        if (!ended.current) {
          ended.current = true
          onEndRef.current()
        }
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, playing, paint, total])

  // First paint, and a repaint whenever the stage changes size (the cursor's targets moved).
  useLayoutEffect(() => {
    const box = stage.current
    if (!animate || !box) return
    paint(elapsed.current, elapsed.current)
    const observer = new ResizeObserver(() => paint(elapsed.current, elapsed.current))
    observer.observe(box)
    return () => observer.disconnect()
  }, [animate, paint, stage])

  // Nothing is left hovered when the scene goes.
  useEffect(
    () => () => {
      active.current?.removeAttribute('data-tour-state')
    },
    [],
  )

  const state = useMemo(() => stateAfter(scene, settled), [scene, settled])
  const caption = captionAfter(scene.steps, settled)
  return { state, caption, ripple }
}

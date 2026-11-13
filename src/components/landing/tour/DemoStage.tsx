import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type RefObject } from 'react'
import { cx } from '../../../lib/cx'
import { DESIGN, type Scene } from './engine'
import { useTimeline, type Ripple } from './useTimeline'

export type MockProps<S> = { state: S; compact: boolean }

/**
 * The stage: the mock drawn at a fixed design size and scaled to whatever width the page gives
 * it, with the fake cursor and its click ripple on top.
 *
 * Scaling the whole mock (rather than letting it reflow) is what keeps a product screenshot a
 * screenshot: at 330px or 1100px the same layout, the same line breaks, nothing overlapping.
 * The cursor sits outside the scaled layer, in real pixels, so it stays a cursor-sized cursor
 * on a phone; its positions come from measuring the targets, which already includes the scale.
 */
export function DemoStage<S>({
  scene,
  Mock,
  compact,
  animate,
  playing,
  progress,
  onEnd,
  onCaption,
}: {
  scene: Scene<S>
  Mock: ComponentType<MockProps<S>>
  compact: boolean
  animate: boolean
  playing: boolean
  progress: RefObject<HTMLElement | null>
  onEnd: () => void
  onCaption: (caption: number) => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  const cursor = useRef<HTMLDivElement>(null)
  const design = compact ? DESIGN.compact : DESIGN.wide
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const box = stage.current
    if (!box) return
    const measure = () => setScale(box.clientWidth / design.width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [design.width])

  const { state, caption, ripple } = useTimeline({ scene, animate, playing, stage, cursor, progress, onEnd })

  useEffect(() => {
    onCaption(caption)
  }, [caption, onCaption])

  return (
    <div ref={stage} className="tour-stage" data-paused={!playing || !animate ? '' : undefined}>
      <div
        className="tour-canvas"
        style={{
          width: design.width,
          height: design.height,
          transform: `scale(${scale})`,
          visibility: scale ? undefined : 'hidden',
        }}
      >
        <Mock state={state} compact={compact} />
      </div>
      {animate && <DemoCursor ref={cursor} ripple={ripple} small={compact} />}
    </div>
  )
}

/** An arrow pointer with a soft shadow, and the ring a click leaves behind. */
function DemoCursor({ ref, ripple, small }: { ref: RefObject<HTMLDivElement | null>; ripple: Ripple | null; small: boolean }) {
  return (
    <>
      {ripple && (
        <span key={ripple.id} className="tour-ripple" style={{ left: ripple.x, top: ripple.y }} />
      )}
      <div ref={ref} className={cx('tour-cursor', small && 'tour-cursor-small')}>
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path
            d="M5.5 3.2v15.9c0 .5.6.8 1 .4l3.6-3.6 2.4 5.6c.2.4.6.6 1 .4l1.9-.8c.4-.2.6-.6.4-1l-2.4-5.5h5c.5 0 .8-.6.4-1L6.5 2.8c-.4-.4-1-.1-1 .4Z"
            fill="#111318"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  )
}

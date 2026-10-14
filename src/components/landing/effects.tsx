import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, CSSProperties, PointerEvent, ReactNode } from 'react'
import { SequenceInView } from '../motion'
import * as m from 'motion/react-m'
import { useReducedMotion, useSpring } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import { cx } from '../../lib/cx'

/**
 * The landing page's atmosphere: the aurora field, the 3D tilt, the floating props and the
 * video slot. Everything here is decorative and `aria-hidden` except the video's own pause
 * control, and every loop is stilled by the reduced-motion rules in `styles.css` (`.landing`).
 */

/* ---------------------------------------------------------------------------- stage */

/**
 * Where a landing section starts its entrance: once its top has come up past the bottom 18%
 * of the screen. Firing on the first visible pixel meant every section played while it was
 * still a sliver under the fold, and a reader scrolling down met blocks that had already
 * finished — the page looked as if it all animated at once, out of sight.
 */
export const VIEW_MARGIN = '0px 0px -18% 0px'

/** `SequenceInView` with the landing page's trigger point. Children are `Reveal`s. */
export function Stage(props: Omit<ComponentProps<typeof SequenceInView>, 'margin'>) {
  return <SequenceInView margin={VIEW_MARGIN} {...props} />
}

/* --------------------------------------------------------------------------- aurora */

type Blob = { className: string; color: string; drift: string; delay: string; dx: string; dy: string }

const BLOBS: Blob[] = [
  { className: '-top-40 -left-24 h-[34rem] w-[34rem]', color: 'var(--aurora-a)', drift: '24s', delay: '0s', dx: '8%', dy: '6%' },
  { className: '-top-24 right-[-10rem] h-[30rem] w-[36rem]', color: 'var(--aurora-b)', drift: '28s', delay: '-6s', dx: '-6%', dy: '8%' },
  { className: 'top-[45%] left-[30%] h-[26rem] w-[30rem]', color: 'var(--aurora-c)', drift: '32s', delay: '-12s', dx: '10%', dy: '-6%' },
  { className: 'bottom-[-12rem] left-[-6rem] h-[28rem] w-[40rem]', color: 'var(--aurora-d)', drift: '26s', delay: '-3s', dx: '-4%', dy: '-8%' },
]

/**
 * A soft, slowly drifting colour field with a faint grid over it. Sits behind a section as its
 * first child; the section supplies `relative isolate overflow-hidden`.
 *
 * `blobs` picks how many of the four fields to draw: the hero gets all of them, a quieter
 * section only the first two.
 */
export function Aurora({ blobs = 4, grid = true, className }: { blobs?: number; grid?: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cx('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      {BLOBS.slice(0, blobs).map((blob) => (
        <span
          key={blob.className}
          className={cx('aurora__blob', blob.className)}
          style={
            {
              background: blob.color,
              '--drift': blob.drift,
              '--drift-delay': blob.delay,
              '--dx': blob.dx,
              '--dy': blob.dy,
            } as CSSProperties
          }
        />
      ))}
      {grid && <span className="aurora__grid" />}
      {/* Dissolve into the page at both ends, so a section's field never stops in a hard
          horizontal line against the next one. */}
      <span className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[var(--landing-field)] to-transparent" />
      <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--landing-field)] to-transparent" />
    </div>
  )
}

/* ----------------------------------------------------------------------------- tilt */

/**
 * Tips its content toward the pointer, a few degrees, on a spring — the card reads as an
 * object with depth rather than a flat rectangle. Also feeds `--mx`/`--my` to a `.sheen`
 * child so a soft light follows the cursor.
 *
 * Mouse only. On touch there is no hover to follow, and a card that rocks under a scrolling
 * thumb reads as broken; under reduced motion it never moves.
 */
export function Tilt({
  children,
  className,
  max = 7,
}: {
  children: ReactNode
  className?: string
  /** The largest lean in degrees, reached at the card's edge. */
  max?: number
}) {
  const reduced = useReducedMotion()
  const rotateX = useSpring(0, { stiffness: 180, damping: 18, mass: 0.6 })
  const rotateY = useSpring(0, { stiffness: 180, damping: 18, mass: 0.6 })

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return
    const box = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - box.left
    const y = event.clientY - box.top
    event.currentTarget.style.setProperty('--mx', `${x}px`)
    event.currentTarget.style.setProperty('--my', `${y}px`)
    if (reduced) return
    rotateY.set((x / box.width - 0.5) * max * 2)
    rotateX.set(-(y / box.height - 0.5) * max * 2)
  }

  function onPointerLeave() {
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <m.div
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      className={cx('[transform-style:preserve-3d]', className)}
    >
      {children}
    </m.div>
  )
}

/* --------------------------------------------------------------------------- float */

/**
 * A 3D prop hanging in the air beside a mock — one of the clay-blue renders the signed-in app
 * already uses. Positioned by the caller; this only supplies the bob, offset per prop so a
 * cluster never moves in step.
 */
export function FloatingProp({
  src,
  className,
  duration = 6,
  delay = 0,
  lift = -12,
  tilt = 0,
}: {
  src: string
  className?: string
  duration?: number
  delay?: number
  lift?: number
  tilt?: number
}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={cx('float pointer-events-none absolute select-none drop-shadow-[0_18px_28px_rgb(45_118_221/0.28)]', className)}
      style={
        {
          '--float-duration': `${duration}s`,
          '--float-delay': `${delay}s`,
          '--float-lift': `${lift}px`,
          '--float-tilt': `${tilt}deg`,
        } as CSSProperties
      }
    />
  )
}

/* ---------------------------------------------------------------------------- video */

/**
 * A looping, muted product clip — or, until one exists, the animated scene that stands in for
 * it.
 *
 * `src` is optional on purpose. The clips are produced separately (see `LANDING_VIDEOS` in
 * `routes/Landing.tsx`); a section ships with its `fallback` and starts playing the clip the
 * moment a path is filled in, with no layout change between the two. A file that fails to load
 * drops back to the fallback rather than leaving a black box.
 *
 * It plays only while on screen — a decoding video below the fold is battery spent on nothing —
 * and it carries its own pause control, because anything that moves for more than five seconds
 * has to be stoppable (WCAG 2.2.2). Under reduced motion it starts paused on its poster.
 */
export function LandingVideo({
  src,
  poster,
  fallback,
  label,
  playLabel,
  pauseLabel,
  className,
}: {
  src?: string | null
  poster?: string
  fallback: ReactNode
  /** What the clip shows, for assistive technology. */
  label: string
  playLabel: string
  pauseLabel: string
  className?: string
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  // The viewer's own choice, once they have made one, beats the reduced-motion default.
  const [choice, setChoice] = useState<'play' | 'pause' | null>(null)
  const [visible, setVisible] = useState(false)
  const stopped = choice === 'pause' || (choice === null && Boolean(reduced))

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 })
    observer.observe(video)
    return () => observer.disconnect()
  }, [src, failed])

  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (visible && !stopped) {
      // A rejected play() (autoplay blocked, data saver) leaves the poster up, which is fine.
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [visible, stopped])

  if (!src || failed) return <>{fallback}</>

  return (
    <div className={cx('relative size-full', className)}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
      <button
        type="button"
        onClick={() => setChoice(stopped ? 'play' : 'pause')}
        aria-label={stopped ? playLabel : pauseLabel}
        className="glass absolute right-3 bottom-3 z-10 grid size-10 place-items-center rounded-full text-ink"
      >
        {stopped ? (
          <Play aria-hidden="true" strokeWidth={1.9} className="size-4 fill-current" />
        ) : (
          <Pause aria-hidden="true" strokeWidth={1.9} className="size-4 fill-current" />
        )}
      </button>
    </div>
  )
}

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, LazyMotion, MotionConfig, useInView, type Variants } from 'motion/react'
import * as m from 'motion/react-m'
import {
  backdrop,
  dialog,
  duration,
  ease,
  fadeUp,
  popover,
  sequence,
  sheet,
  stagger,
  useCountUp,
  useIsPhone,
} from '../lib/motion'

/**
 * The components of the motion system. The tokens, variants and hooks they are built from
 * live in `lib/m.ts`.
 *
 * Split in two for the same reason `lib/cx.ts` sits outside the component modules: a file
 * that exports both components and constants breaks fast refresh for everything that imports
 * it, and this one is imported by most of the product.
 */

/* ------------------------------------------------------------------------ providers */

/**
 * Wraps the app so every animation inside it obeys the operating system.
 *
 * This is not optional politeness, and it is the one piece of this file that is load-bearing
 * for correctness. `styles.css` already collapses every CSS animation and transition under
 * `prefers-reduced-motion: reduce` — but that rule cannot touch Motion, which drives inline
 * styles from JavaScript and never consults a stylesheet. Without this provider, turning on
 * "reduce motion" would silence the birds and the confetti and leave every dialog, list and
 * screen transition in the product still flying around.
 *
 * `reducedMotion="user"` is Motion's own answer: it keeps opacity and colour transitions and
 * drops transforms and layout animation. That is the right trade rather than freezing
 * everything — a dialog that fades is still legible as arriving, and the people who turn this
 * setting on are usually asking not to be moved, not asking to be told nothing happened.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    /*
      `LazyMotion` is here for the bundle, not for the behaviour.

      Motion's full `motion` component carries every feature it has — gestures, layout
      projection, drag — whether a page uses them or not, and importing it put ~45 KB gzipped
      into the entry chunk. That is the chunk this codebase already went to some trouble to
      get down (see the note over the lazy routes in `App.tsx`), for an audience the comments
      there describe as being on mobile data. Paying a third of that budget back for
      animation would have been a poor trade made silently.

      So the app uses `m` — the same component with none of the features compiled in — and the
      features arrive as their own chunk, requested after the first paint. `strict` enforces
      it: a `m.div` that slips in anywhere under this provider throws immediately rather
      than quietly dragging the full bundle back into the entry chunk, which is the kind of
      regression nobody notices for six months.

      `domAnimation` covers what this product actually does: animation, variants, exit
      animations and the hover/tap/focus gestures. Drag and layout projection are in `domMax`
      and are not used anywhere here.
    */
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: duration.base, ease: ease.enter }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}

/** Split into its own chunk. See `lib/motion-features.ts` for why the indirection is needed. */
const loadFeatures = () => import('../lib/motion-features').then((mod) => mod.default)

/* ------------------------------------------------------------------------ components */

/**
 * Whether the thing being rendered already has a parent driving it.
 *
 * This is the hinge the whole sequencing mechanism turns on, and it is worth stating plainly
 * because getting it wrong is silent.
 *
 * Motion propagates a variant *label* from a parent to its children — but only to children
 * that have not been given an `animate` of their own. A child that says `animate="shown"`
 * has opted out: it runs on its own clock, immediately, and the parent's `staggerChildren`
 * never reaches it. So a `Reveal` that always set its own `animate`, placed inside a
 * `Sequence`, would look exactly like a correctly sequenced list in the source and arrive all
 * at once on screen, with nothing anywhere reporting a problem.
 *
 * So: the outermost wrapper drives, and everything under it inherits. The context carries
 * that one bit down.
 */
const Orchestrated = createContext(false)

/**
 * The props that make a wrapper drive its own animation — or nothing at all, if something
 * above it is already driving.
 *
 * `exit` is included in what gets dropped. `AnimatePresence` propagates exit down the same
 * way, so a nested child naming its own `exit` would leave on its own clock while its parent
 * was still leaving on the parent's.
 */
function useDriven(force = false) {
  const nested = useContext(Orchestrated)
  return nested && !force ? {} : ({ initial: 'hidden', animate: 'shown', exit: 'exit' } as const)
}

/**
 * The everyday wrapper: fades its content up once, when it arrives.
 *
 * `Reveal` and `Sequence` exist so a screen can say what it means — "this section arrives,
 * these rows follow it" — without every file importing five variants and remembering which
 * label is which. Anything more particular than this reaches for `m.div` directly.
 *
 * A `Reveal` inside a `Sequence` inherits its timing. A `Reveal` on its own animates as soon
 * as it mounts. Nothing at the call site has to say which of those is happening.
 */
export function Reveal({
  children,
  variants = fadeUp,
  delay,
  className,
  as = 'div',
  drive = false,
}: {
  children: ReactNode
  variants?: Variants
  /** A beat before this one moves. Use sparingly — prefer a `Sequence` parent. */
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'article' | 'span'
  /** See `drive` on `Sequence`. */
  drive?: boolean
}) {
  const Tag = m[as]
  const driven = useDriven(drive)

  return (
    <Tag {...driven} variants={variants} transition={delay ? { delay } : undefined} className={className}>
      {children}
    </Tag>
  )
}

/**
 * A parent whose children arrive one after another.
 *
 * The children must be `Reveal`s or `motion` elements carrying a variant with the same
 * labels — that is how the sequence reaches them. A plain `<div>` in the middle of a
 * `Sequence` is not a bug, but it does not take part: it appears immediately and the beat
 * skips over it.
 *
 * Sequences nest. An inner one inherits *when* it starts from the outer one, and then runs
 * its own beat over its own children — which is how a two-column screen gives each column a
 * rhythm without the columns fighting for the same clock.
 */
export function Sequence({
  children,
  gap = stagger.base,
  delay = 0,
  className,
  as = 'div',
  drive = false,
}: {
  children: ReactNode
  gap?: number
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'ul' | 'ol' | 'aside'
  /**
   * Drive this one's own entrance and exit even though something above it is orchestrating.
   *
   * The one case that needs it: a block that is a direct child of an `AnimatePresence` while
   * also sitting inside a `Sequence`. Inheriting would leave it with no `exit` of its own —
   * its parent is not going anywhere, so nothing would ever tell it to leave — and it would
   * be torn out of the tree on the spot instead of animating away. Everywhere else, leave
   * this alone: the default is what makes nesting work.
   */
  drive?: boolean
}) {
  const Tag = m[as]
  const driven = useDriven(drive)

  return (
    <Orchestrated.Provider value={true}>
      <Tag {...driven} variants={sequence(gap, delay)} className={className}>
        {children}
      </Tag>
    </Orchestrated.Provider>
  )
}

/**
 * Shows a block that is sitting on screen but still hidden.
 *
 * `whileInView` has one bad failure mode and it is the worst one available to a content app:
 * when the trigger does not fire, the content is not late, it is *gone* — `initial="hidden"`
 * is `opacity: 0`, and nothing ever moves it. The ninety-day path shipped in exactly that
 * state on phones, and the page looked empty rather than looked broken, which is why it was
 * not obvious.
 *
 * So this is a second opinion, asked once, shortly after mount: if the element is within the
 * viewport and the observer has still not driven it, drive it. A block that is genuinely
 * below the fold is left alone and keeps its scroll behaviour.
 *
 * The delay is comfortably longer than any entrance in the system, so in the ordinary case
 * this fires after the animation has already finished and changes nothing.
 */
function useOnScreenFailsafe(ref: React.RefObject<HTMLElement | null>, after = 900) {
  const [rescued, setRescued] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const element = ref.current
      if (!element) return

      const box = element.getBoundingClientRect()
      // Zero-sized means it is not laid out yet; that is not the case this rescues.
      if (box.height === 0 && box.width === 0) return

      const onScreen = box.top < window.innerHeight && box.bottom > 0
      if (onScreen) setRescued(true)
    }, after)

    return () => window.clearTimeout(timer)
  }, [ref, after])

  return rescued
}

/**
 * The same as `Sequence`, but it waits until the block is actually on screen.
 *
 * For the long marketing page, where firing every section's entrance at load means the
 * learner scrolls down to eight sections that have already finished animating. `once` is
 * always true: a section that replays its entrance every time it scrolls back into view is
 * the single most tiring pattern on the web.
 *
 * `amount` is `'some'` — the block starts arriving as soon as any part of it is on screen —
 * and that is load-bearing rather than a preference.
 *
 * It used to be `0.2`, meaning *a fifth of this element must be visible*. A fraction is only
 * satisfiable while the block is shorter than five viewports; past that the threshold asks
 * for more of the element than the screen can physically show at once, the observer never
 * fires, and the content sits at `opacity: 0` permanently. The ninety-day path hit exactly
 * that: a phase is up to thirty cards, which on a phone is one column roughly 3,600px tall,
 * so 20% was ~720px against a ~700px viewport — unreachable at any scroll position, and the
 * lessons simply never appeared.
 *
 * `'some'` cannot fail that way at any height, and for a block that starts above the fold it
 * resolves on the first frame, which is what makes the top of a page animate on arrival
 * rather than on scroll.
 *
 * Whatever the trigger, the failure mode of this component is content that is never shown, so
 * prefer erring toward showing: a section that animates slightly too early costs nothing, and
 * one that never animates costs the whole screen.
 *
 * This one always drives, even nested: waiting for the viewport is the entire point, so
 * inheriting a parent's "go now" would defeat it.
 */
export function SequenceInView({
  children,
  gap = stagger.base,
  className,
  as = 'div',
  amount = 'some',
}: {
  children: ReactNode
  gap?: number
  className?: string
  as?: 'div' | 'section' | 'ul' | 'ol'
  /**
   * How much of the block must be on screen. Prefer the default.
   *
   * A number is a *fraction of this element*, so it silently stops being reachable once the
   * element grows past roughly five screens tall — pass one only for a block with a bounded
   * height, and never for a list.
   */
  amount?: 'some' | 'all' | number
}) {
  /*
    Narrowed to one element type. `m[as]` is a union, and TypeScript resolves the `ref` on a
    union of components to the *intersection* of their ref types — a value that cannot exist.
    The cast costs nothing real: the runtime component is still whichever tag was asked for,
    and the ref is only ever measured, never treated as a specific element.
  */
  const Tag = m[as] as typeof m.div
  const ref = useRef<HTMLDivElement>(null)
  const rescued = useOnScreenFailsafe(ref)

  return (
    <Orchestrated.Provider value={true}>
      <Tag
        ref={ref}
        variants={sequence(gap)}
        initial="hidden"
        whileInView="shown"
        /*
          The failsafe below promotes this to an unconditional `shown`. While it is false the
          prop is absent entirely, so `whileInView` is the only thing driving and the ordinary
          scroll behaviour is untouched.
        */
        animate={rescued ? 'shown' : undefined}
        viewport={{ once: true, amount }}
        className={className}
      >
        {children}
      </Tag>
    </Orchestrated.Provider>
  )
}

/* ----------------------------------------------------------------------------- count */

/**
 * Counts up the first time it is scrolled into view, then holds.
 *
 * The count is evidence of progress, and evidence that fired while the block was still below
 * the fold has not been shown to anybody.
 */
export function CountUp({ value, ms, className }: { value: number; ms?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.6 })
  const shown = useCountUp(seen ? value : 0, ms)

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  )
}

/* --------------------------------------------------------------------------- overlay */

/**
 * A dialog's backdrop and panel, arriving and — the whole point — leaving.
 *
 * An exit animation is the one thing plain CSS still cannot do. The element is gone from the
 * tree the instant the condition flips, so there is nothing left to transition; every dialog
 * in this app used to vanish between two frames while its backdrop vanished with it, which
 * reads as a glitch rather than a dismissal. `AnimatePresence` holds the subtree mounted
 * until its exit finishes, which is why every overlay in the product now routes through here.
 *
 * What this does *not* own, deliberately: the focus trap, the Escape key, the aria wiring and
 * the panel's own styling all stay with the caller. They differ per dialog, several of them
 * are load-bearing for accessibility, and burying them in a motion helper is how they rot.
 * This is a layer that animates; it is not a dialog framework.
 *
 * `portal` is opt-in because some of these already sit at the top of the tree and portalling
 * them a second time would move them out of a provider they depend on.
 */
export function Overlay({
  open,
  onDismiss,
  children,
  align = 'center',
  portal = false,
  className,
  backdropClassName = 'bg-black/40',
}: {
  open: boolean
  /** Click-outside. Omit for a dialog that must be answered rather than dismissed. */
  onDismiss?: () => void
  children: ReactNode
  /** `bottom` anchors the panel to the bottom edge on phones, as a sheet. */
  align?: 'center' | 'bottom'
  portal?: boolean
  className?: string
  backdropClassName?: string
}) {
  const phone = useIsPhone()

  const tree = (
    <AnimatePresence>
      {open && (
        <m.div
          key="overlay"
          initial="hidden"
          animate="shown"
          exit="exit"
          className={
            className ??
            (align === 'bottom'
              ? 'fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6'
              : 'fixed inset-0 z-50 flex items-center justify-center px-4')
          }
        >
          {/*
            A separate element behind the panel rather than a background on the flex container,
            so the dim can fade on its own clock. They are not the same gesture: the backdrop
            covers the app and the panel arrives on top of it, and tying them to one opacity
            makes the panel look like it is being painted onto the dim.
          */}
          <m.div
            variants={backdrop}
            onClick={onDismiss}
            aria-hidden="true"
            className={`absolute inset-0 ${backdropClassName}`}
          />
          <m.div
            variants={align === 'bottom' && phone ? sheet : dialog}
            className="relative z-10 flex w-full justify-center"
          >
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )

  if (!portal) return tree
  return typeof document === 'undefined' ? null : createPortal(tree, document.body)
}

/**
 * A menu or popover that folds away instead of blinking out.
 *
 * Same contract as `Overlay`: the caller keeps the positioning, the roles and the key
 * handling, and this only holds the panel on screen long enough to leave.
 */
export function PopoverSurface({
  open,
  children,
  className,
  style,
}: {
  open: boolean
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          variants={popover}
          initial="hidden"
          animate="shown"
          exit="exit"
          style={style}
          className={className}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  )
}

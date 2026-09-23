import { useEffect, useRef, useState } from 'react'
import { useReducedMotion, type Transition, type Variants } from 'motion/react'

/**
 * The motion system.
 *
 * One vocabulary, shared, for the same reason the button geometry is shared in `ui.tsx`: a
 * screen that invents its own timing is the thing that makes a product feel assembled rather
 * than built. Everything animated in the app draws its duration, its curve and its stagger
 * from this file.
 *
 * Two rules decide what belongs here and what stays in CSS:
 *
 * 1. CSS keeps what CSS already does well. The button press, the hover lift, the hero birds
 *    and the celebration confetti are CSS and stay CSS — they are cheap, they are already
 *    tuned, and `styles.css` stills them under `prefers-reduced-motion`. Motion is for the
 *    things CSS cannot reach: elements animating *out*, lists that arrive in sequence,
 *    layout that moves between two positions, numbers that count.
 * 2. Nothing animates that does not carry meaning. The course colours a word only once the
 *    lesson has taught it (`.claude/rules/client-side/russian-color-system.md`); motion here
 *    follows the same discipline. Entrances point at what arrived, sequence explains what
 *    follows what, and a thing that simply exists does not wobble to say so.
 */

/* ------------------------------------------------------------------------- durations */

/**
 * Four durations, in seconds, because Motion counts in seconds and CSS counts in
 * milliseconds and mixing the two is how a 300ms animation becomes a five-minute one.
 *
 * `quick` is deliberately the same 150ms the controls in `ui.tsx` already transition at, so
 * a Motion fade next to a CSS hover reads as one gesture rather than two.
 */
export const duration = {
  /** A state flip that should feel like it already happened. */
  quick: 0.15,
  /** The default for anything entering or leaving. */
  base: 0.28,
  /** Larger surfaces — a dialog, a screen, a panel the eye has to travel across. */
  slow: 0.42,
  /** Reserved for the one thing on screen worth waiting for: a result, a reward. */
  deliberate: 0.62,
} as const

/* --------------------------------------------------------------------------- easing */

/**
 * Curves, as raw cubic-bezier control points.
 *
 * `exit` is faster and flatter than `enter` on purpose. Something arriving is worth watching
 * and decelerates into place; something leaving has already been decided about, and holding
 * it on screen to admire the curve is just latency the learner has to sit through.
 */
export const ease = {
  /** Decelerate hard into rest. The house curve — most entrances use it. */
  enter: [0.22, 1, 0.36, 1],
  /** Accelerate away. Short, so a dismissal feels answered rather than animated. */
  exit: [0.4, 0, 1, 1],
  /** Symmetric. For something that moves without arriving or leaving — a knob, a track. */
  move: [0.4, 0, 0.2, 1],
} as const

/**
 * The spring the physical surfaces use.
 *
 * This product's controls sit on a solid edge and sink onto it when pushed (see `press` in
 * `ui.tsx`); they are objects, not rectangles. Anything that should belong to that world —
 * a card landing, a badge popping in, a knob settling — moves on a spring rather than a
 * curve, because a curve stops dead and an object does not.
 *
 * `bounce: 0.28` is the ceiling worth using here. Past roughly a third, a card arriving
 * overshoots far enough to read as a toy, and this is a course a grown adult paid for.
 */
export const spring = { type: 'spring', duration: 0.5, bounce: 0.28 } satisfies Transition

/** A heavier spring for big surfaces, where the same bounce would look like a wobble. */
export const springSoft = { type: 'spring', duration: 0.6, bounce: 0.12 } satisfies Transition

/* -------------------------------------------------------------------------- stagger */

/**
 * The gap between siblings in a sequence, in seconds.
 *
 * The number matters more than it looks. Under about 40ms a stagger stops reading as a
 * sequence and becomes a single smeared frame; over about 90ms the last item in a row of six
 * arrives half a second after the first, and the learner is waiting on the interface. The
 * scale below is picked so a list of a *typical* length for its kind lands inside ~300ms:
 *
 * | token  | gap  | use                                                   |
 * |--------|------|-------------------------------------------------------|
 * | `tight`| 40ms | long lists — a ninety-day path, a vocabulary table     |
 * | `base` | 60ms | the ordinary case: cards, rows, tiles                  |
 * | `wide` | 90ms | three or four deliberate steps the eye should separate |
 */
export const stagger = { tight: 0.04, base: 0.06, wide: 0.09 } as const

/* ------------------------------------------------------------------------- variants */

/**
 * The house entrance: up and in.
 *
 * 12px, not the 24 or 40 a landing page usually reaches for. The distance is doing one job —
 * saying *this is new* — and past a small nudge it stops being a hint and becomes a slide the
 * eye has to follow to the end before it can read anything.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.enter } },
  exit: { opacity: 0, y: -8, transition: { duration: duration.quick, ease: ease.exit } },
}

/** The same entrance without the travel. For anything already in its final place. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: duration.base, ease: ease.enter } },
  exit: { opacity: 0, transition: { duration: duration.quick, ease: ease.exit } },
}

/**
 * Arrives from the side. Rails, drawers, and anything that belongs to an edge.
 *
 * Written as two explicit branches rather than one computed `[axis]` key: a computed key
 * widens the object to a string index signature, and Motion's `Variant` type will not accept
 * one — it has to know that the thing being animated is `x` or `y` and not an arbitrary
 * property.
 */
export const fadeIn = (from: 'left' | 'right' | 'up' | 'down' = 'up', distance = 12): Variants => {
  const sign = from === 'left' || from === 'up' ? -1 : 1
  const offset = distance * sign
  const enter = { duration: duration.base, ease: ease.enter }
  const leave = { duration: duration.quick, ease: ease.exit }

  return from === 'left' || from === 'right'
    ? {
        hidden: { opacity: 0, x: offset },
        shown: { opacity: 1, x: 0, transition: enter },
        exit: { opacity: 0, x: offset * 0.6, transition: leave },
      }
    : {
        hidden: { opacity: 0, y: offset },
        shown: { opacity: 1, y: 0, transition: enter },
        exit: { opacity: 0, y: offset * 0.6, transition: leave },
      }
}

/**
 * A card landing on the surface: comes forward slightly and settles on the spring.
 *
 * Scale starts at 0.96 rather than 0.8. A card that grows from nothing reads as a popup
 * being conjured; one that starts nearly its own size reads as a card that was always there
 * and is now in focus — which is what a mission card actually is.
 */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  shown: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: duration.quick, ease: ease.exit } },
}

/** A small thing asserting itself: a badge, a tick, a counter chip. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  shown: { opacity: 1, scale: 1, transition: { type: 'spring', duration: 0.42, bounce: 0.4 } },
  exit: { opacity: 0, scale: 0.8, transition: { duration: duration.quick, ease: ease.exit } },
}

/**
 * A parent that hands its children a sequence.
 *
 * This is the whole mechanism behind every step-by-step reveal in the app, and it is worth
 * being precise about why it is built as variants rather than as a delay on each child.
 * Motion propagates a variant *label* from parent to children, so the parent says "shown"
 * once and every child that names the same label follows on the parent's clock. A child can
 * be added, removed or reordered and the rhythm survives; a hand-written `delay: index * 0.06`
 * has to be renumbered every time the list changes, and silently breaks when the list is
 * filtered.
 *
 * `delayChildren` is the beat before the first child moves. It exists so a heading can land
 * first and the list can follow it, which is the order the eye reads them in anyway.
 *
 * On exit the order reverses (`staggerDirection: -1`): things leave last-in-first-out, the
 * way a stack unwinds.
 */
export const sequence = (gap: number = stagger.base, delay = 0): Variants => ({
  hidden: {},
  shown: {
    transition: { staggerChildren: gap, delayChildren: delay },
  },
  exit: {
    transition: { staggerChildren: gap * 0.5, staggerDirection: -1 },
  },
})

/* --------------------------------------------------------------------------- dialog */

/** The dimmed layer behind a dialog. Opacity only — a blurred backdrop that also moves is noise. */
export const backdrop: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: duration.base, ease: ease.enter } },
  exit: { opacity: 0, transition: { duration: duration.quick, ease: ease.exit } },
}

/**
 * The dialog itself, on desktop: rises and settles.
 */
export const dialog: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  shown: { opacity: 1, scale: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: duration.quick, ease: ease.exit } },
}

/**
 * The same dialog as a phone sheet: it comes up from the bottom edge it is anchored to.
 *
 * Several of this app's dialogs are already `items-end` on phones and `items-center` from
 * `sm` up, so the sheet variant is the honest one on the small screen — a panel pinned to the
 * bottom of the display should arrive from the bottom of the display, not fade in mid-air.
 */
export const sheet: Variants = {
  hidden: { opacity: 0, y: '18%' },
  shown: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: '12%', transition: { duration: duration.base, ease: ease.exit } },
}

/**
 * A menu or popover unfolding from the control that opened it.
 *
 * The caller sets `transform-origin` in CSS to match the corner it hangs from; without that
 * the panel scales from its own middle and reads as detached from its button.
 */
export const popover: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -6 },
  shown: { opacity: 1, scale: 1, y: 0, transition: { duration: duration.quick, ease: ease.enter } },
  exit: { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.12, ease: ease.exit } },
}

/**
 * A row opening or closing in place — a details panel, a hint, an error.
 *
 * `height: auto` is animatable by Motion (it measures the target and interpolates), which is
 * the one thing plain CSS still cannot do without a hard-coded pixel height that goes stale
 * the moment the copy changes or the locale switches. This app ships three locales, so
 * hard-coded heights were never an option.
 */
export const collapse: Variants = {
  hidden: { opacity: 0, height: 0 },
  shown: { opacity: 1, height: 'auto', transition: { duration: duration.base, ease: ease.enter } },
  exit: { opacity: 0, height: 0, transition: { duration: duration.quick, ease: ease.exit } },
}

/* --------------------------------------------------------------------- interactions */

/**
 * Hover and press for a surface that is not a `<button>` — a card, a tile, a link panel.
 *
 * Real controls are left alone. The button in `ui.tsx` already lifts on hover and sinks onto
 * its own edge on press, drawn with a shadow that follows the pill radius; re-implementing
 * that here as a Motion `whileTap` would fight the CSS for the same transform and lose the
 * edge. This is for the surfaces that never had it.
 *
 * `whileTap` rather than `whileHover` alone matters on a phone, where there is no hover at
 * all: without a tap state a card gives no feedback whatsoever on the device most of this
 * audience is using.
 */
export const tactile = {
  whileHover: { y: -2, transition: { duration: duration.quick, ease: ease.move } },
  whileTap: { y: 1, scale: 0.99, transition: { duration: 0.08, ease: ease.move } },
} as const

/** The same, for something small and square where a lift reads better as a swell. */
export const tactileSmall = {
  whileHover: { scale: 1.03, transition: { duration: duration.quick, ease: ease.move } },
  whileTap: { scale: 0.97, transition: { duration: 0.08, ease: ease.move } },
} as const

/* ----------------------------------------------------------------------------- count */

/**
 * A number that counts up to its value instead of appearing at it.
 *
 * Used only where the number is the point — a streak, a score, a day count on the progress
 * screen. A counter on an ordinary label is a gimmick that makes the reader wait to find out
 * what they are looking at.
 *
 * Written against `useState` rather than Motion's `animate()` on a motion value because the
 * value is rendered as text and often formatted (thousands separators, a percent sign), and
 * a motion value bound to `textContent` skips React's formatting entirely.
 *
 * Three behaviours are deliberate:
 *  - It counts only on the way up. A number that drops — a streak reset — jumps, because
 *    animating a loss slowly is cruelty with an easing curve.
 *  - It starts from wherever it already was, so a value arriving late from the server does
 *    not restart the count from zero.
 *  - Under reduced motion it is simply the number. No timer, no frames.
 */
export function useCountUp(value: number, ms = 900) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (reduced || value <= from.current) {
      from.current = value
      setShown(value)
      return
    }

    const start = performance.now()
    const origin = from.current
    const span = value - origin
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / ms)
      // Ease out cubic: the count is quick at first and lands gently, which reads as a
      // total settling rather than a stopwatch being halted.
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(Math.round(origin + span * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, ms, reduced])

  return shown
}

/* --------------------------------------------------------------------------- media */

/**
 * Is this a phone-sized screen right now?
 *
 * Only for choosing between the two dialog entrances below. Layout stays in CSS where it
 * belongs — this exists because a *variant* cannot be written as a media query, and a panel
 * pinned to the bottom edge on a phone and floating in the middle on a desktop genuinely
 * needs two different entrances.
 *
 * Kept in sync with Tailwind's `sm`, which is where every dialog in this app switches from
 * `items-end` to `items-center`.
 */
export function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    const onChange = () => setPhone(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return phone
}

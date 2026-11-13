import { Fragment, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useInView, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import * as m from 'motion/react-m'
import { cx } from '../../lib/cx'
import { ease } from '../../lib/motion'
import './alive.css'

/**
 * The landing page's "alive" layer: the small, continuous motions that make the page feel like
 * a running product rather than a poster — a reading-progress line, headlines that assemble word
 * by word, cards lit by the pointer, a phrase being typed and checked, things that drift as the
 * page scrolls. Every one of them is decoration: stilled under reduced motion, and never the
 * only carrier of any text.
 */

/** A thin spectrum line across the top of the window that fills as the page is read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 })
  return <m.div aria-hidden="true" className="alive-progress" style={{ scaleX }} />
}

/**
 * A headline that arrives one word at a time, each word sharpening out of a blur — the way
 * generated text lands. Screen readers get the sentence whole.
 *
 * `accent` paints the words inside its match in the spectrum gradient (the "90 days" of the
 * hero); `immediate` plays on mount instead of waiting to scroll into view.
 */
export function WordsIn({
  text,
  accent,
  immediate = false,
  delay = 0,
  className,
}: {
  text: string
  accent?: RegExp
  immediate?: boolean
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const reduced = useReducedMotion() ?? false
  const shown = immediate || seen

  const match = accent ? accent.exec(text) : null
  const from = match ? match.index : -1
  const to = match ? match.index + match[0].length : -1

  // Words with their offsets, so the accent can be decided per word.
  const words: Array<{ word: string; at: number }> = []
  for (const found of text.matchAll(/\S+/g)) words.push({ word: found[0], at: found.index })

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map(({ word, at }, index) => (
          <Fragment key={`${index}-${word}`}>
            <m.span
              className={cx('inline-block will-change-transform', at >= from && at < to && 'text-spectrum')}
              initial={reduced ? false : { opacity: 0, y: '0.35em', filter: 'blur(10px)' }}
              animate={shown ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
              transition={{ duration: 0.6, ease: ease.enter, delay: delay + index * 0.055 }}
            >
              {word}
            </m.span>
            {/* The space lives between the words, where the line is allowed to break. */}
            {index < words.length - 1 && ' '}
          </Fragment>
        ))}
      </span>
    </span>
  )
}

/**
 * Lights its content from under the pointer: a soft glow that follows the cursor and a border
 * that brightens near it. The position is written straight to CSS variables, so moving the
 * mouse never re-renders anything.
 */
export function Spotlight({
  children,
  className,
  night = false,
  style,
}: {
  children: ReactNode
  className?: string
  /** On the navy sections the glow is lighter, so it shows against the dark ground. */
  night?: boolean
  style?: CSSProperties
}) {
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    const el = event.currentTarget
    const box = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${event.clientX - box.left}px`)
    el.style.setProperty('--my', `${event.clientY - box.top}px`)
  }
  return (
    <div className={cx('alive-spot', night && 'alive-spot-night', className)} style={style} onPointerMove={onPointerMove}>
      {children}
    </div>
  )
}

/**
 * Drifts its content against the scroll: it rides `distance` pixels higher or lower than the
 * page as the block crosses the window. Negative distances drift the other way.
 */
export function Parallax({ children, distance = 40, className }: { children: ReactNode; distance?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion() ?? false
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance])
  return (
    <m.div ref={ref} className={className} style={reduced ? undefined : { y }}>
      {children}
    </m.div>
  )
}

/**
 * A phrase being spoken and checked, on a loop: it types out, a score lands, it clears, the next
 * one starts. Decorative — the hero copy already says "speak, get corrected".
 */
export function TypedPhrases({
  phrases,
  className,
}: {
  phrases: Array<{ text: string; score: number }>
  className?: string
}) {
  const reduced = useReducedMotion() ?? false
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref)
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)

  const phrase = phrases[index % phrases.length]
  const done = typed >= phrase.text.length

  useEffect(() => {
    if (reduced || !inView) return
    // Type a letter; once the phrase is whole, hold it with its score, then move on.
    const wait = done ? 2200 : 55 + (typed % 3) * 18
    const timer = window.setTimeout(() => {
      if (done) {
        setIndex((value) => (value + 1) % phrases.length)
        setTyped(0)
      } else {
        setTyped((value) => value + 1)
      }
    }, wait)
    return () => window.clearTimeout(timer)
  }, [reduced, inView, done, typed, phrases.length])

  const visible = reduced ? phrase.text : phrase.text.slice(0, typed)
  const scored = reduced || done

  return (
    <span ref={ref} aria-hidden="true" className={cx('alive-typed', className)}>
      <Wave active={!scored} />
      <span lang="ru" className="alive-typed-text">
        {visible}
        {!scored && <span className="alive-caret" />}
      </span>
      <span className="alive-score" data-on={scored ? '' : undefined}>
        {phrase.score}
      </span>
    </span>
  )
}

/** A small voice waveform. Moves while `active`; rests as a flat row of bars otherwise. */
export function Wave({ active = true, bars = 5, className }: { active?: boolean; bars?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('alive-wave', active && 'alive-wave-on', className)}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  )
}

/** Slow points of light for the navy sections. Sits behind the content of a `relative` parent. */
export function Stars({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cx('alive-stars', className)}>
      <span />
      <span />
    </span>
  )
}

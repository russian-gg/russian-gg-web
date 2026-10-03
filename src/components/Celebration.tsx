import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'

const celebrationColors = ['#5b9bf5', '#ff2400', '#f4c84d', '#44944a', '#ed3cca']

/**
 * Confetti and balloons over the whole screen, styled by `.answer-celebration__*` in
 * `styles.css`. Defaults are the small burst a correct answer earns. The end-of-lesson card asks
 * for more — finishing a whole day should not look the same as getting one quiz right.
 *
 * Shared by the lesson player and the Tests block, so a right answer looks the same in both.
 */
export function Celebration({ pieces = 52, balloons = 12 }: { pieces?: number; balloons?: number }) {
  return createPortal(<span className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">{Array.from({ length: pieces }, (_, index) => {
    const style = { '--fall-x': `${3 + ((index * 37) % 94)}vw`, '--fall-drift': `${(index % 2 ? -1 : 1) * (16 + (index % 5) * 8)}px`, '--fall-rotate': `${360 + index * 29}deg`, '--fall-delay': `${(index % 12) * 45}ms`, '--fall-duration': `${1900 + (index % 7) * 130}ms`, '--fall-color': celebrationColors[index % celebrationColors.length] } as CSSProperties
    return <span key={index} className={cx('answer-celebration__piece', index % 3 === 0 ? 'answer-celebration__ball' : 'answer-celebration__ribbon')} style={style} />
  })}{Array.from({ length: balloons }, (_, index) => <span key={`balloon-${index}`} className="answer-celebration__balloon" style={{ '--balloon-x': `${5 + ((index * 41) % 90)}vw`, '--balloon-delay': `${index * 90}ms`, '--fall-color': celebrationColors[index % celebrationColors.length] } as CSSProperties} />)}</span>, document.body)
}

import { useEffect, useState, type RefObject } from 'react'
import { ChevronUp } from 'lucide-react'
import { cx } from '../../lib/cx'
import { useT } from '../../lib/i18n'
import './map.css'

/**
 * A hint on the right edge of a map box: the map opens at the start of the trail, at the
 * bottom, and the way on is up. It is information only — not a control — so it is hidden from
 * assistive technology and never in the way of a click.
 *
 * It is there whenever the map is at its start: after the map's opening, while the learner has
 * not scrolled yet, and again whenever they come back down to the start. As soon as they scroll
 * up a little it slides away. Its arrows climb while it waits.
 */
export function ScrollToTop({ scroller, delay = 0 }: { scroller: RefObject<HTMLDivElement | null>; delay?: number }) {
  const t = useT()
  const [state, setState] = useState<'waiting' | 'shown' | 'gone'>('waiting')

  useEffect(() => {
    const box = scroller.current
    if (!box) return
    /*
     * The start is where the map opened, measured from its bottom edge (the trail starts at
     * the bottom), so it stays the same place when the box changes size.
     */
    let startGap: number | null = null
    const gap = () => box.scrollHeight - box.clientHeight - box.scrollTop
    const update = () => {
      if (startGap === null) return
      const atStart = gap() <= startGap + 60
      const roomAbove = box.scrollTop > 40
      // Never played out before it has been seen: from waiting it stays out of the page.
      setState((now) => (atStart && roomAbove ? 'shown' : now === 'waiting' ? 'waiting' : 'gone'))
    }
    const timer = window.setTimeout(() => {
      startGap = gap()
      update()
    }, delay * 1000 + 300)
    box.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(box)
    return () => {
      window.clearTimeout(timer)
      box.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [scroller, delay])

  if (state === 'waiting') return null
  return (
    <div
      aria-hidden="true"
      className={cx(
        'map-hint pointer-events-none absolute top-1/2 right-3 z-[4400] sm:right-5',
        state === 'gone' && 'map-hint-gone',
      )}
    >
      <div className="map-hint-card flex items-center gap-3 rounded-[20px] border border-white/70 bg-white/80 py-2 pr-4 pl-2 shadow-[0_12px_32px_-8px_rgb(40_30_90/0.35),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-md">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(160deg,#5b9cf0,#2f6fd6)] text-white shadow-[0_4px_0_#1c4fa3,0_8px_16px_rgb(47_111_214/0.4)]">
          <span className="map-hint-ring absolute inset-0 rounded-full border-2 border-[#5b9cf0]" />
          <span className="flex flex-col items-center">
            <ChevronUp strokeWidth={3.2} className="map-hint-arrow -mb-2.5 size-5" />
            <ChevronUp strokeWidth={3.2} className="map-hint-arrow map-hint-arrow-2 size-5" />
          </span>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-black whitespace-nowrap text-ink">{t.common.scrollUpTitle}</span>
          <span className="text-xs font-bold whitespace-nowrap text-ink-muted">{t.common.scrollUpBody}</span>
        </span>
      </div>
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import aIslands from '../../assets/images/sky/a-islands.webp'
import aSky from '../../assets/images/sky/a-sky.webp'
import cIslands from '../../assets/images/sky/c-islands.webp'
import cSky from '../../assets/images/sky/c-sky.webp'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { CloudCurtain } from '../map/CloudCurtain'
import { ScrollToTop } from '../map/ScrollToTop'
import { useDragScroll } from '../map/drag-scroll'
import { CoinFace } from '../map/Coin'
import { coinHeight, type CoinBadge, type CoinTone } from '../map/coin-geometry'
import { INTRO_SECONDS, useMapIntro } from '../map/map-intro'
import { SKY_ISLANDS } from './sky-islands'
import { SkyClouds, SkyWeather } from './sky-life'
import './sky.css'

/** One day on the map, as the page has worked it out. */
export type SkyDay = {
  day: number
  title: string
  tone: CoinTone
  badge: CoinBadge
  /** Said in the button's name: done, today, needs Pro… */
  status: string
}

type Picture = 'a' | 'c'
const ART: Record<Picture, { sky: string; islands: string }> = {
  a: { sky: aSky, islands: aIslands },
  c: { sky: cSky, islands: cIslands },
}

/*
 * The trail climbs through two pictures of floating islands, each also used mirrored, stacked in
 * a fixed shuffled order — four looks, so the way up never repeats in a pattern. Both pictures
 * enter and leave at the middle and share the same cloud band at their top and bottom edges, so
 * any one joins any other. Six days to a picture; one more picture below day 1 and one above the
 * last day, so the trail runs off both ends.
 */
const DAYS_PER_PICTURE = 6
const SEQUENCE: ReadonlyArray<readonly [Picture, boolean]> = [
  ['a', false], ['c', true], ['a', true], ['c', false], ['a', false], ['a', true], ['c', false], ['c', true],
  ['a', true], ['c', false], ['a', false], ['c', true], ['a', true], ['c', false], ['a', false],
]
const BELOW: readonly [Picture, boolean] = ['c', false]
const ABOVE: readonly [Picture, boolean] = ['a', true]
const BOTTOM_PAD = 48
const FLOAT_SECONDS = 7
const LANDING_START = 1.0
const LANDING_STEP = 0.09

/** The outermost stone circles, mirrored or not: on a phone the picture is cropped to them. */
const ALL_SLOTS = [...SKY_ISLANDS.a.slots, ...SKY_ISLANDS.c.slots]
const LEFT = Math.min(...ALL_SLOTS.map(([x]) => Math.min(x, 1 - x)))
const RIGHT = Math.max(...ALL_SLOTS.map(([x]) => Math.max(x, 1 - x)))

type Tile = { picture: Picture; mirrored: boolean; top: number; height: number }
type Layout = {
  width: number
  height: number
  roomy: boolean
  tileWidth: number
  offset: number
  tiles: Tile[]
  points: Array<{ x: number; y: number; coin: number; ground: number; tile: number; island: number }>
}

function layoutFor(width: number, count: number): Layout {
  const roomy = width >= 640
  const tileWidth = roomy ? width : (width - 40) / (RIGHT - LEFT)
  const offset = roomy ? 0 : width / 2 - (tileWidth * (LEFT + RIGHT)) / 2
  const heightOf = (p: Picture) => (tileWidth * SKY_ISLANDS[p].height) / SKY_ISLANDS[p].width
  const used = Array.from({ length: Math.max(1, Math.ceil(count / DAYS_PER_PICTURE)) }, (_, i) => SEQUENCE[i % SEQUENCE.length])
  const trail = used.reduce((sum, [p]) => sum + heightOf(p), 0)
  const height = Math.round(trail + BOTTOM_PAD)
  const base = height - BOTTOM_PAD
  const tiles: Tile[] = [{ picture: BELOW[0], mirrored: BELOW[1], top: base, height: heightOf(BELOW[0]) }]
  let top = base
  for (const [picture, mirrored] of used) {
    top -= heightOf(picture)
    tiles.push({ picture, mirrored, top, height: heightOf(picture) })
  }
  tiles.push({ picture: ABOVE[0], mirrored: ABOVE[1], top: top - heightOf(ABOVE[0]), height: heightOf(ABOVE[0]) })
  const [lo, hi] = roomy ? [50, 58] : [30, 34]
  const points = Array.from({ length: count }, (_, i) => {
    const tile = Math.floor(i / DAYS_PER_PICTURE) + 1
    const { picture, mirrored, top: tileTop, height: h } = tiles[tile]
    const [sx, sy, cw, island] = SKY_ISLANDS[picture].slots[i % DAYS_PER_PICTURE]
    const fx = mirrored ? 1 - sx : sx
    return {
      x: offset + fx * tileWidth,
      y: tileTop + sy * h,
      coin: Math.round(Math.min(hi, Math.max(lo, 0.5 * cw * tileWidth))),
      ground: cw * tileWidth,
      tile,
      island,
    }
  })
  return { width, height, roomy, tileWidth, offset, tiles, points }
}

/*
 * How an island floats. The rise and fall rolls through the map as one long, slow swell, so
 * islands joined by a bridge move almost together and the bridge holds, while islands far
 * apart are at different points of it. It is strongest in the middle of a picture and fades to
 * nothing at its top and bottom edge, where the trail crosses into the next picture on islands
 * that stay still.
 */
function islandMotion(layout: Layout, tile: Tile, index: number, roomy: boolean) {
  const art = SKY_ISLANDS[tile.picture]
  const island = art.islands[index - 1]
  const scale = layout.tileWidth / art.width
  const [cx, cy] = island.centre
  const mx = layout.offset + (tile.mirrored ? art.width - cx : cx) * scale
  const my = tile.top + cy * scale
  const phase = (my / layout.tileWidth / 6 + mx / layout.tileWidth / 5) % 1
  const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, cy / art.height))) ** 0.7
  return {
    animationDelay: `-${(phase * FLOAT_SECONDS).toFixed(2)}s`,
    '--f': `-${((roomy ? 7.5 : 4.5) * taper).toFixed(1)}px`,
  } as CSSProperties
}

/**
 * The 90 days as a trail over floating sky islands, from day 1 at the bottom up.
 *
 * The map is its own rounded box that fills the screen under the heading and scrolls inside,
 * with no visible scrollbar; it opens with today in view. Each day is a coin standing on its
 * island's stone circle: green once done, blue and a little larger for today, lilac with a
 * crown for the days Pro opens, grey with a lock for those not ready yet. On a phone only today
 * and the open day carry their title — the trail is too dense for all of them; every title is in
 * the day's button and its card.
 *
 * The islands are cut out of the picture and float on their own beats, each day's coin with its
 * island. Gulls, cumulus, petals and gusts move around them (see `sky-life`), and the map
 * opens out of a cloud curtain. All of it is decoration.
 *
 * The coins are one roving-tabindex group in trail order: up and right go on, down and left go
 * back, Home and End jump to the ends.
 */
export function DaySkyMap({
  days,
  currentDay,
  openDay,
  onOpen,
}: {
  days: SkyDay[]
  currentDay: number | undefined
  openDay: number | null
  onOpen: (day: number) => void
}) {
  const t = useT()
  const copy = t.path.sky
  const frame = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useDragScroll(scroller)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const placed = useRef(false)
  const [width, setWidth] = useState(0)
  const [boxHeight, setBoxHeight] = useState(0)
  const [underPanel, setUnderPanel] = useState(0)
  const [focusDay, setFocusDay] = useState<number | null>(null)
  const intro = useMapIntro()
  const [curtain, setCurtain] = useState(intro)

  // The box fills the screen from where it starts down to the bottom edge (above the tab bar).
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => {
      setWidth(el.clientWidth)
      const phone = window.innerWidth < 768
      const top = el.getBoundingClientRect().top + window.scrollY
      setBoxHeight(Math.max(360, Math.round(window.innerHeight - top - (phone ? 84 : 24))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    if (!curtain) return
    const gone = window.setTimeout(() => setCurtain(false), 2400)
    return () => window.clearTimeout(gone)
  }, [curtain])

  const layout = width > 0 ? layoutFor(width, days.length) : null
  const tabbable = (focusDay && days.some((d) => d.day === focusDay) ? focusDay : null) ?? currentDay ?? days[0]?.day

  const ready = layout !== null && boxHeight > 0
  useLayoutEffect(() => {
    if (!ready || placed.current || !layout || !scroller.current) return
    placed.current = true
    const index = Math.max(0, days.findIndex((d) => d.day === currentDay))
    // The map opens at its start, the bottom of the trail. Only when the learner is further up
    // than that view reaches does it open higher, with where they are in the upper part.
    const box = scroller.current
    const y = layout.points[index].y
    const place = () => {
      const bottom = Math.max(0, box.scrollHeight - box.clientHeight)
      box.scrollTop = y - 110 >= bottom ? bottom : Math.max(0, Math.min(bottom, y - box.clientHeight * 0.62))
    }
    place()
    // The box settles its height over the page's entrance, and changes with the window: keep it
    // at the start through all of that, until the learner scrolls it themselves.
    const follow = new ResizeObserver(place)
    follow.observe(box)
    const stop = () => follow.disconnect()
    box.addEventListener('wheel', stop, { once: true, passive: true })
    box.addEventListener('touchstart', stop, { once: true, passive: true })
    box.addEventListener('keydown', stop, { once: true })
    // A tap on a coin opens its card, which moves the map itself: that is the learner's too.
    box.addEventListener('pointerdown', stop, { once: true, passive: true })
  }, [ready, layout, days, currentDay, boxHeight])

  /*
   * The day's card rises over the bottom of the box. While it is open the trail gets that much
   * room at its foot, and the open day moves up just enough to stay in view above the card.
   */
  const panelTop = () => {
    const sheet = document.getElementById('lesson-details')
    const holder = sheet?.offsetParent
    if (!sheet || !holder) return null
    return holder.getBoundingClientRect().top + sheet.offsetTop
  }
  useEffect(() => {
    if (openDay === null) {
      setUnderPanel(0)
      return
    }
    // The card's code loads the first time it is used: wait (up to a few seconds) for it to be there.
    let raf = 0
    let tries = 0
    const measure = () => {
      const top = panelTop()
      const box = scroller.current
      if ((top === null || !box) && tries++ < 240) {
        raf = requestAnimationFrame(measure)
        return
      }
      if (top === null || !box) return
      // The map's view ends just under the card's rounded top edge, so no gap shows between them.
      setUnderPanel(Math.max(0, Math.round(box.getBoundingClientRect().bottom - top - 20)))
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [openDay])
  useEffect(() => {
    if (openDay === null) return
    // After the map has finished shrinking (its height eases over 300ms), so the scroll is not cut short.
    const timer = window.setTimeout(() => {
      const top = panelTop()
      const box = scroller.current
      const node = buttons.current[days.findIndex((d) => d.day === openDay)]
      if (top === null || !box || !node) return
      const overlap = node.getBoundingClientRect().bottom + 16 - top
      if (overlap > 0) box.scrollBy({ top: overlap, behavior: 'smooth' })
    }, 340)
    return () => window.clearTimeout(timer)
  }, [openDay, underPanel, days])

  const move = (event: KeyboardEvent<HTMLOListElement>) => {
    const index = days.findIndex((d) => d.day === tabbable)
    if (index < 0) return
    const next =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? index + 1
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? days.length - 1
              : undefined
    if (next === undefined) return
    event.preventDefault()
    if (next < 0 || next >= days.length) return
    buttons.current[next]?.focus()
  }

  return (
    <div
      ref={frame}
      className="relative isolate overflow-hidden rounded-[28px] bg-[linear-gradient(#c9c3f0,#e9c9e6)] shadow-[0_18px_40px_rgb(80_60_140/0.25)]"
      style={{ height: boxHeight || undefined }}
    >
      <div ref={scroller} className="map-scroll overflow-y-auto motion-safe:transition-[height] motion-safe:duration-300"
        style={{ height: underPanel ? `calc(100% - ${underPanel}px)` : '100%' }}
      >
        {layout && (
          <div className="relative isolate overflow-hidden" style={{ height: layout.height }}>
            <div aria-hidden="true" className={cx('pointer-events-none absolute inset-0', intro && 'ground-in')}>
              {layout.tiles.map((tile, n) => {
                const art = SKY_ISLANDS[tile.picture]
                const scale = layout.tileWidth / art.width
                const [aw, ah] = art.atlas
                return (
                  <div
                    key={n}
                    className="sky-tile absolute"
                    style={{
                      left: layout.offset,
                      top: tile.top,
                      width: layout.tileWidth,
                      height: tile.height + 1,
                      transform: tile.mirrored ? 'scaleX(-1)' : undefined,
                    }}
                  >
                    <div
                      className="absolute inset-0 bg-no-repeat"
                      style={{ backgroundImage: `url(${ART[tile.picture].sky})`, backgroundSize: '100% 100%' }}
                    />
                    {art.islands.map((island, k) => {
                      const [x0, y0, x1, y1] = island.box
                      return (
                        <div
                          key={k}
                          className={cx('island', !island.floats && 'island-still')}
                          style={{
                            left: x0 * scale,
                            top: y0 * scale,
                            width: (x1 - x0) * scale,
                            height: (y1 - y0) * scale,
                            backgroundImage: `url(${ART[tile.picture].islands})`,
                            backgroundSize: `${aw * scale}px ${ah * scale}px`,
                            backgroundPosition: `-${island.at[0] * scale}px -${island.at[1] * scale}px`,
                            ...(island.floats ? islandMotion(layout, tile, k + 1, layout.roomy) : {}),
                          }}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <SkyClouds width={layout.width} mapHeight={layout.height} roomy={layout.roomy} />

            <ol onKeyDown={move} className="contents" aria-label={copy.mapLabel}>
              {days.map((d, index) => {
                const point = layout.points[index]
                const tile = layout.tiles[point.tile]
                const island = point.island ? SKY_ISLANDS[tile.picture].islands[point.island - 1] : null
                const labelWidth = layout.roomy ? 168 : 112
                const shift = Math.min(layout.width - 4 - labelWidth / 2, Math.max(4 + labelWidth / 2, point.x)) - point.x
                const open = d.day === openDay
                const current = d.tone === 'current'
                return (
                  <li
                    key={d.day}
                    className={cx('absolute -translate-x-1/2', intro && 'coin-pop', d.tone === 'locked' && d.badge === 'locked' && 'opacity-80')}
                    style={{
                      left: point.x,
                      top: point.y - coinHeight(point.coin, d.tone),
                      width: labelWidth,
                      zIndex: current || open ? 100000 : Math.round(point.y),
                      animationDelay: intro ? `${LANDING_START + Math.min(index, 16) * LANDING_STEP}s` : undefined,
                    }}
                  >
                    <button
                      ref={(el) => {
                        buttons.current[index] = el
                      }}
                      type="button"
                      tabIndex={d.day === tabbable ? 0 : -1}
                      aria-expanded={open}
                      aria-label={fill(copy.dayLabel, { day: d.day, title: d.title, status: d.status })}
                      onFocus={() => setFocusDay(d.day)}
                      onClick={() => onOpen(d.day)}
                      data-ui-sound="select"
                      className="group relative block w-full focus-visible:outline-none"
                    >
                      <span
                        className={cx('relative flex w-full flex-col items-center', island?.floats && 'island-sync')}
                        style={island?.floats ? islandMotion(layout, tile, point.island, layout.roomy) : undefined}
                      >
                        <CoinFace
                          number={d.day}
                          tone={d.tone}
                          badge={d.badge}
                          palette="days"
                          size={point.coin}
                          ground={point.ground}
                          roomy={layout.roomy}
                          title={d.title}
                          showTitle={layout.roomy || current || open}
                          titleShift={shift}
                          active={open}
                          startLabel={copy.start}
                          afterIntro={intro ? INTRO_SECONDS : 0}
                          groundShadow="rgb(60 40 90 / 0.32)"
                          titleShadow="0 3px 0 rgb(70 60 120 / 0.22), 0 6px 12px rgb(60 50 110 / 0.18)"
                        />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[4000] h-14 bg-gradient-to-b from-[rgb(70_50_130/0.22)] to-transparent"
      />
      {layout && <SkyWeather width={layout.width} height={boxHeight} roomy={layout.roomy} />}
      <ScrollToTop scroller={scroller} delay={intro ? INTRO_SECONDS : 0} />
      {curtain && layout && <CloudCurtain roomy={layout.roomy} />}
    </div>
  )
}

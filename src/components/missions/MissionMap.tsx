import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import roadArt from '../../assets/images/mission-road.webp'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { CloudCurtain } from '../map/CloudCurtain'
import { ScrollToTop } from '../map/ScrollToTop'
import { useDragScroll } from '../map/drag-scroll'
import { discFace, discThickness, type DiscTone } from './disc-geometry'
import { MissionDisc, type DiscBadge } from './MissionDisc'
import { INTRO_SECONDS, useMapIntro } from '../map/map-intro'
import { missionStatusLabel, type MissionRow } from './mission-row'
import { CloudShadows, RoadLife } from './road-life'

/*
 * The road is one illustrated tile (`mission-road.webp`) repeated upwards, one copy per
 * `SLOTS.length` missions. Every tile has the same empty round clearings beside the road, and a
 * mission sits on each of them. The slots are the clearings' centres, as fractions of the tile,
 * listed in road order from the bottom of the tile up — so mission 1 is at the bottom of the
 * map and the road climbs from there.
 *
 * The positions were measured from the picture itself; if the tile is redrawn, measure again.
 */
const SLOTS: ReadonlyArray<readonly [x: number, y: number]> = [
  [0.684, 0.915],
  [0.379, 0.92],
  [0.226, 0.62],
  [0.716, 0.668],
  [0.829, 0.308],
  [0.317, 0.257],
  [0.571, 0.136],
]
const TILE = { width: 1672, height: 851 } as const

/*
 * On a phone the whole tile would be too small to tap, so it is enlarged and cropped at the
 * sides instead: just enough that the outermost clearings, plus `PHONE_MARGIN` on each side,
 * fill the width. The picture's edges are only scenery.
 */
const CLEARINGS = {
  left: Math.min(...SLOTS.map(([x]) => x)),
  right: Math.max(...SLOTS.map(([x]) => x)),
}
const PHONE_MARGIN = 32
/** Room under the last row for the bottom missions' titles. */
const BOTTOM_PAD = 48
/** The coins land one after another when the map opens; ones far up the road land with the last. */
const LANDING_START = 1.0
const LANDING_STEP = 0.09

type Layout = {
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  tileTop: number
  /** Top of the copy of the picture holding missions 1–7. */
  firstTileTop: number
  offset: number
  /** The disc's width; its height follows from the angle it lies at. */
  disc: number
  roomy: boolean
  x: (index: number) => number
  y: (index: number) => number
}

function layoutFor(width: number, count: number): Layout {
  const roomy = width >= 640
  const span = CLEARINGS.right - CLEARINGS.left
  const tileWidth = roomy ? width : Math.max(width, (width - PHONE_MARGIN * 2) / span)
  const tileHeight = (tileWidth * TILE.height) / TILE.width
  // Centred on the clearings, not on the picture.
  const offset = roomy ? 0 : width / 2 - tileWidth * ((CLEARINGS.left + CLEARINGS.right) / 2)
  const tiles = Math.max(1, Math.ceil(count / SLOTS.length))
  const height = tiles * tileHeight + BOTTOM_PAD
  const disc = roomy ? Math.round(Math.min(96, tileWidth * 0.07)) : 54
  // The tile holding mission `index`, counted from the bottom.
  const tileOf = (index: number) => Math.floor(index / SLOTS.length)
  const slotTop = (index: number) => height - BOTTOM_PAD - (tileOf(index) + 1) * tileHeight

  return {
    width,
    height,
    tileWidth,
    tileHeight,
    tileTop: height - BOTTOM_PAD - tiles * tileHeight,
    firstTileTop: height - BOTTOM_PAD - tileHeight,
    offset,
    disc,
    roomy,
    x: (index) => offset + SLOTS[index % SLOTS.length][0] * tileWidth,
    y: (index) => slotTop(index) + SLOTS[index % SLOTS.length][1] * tileHeight,
  }
}

function toneOf(row: MissionRow, current: boolean): DiscTone {
  if (row.locked) return 'locked'
  if (row.status === 'done') return 'done'
  return current ? 'current' : 'open'
}

function badgeOf(row: MissionRow): DiscBadge {
  if (row.locked) return row.isProLock ? 'pro' : 'locked'
  if (row.status === 'done') return 'done'
  return row.status === 'inProgress' ? 'tried' : null
}

/**
 * On a phone the road is tight: a title that would cover another mission's disc or title is
 * left off (the mission's name is still in its button and in the panel). The next mission and
 * the open one always keep theirs; the others keep theirs in road order.
 */
function hiddenTitles(layout: Layout, rows: MissionRow[], currentId: string | undefined, openId: string | null) {
  const hidden = new Set<number>()
  if (layout.roomy) return hidden
  const labelWidth = 112
  const face = discFace(layout.disc)
  const depth = discThickness(layout.disc)
  const boxes = rows.map((row, index) => {
    const current = row.mission.id === currentId
    const x = layout.x(index)
    const top = layout.y(index) - face / 2
    const bottom = top + face + depth
    const textWidth = Math.min(labelWidth, row.title.length * 11 * 0.56 + 16)
    const shift = Math.min(layout.width - 4 - labelWidth / 2, Math.max(4 + labelWidth / 2, x)) - x
    const labelTop = bottom + 6
    return {
      disc: [x - layout.disc / 2, top - (current ? 22 : 0), x + layout.disc / 2, bottom] as const,
      label: [x + shift - textWidth / 2, labelTop, x + shift + textWidth / 2, labelTop + 18] as const,
      keep: current || row.mission.id === openId,
    }
  })
  const hits = (a: readonly number[], b: readonly number[]) =>
    a[0] < b[2] + 2 && b[0] < a[2] + 2 && a[1] < b[3] + 2 && b[1] < a[3] + 2
  const order = boxes.map((_, i) => i).sort((a, b) => Number(boxes[b].keep) - Number(boxes[a].keep) || a - b)
  const kept: Array<readonly number[]> = []
  for (const i of order) {
    const box = boxes[i]
    const blocked = boxes.some((other, j) => j !== i && hits(box.label, other.disc)) || kept.some((k) => hits(box.label, k))
    if (blocked && !box.keep) hidden.add(i)
    else kept.push(box.label)
  }
  return hidden
}

/**
 * Every mission on one road through town, from the bottom of the map up.
 *
 * The map is its own rounded box that fills the screen under the heading and scrolls inside,
 * with no visible scrollbar. It opens with the mission that is up next in view. Each mission is
 * a numbered disc laid down in one of the picture's clearings, with its title under it: green
 * once finished, blue with a «Start» tag for the next one, white while open, lilac with a crown
 * or a lock while shut.
 *
 * Every time the road opens it comes out of the clouds and the coins land one by one
 * (see `CloudCurtain`); cars drive the road, butterflies cross the clearings and cloud shadows
 * slide over the land (see `road-life`). All of that is decoration, under the coins.
 *
 * Choosing a mission opens its panel (see `MissionDetailsSheet`); the map only reports which
 * one, and keeps the chosen disc in view above the panel.
 *
 * The coins are one roving-tabindex group in road order: Tab enters at the mission that is up
 * next; up and right go on along the road, down and left go back, Home and End jump to its ends.
 */
export function MissionMap({
  rows,
  openId,
  currentId,
  onOpen,
  panelRef,
}: {
  rows: MissionRow[]
  /** The mission whose details are open, if any. */
  openId: string | null
  currentId: string | undefined
  /** Called with the node that was chosen, so the caller can give focus back to it. */
  onOpen: (id: string, node: HTMLElement) => void
  /** The details panel, so the chosen coin can be kept above it. */
  panelRef: RefObject<HTMLElement | null>
}) {
  const t = useT()
  const copy = t.practice
  const frame = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useDragScroll(scroller)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const placed = useRef(false)
  const [width, setWidth] = useState(0)
  const [boxHeight, setBoxHeight] = useState(0)
  const [underPanel, setUnderPanel] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const intro = useMapIntro()
  const [curtain, setCurtain] = useState(intro)

  /*
   * The box fills the screen from where it starts down to the bottom edge — above the tab bar
   * on a phone — so the page itself does not have to scroll to show the road.
   */
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

  // The curtain has parted: take it out of the page.
  useEffect(() => {
    if (!curtain) return
    const gone = window.setTimeout(() => setCurtain(false), 2400)
    return () => window.clearTimeout(gone)
  }, [curtain])

  const layout = width > 0 ? layoutFor(width, rows.length) : null
  const tabbableId =
    (focusId && rows.some((row) => row.mission.id === focusId) ? focusId : null) ?? currentId ?? rows[0]?.mission.id
  const hidden = layout ? hiddenTitles(layout, rows, currentId, openId) : new Set<number>()

  const ready = layout !== null && boxHeight > 0
  useLayoutEffect(() => {
    if (!ready || placed.current || !layout || !scroller.current) return
    placed.current = true
    const index = Math.max(0, rows.findIndex((row) => row.mission.id === currentId))
    // The map opens at its start, the bottom of the trail. Only when the learner is further up
    // than that view reaches does it open higher, with where they are in the upper part.
    const box = scroller.current
    const y = layout.y(index)
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
  }, [ready, layout, rows, currentId, boxHeight])

  /*
   * The panel rises over the bottom of the box. While it is open the road gets that much room
   * at its foot, and the chosen coin moves up just enough to stay in view above it.
   */
  // Where the panel's top edge comes to rest (it is still rising when this runs).
  const panelTop = () => {
    const sheet = panelRef.current
    const holder = sheet?.offsetParent
    if (!sheet || !holder) return null
    return holder.getBoundingClientRect().top + sheet.offsetTop
  }
  useEffect(() => {
    if (!openId) {
      setUnderPanel(0)
      return
    }
    const raf = requestAnimationFrame(() => {
      const top = panelTop()
      const box = scroller.current
      if (top === null || !box) return
      // The map's view ends just under the card's rounded top edge, so no gap shows between them.
      setUnderPanel(Math.max(0, Math.round(box.getBoundingClientRect().bottom - top - 20)))
    })
    return () => cancelAnimationFrame(raf)
    // `panelTop` only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])
  // Once the road has its room at the foot, lift the chosen coin above the panel.
  useEffect(() => {
    if (!openId) return
    // After the map has finished shrinking (its height eases over 300ms), so the scroll is not cut short.
    const timer = window.setTimeout(() => {
      const top = panelTop()
      const box = scroller.current
      const node = buttons.current[rows.findIndex((row) => row.mission.id === openId)]
      if (top === null || !box || !node) return
      const overlap = node.getBoundingClientRect().bottom + 16 - top
      if (overlap > 0) box.scrollBy({ top: overlap, behavior: 'smooth' })
    }, 340)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, underPanel, rows])

  const move = (event: KeyboardEvent<HTMLOListElement>) => {
    const index = rows.findIndex((row) => row.mission.id === tabbableId)
    if (index < 0) return
    const next =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? index + 1
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : undefined
    if (next === undefined) return

    event.preventDefault()
    if (next < 0 || next >= rows.length) return
    buttons.current[next]?.focus()
  }

  return (
    <section aria-label={copy.mapLabel}>
      <div
        ref={frame}
        className="relative isolate overflow-hidden rounded-[28px] bg-[#9fcf6a] shadow-[0_18px_40px_rgb(40_80_30/0.25)]"
        style={{ height: boxHeight || undefined }}
      >
        <div ref={scroller} className="map-scroll overflow-y-auto motion-safe:transition-[height] motion-safe:duration-300"
        style={{ height: underPanel ? `calc(100% - ${underPanel}px)` : '100%' }}
      >
          {layout && (
            <div className="relative isolate overflow-hidden" style={{ height: layout.height }}>
              <div
                aria-hidden="true"
                className={cx('pointer-events-none absolute inset-0 bg-repeat-y select-none', intro && 'ground-in')}
                style={{
                  backgroundImage: `url(${roadArt})`,
                  backgroundSize: `${layout.tileWidth}px ${layout.tileHeight}px`,
                  backgroundPosition: `${layout.offset}px ${layout.tileTop}px`,
                }}
              />
              <RoadLife
                tileWidth={layout.tileWidth}
                tileHeight={layout.tileHeight}
                offset={layout.offset}
                tileTop={layout.firstTileTop}
                roomy={layout.roomy}
                clearings={SLOTS}
              />

              <ol onKeyDown={move} className="contents">
                {rows.map((row, index) => {
                  const x = layout.x(index)
                  const labelWidth = layout.roomy ? 172 : 112
                  // A coin near the edge stays on its clearing; only its title slides inwards.
                  const labelShift = Math.min(layout.width - 4 - labelWidth / 2, Math.max(4 + labelWidth / 2, x)) - x
                  const current = row.mission.id === currentId
                  const open = row.mission.id === openId
                  const tone = toneOf(row, current)
                  return (
                    <li
                      key={row.mission.id}
                      className={cx('absolute -translate-x-1/2', intro && 'coin-pop')}
                      style={{
                        left: x,
                        // The disc's face is centred on the clearing; its thickness hangs below.
                        top: layout.y(index) - discFace(layout.disc) / 2,
                        width: labelWidth,
                        // A coin lower on the screen is nearer the viewer and drawn over the ones
                        // behind it; the next and the open one are drawn over everything.
                        zIndex: current || open ? 100000 : Math.round(layout.y(index)),
                        animationDelay: intro ? `${LANDING_START + Math.min(index, 16) * LANDING_STEP}s` : undefined,
                      }}
                    >
                      <button
                        ref={(el) => {
                          buttons.current[index] = el
                        }}
                        type="button"
                        tabIndex={row.mission.id === tabbableId ? 0 : -1}
                        aria-expanded={open}
                        aria-controls={open ? 'mission-details' : undefined}
                        aria-label={fill(copy.nodeLabel, {
                          number: row.number,
                          title: row.title,
                          status: current ? `${missionStatusLabel(row, t)}, ${copy.current}` : missionStatusLabel(row, t),
                        })}
                        onFocus={() => setFocusId(row.mission.id)}
                        onClick={(event) => onOpen(row.mission.id, event.currentTarget)}
                        data-ui-sound="select"
                        className="group relative flex w-full flex-col items-center focus-visible:outline-none"
                      >
                        <MissionDisc
                          number={row.number}
                          tone={tone}
                          badge={badgeOf(row)}
                          size={layout.disc}
                          roomy={layout.roomy}
                          title={row.title}
                          showTitle={!hidden.has(index)}
                          titleShift={labelShift}
                          active={open}
                          startLabel={copy.coinStart}
                          afterIntro={intro ? INTRO_SECONDS : 0}
                        />
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>
        {/* A soft shade at the top edge, so the road seems to go on beyond the box. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[4000] h-14 bg-gradient-to-b from-[rgb(20_40_10/0.28)] to-transparent"
        />
        <CloudShadows />
        <ScrollToTop scroller={scroller} delay={intro ? INTRO_SECONDS : 0} />
        {curtain && layout && <CloudCurtain roomy={layout.roomy} />}
      </div>
    </section>
  )
}

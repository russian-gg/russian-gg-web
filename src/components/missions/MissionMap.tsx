import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check, Crown, Lock, Timer } from 'lucide-react'
import roadArt from '../../assets/images/mission-road.webp'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { Meter } from '../motion'
import { missionStatusLabel, type MissionRow } from './mission-row'

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

type Layout = {
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  tileTop: number
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
    offset,
    disc,
    roomy,
    x: (index) => offset + SLOTS[index % SLOTS.length][0] * tileWidth,
    y: (index) => slotTop(index) + SLOTS[index % SLOTS.length][1] * tileHeight,
  }
}

/**
 * Every mission on one road through town, from the bottom of the map up.
 *
 * The road and the town are one picture, repeated as often as there are missions for. Each
 * mission is a numbered disc lying in one of the picture's clearings, with its title under it.
 * Choosing a mission opens its panel (see `MissionDetailsSheet`); the map only reports which one.
 *
 * The road starts at the bottom, so the page brings the mission that is up next into view
 * once, when the map first appears.
 *
 * The discs are one roving-tabindex group in road order: Tab enters at the mission that is up
 * next; up and right go on along the road, down and left go back, Home and End jump to its ends.
 */
export function MissionMap({
  rows,
  openId,
  currentId,
  onOpen,
}: {
  rows: MissionRow[]
  /** The mission whose details are open, if any. */
  openId: string | null
  currentId: string | undefined
  /** Called with the node that was chosen, so the caller can keep it clear of the panel. */
  onOpen: (id: string, node: HTMLElement) => void
}) {
  const t = useT()
  const copy = t.practice
  const frame = useRef<HTMLDivElement>(null)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const broughtIntoView = useRef(false)
  const [width, setWidth] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const done = rows.filter((row) => row.status === 'done').length
  const layout = width > 0 ? layoutFor(width, rows.length) : null
  const tabbableId =
    (focusId && rows.some((row) => row.mission.id === focusId) ? focusId : null) ?? currentId ?? rows[0]?.mission.id

  // The road begins at the bottom of the map: show the learner where they are on it.
  const ready = layout !== null
  useLayoutEffect(() => {
    if (!ready || broughtIntoView.current) return
    const index = rows.findIndex((row) => row.mission.id === currentId)
    const node = buttons.current[index >= 0 ? index : 0]
    if (!node) return
    broughtIntoView.current = true
    node.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [ready, rows, currentId])

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
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-sm font-extrabold text-ink tabular-nums">
          {fill(copy.progress, { done, total: rows.length })}
        </span>
        <Meter
          value={done}
          max={rows.length}
          label={copy.mapLabel}
          className="h-2 w-40 max-w-full min-w-16 overflow-hidden rounded-full bg-ground-sunken"
          fillClassName="rounded-full bg-milestone"
        />
      </div>

      <div
        ref={frame}
        className="relative isolate mt-3 overflow-hidden rounded-[28px] bg-[#b9dc8c] shadow-[0_18px_40px_rgb(40_80_30/0.25)]"
      >
        {layout && (
          <div className="relative" style={{ height: layout.height }}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-repeat-y select-none"
              style={{
                backgroundImage: `url(${roadArt})`,
                backgroundSize: `${layout.tileWidth}px ${layout.tileHeight}px`,
                backgroundPosition: `${layout.offset}px ${layout.tileTop}px`,
              }}
            />

            <ol onKeyDown={move} className="contents">
              {rows.map((row, index) => {
                const x = layout.x(index)
                const labelWidth = layout.roomy ? 172 : 112
                // A disc near the edge stays on its clearing; only its title slides inwards.
                const labelShift = Math.min(layout.width - 4 - labelWidth / 2, Math.max(4 + labelWidth / 2, x)) - x
                return (
                  <li
                    key={row.mission.id}
                    className="absolute -translate-x-1/2"
                    style={{
                      left: x,
                      // The disc's face is centred on the clearing; its thickness hangs below.
                      top: layout.y(index) - faceHeight(layout.disc) / 2,
                      width: labelWidth,
                      // A disc lower on the screen is nearer the viewer, and is drawn over the ones behind it.
                      zIndex: Math.round(layout.y(index)),
                    }}
                  >
                    <MissionNode
                      row={row}
                      open={row.mission.id === openId}
                      current={row.mission.id === currentId}
                      size={layout.disc}
                      roomy={layout.roomy}
                      labelShift={labelShift}
                      tabbable={row.mission.id === tabbableId}
                      buttonRef={(el) => {
                        buttons.current[index] = el
                      }}
                      onFocus={() => setFocusId(row.mission.id)}
                      onOpen={(node) => onOpen(row.mission.id, node)}
                    />
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

/** The disc lies flat in the clearing, seen from above at the picture's angle. */
const faceHeight = (size: number) => Math.round(size * 0.56)
const thickness = (size: number) => Math.max(6, Math.round(size * 0.13))

/*
 * The disc's colours. The picture behind it is the same bright daylight in either theme, so
 * these are fixed rather than taken from the theme: a dark-theme surface would read as a hole
 * in the grass.
 */
const TONE = {
  done: {
    face: 'linear-gradient(#7eeab5, #22b06f)',
    side: '#138556',
    ink: '#ffffff',
    shade: '#0d6a43',
  },
  current: {
    face: 'linear-gradient(#7db3fa, #347adf)',
    side: '#1f56ad',
    ink: '#ffffff',
    shade: '#17489a',
  },
  open: {
    face: 'linear-gradient(#ffffff, #dde9fb)',
    side: '#9db8e0',
    ink: '#1f6fe0',
    shade: '#ffffff',
  },
  locked: {
    face: 'linear-gradient(#ffffff, #e2e0ec)',
    side: '#a19cb8',
    ink: '#6a6585',
    shade: '#ffffff',
  },
} as const

/**
 * One mission on the road: a thick numbered disc lying in its clearing, like a game piece set
 * on the ground, and the mission's title on a tag under it.
 *
 * The number is always the strongest thing on the disc. At most one badge sits on its edge — a
 * crown for a Pro mission, a lock for one shut by progress, a tick when finished, a clock when
 * tried — and the state is spelled out in the button's name, so it is never told by colour alone.
 * Pressing it sinks the face into the disc.
 */
function MissionNode({
  row,
  open,
  current,
  size,
  roomy,
  labelShift,
  tabbable,
  buttonRef,
  onFocus,
  onOpen,
}: {
  row: MissionRow
  open: boolean
  current: boolean
  /** The disc's width in pixels, from the layout. */
  size: number
  roomy: boolean
  /** How far the title is moved sideways to stay inside the map. */
  labelShift: number
  tabbable: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onFocus: () => void
  onOpen: (node: HTMLElement) => void
}) {
  const t = useT()
  const { number, title, status, locked, isProLock } = row
  const done = status === 'done' && !locked
  const tone = locked ? TONE.locked : done ? TONE.done : current ? TONE.current : TONE.open
  const face = faceHeight(size)
  const depth = thickness(size)
  const badge = locked
    ? isProLock
      ? { Icon: Crown, className: 'bg-coin text-coin-ink' }
      : { Icon: Lock, className: 'bg-ink-muted text-white' }
    : done
      ? { Icon: Check, className: 'bg-[#22b06f] text-white' }
      : status === 'inProgress'
        ? { Icon: Timer, className: 'bg-caution text-white' }
        : null

  const ellipse: CSSProperties = {
    position: 'absolute',
    left: 0,
    width: size,
    height: face,
    borderRadius: '50%',
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      tabIndex={tabbable ? 0 : -1}
      aria-expanded={open}
      aria-controls={open ? 'mission-details' : undefined}
      aria-label={fill(t.practice.nodeLabel, {
        number,
        title,
        status: current ? `${missionStatusLabel(row, t)}, ${t.practice.current}` : missionStatusLabel(row, t),
      })}
      onFocus={onFocus}
      onClick={(event) => onOpen(event.currentTarget)}
      data-ui-sound="select"
      className="group flex w-full flex-col items-center focus-visible:outline-none"
    >
      <span
        className={cx(
          'relative block shrink-0 rounded-[50%]',
          'motion-safe:transition-transform motion-safe:duration-150',
          'group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-signal',
          open ? '-translate-y-1' : 'group-hover:-translate-y-1',
        )}
        style={{ width: size, height: face + depth }}
      >
        {/* Its shadow on the grass. */}
        <span
          aria-hidden="true"
          className="absolute rounded-[50%] bg-[rgb(20_45_10/0.38)] blur-[3px]"
          style={{
            left: -size * 0.06,
            width: size * 1.12,
            height: face,
            top: depth + face * 0.22,
          }}
        />

        {/* The next mission calls for attention; the open one keeps a steady ring. */}
        {(current || open) && (
          <span
            aria-hidden="true"
            className={cx(
              'absolute rounded-[50%] border-4',
              open ? 'border-white' : 'border-white/90 motion-safe:animate-ping',
            )}
            style={{
              left: -8,
              top: -8 + depth / 2,
              width: size + 16,
              height: face + 16,
            }}
          />
        )}

        {/* The disc's edge: a band and the lower rim, together its thickness. */}
        <span aria-hidden="true" style={{ ...ellipse, top: depth, background: tone.side }} />
        <span
          aria-hidden="true"
          className="absolute left-0"
          style={{
            top: face / 2,
            width: size,
            height: depth,
            background: tone.side,
          }}
        />

        {/* The face, with the number on it. */}
        <span
          className={cx(
            'flex items-center justify-center border-[3px] border-white font-black tabular-nums',
            'motion-safe:transition-transform motion-safe:duration-100',
            'group-active:translate-y-[var(--sink)]',
          )}
          style={
            {
              ...ellipse,
              top: 0,
              background: tone.face,
              color: tone.ink,
              fontSize: Math.round(face * 0.62),
              lineHeight: 1,
              // Digits sit high in their line box; this centres them on the face by eye.
              paddingTop: Math.round(face * 0.06),
              boxShadow: 'inset 0 3px 0 rgb(255 255 255 / 0.55), inset 0 -4px 0 rgb(0 0 0 / 0.08)',
              textShadow: tone.ink === '#ffffff' ? `0 2px 0 ${tone.shade}` : undefined,
              '--sink': `${Math.round(depth * 0.6)}px`,
            } as CSSProperties
          }
        >
          {number}
        </span>

        {badge && (
          <span
            aria-hidden="true"
            className={cx(
              'absolute flex items-center justify-center rounded-full border-2 border-white shadow-[0_2px_0_rgb(0_0_0/0.18)]',
              roomy ? 'size-7' : 'size-6',
              badge.className,
            )}
            style={{ right: roomy ? -6 : -10, top: face - (roomy ? 20 : 15) }}
          >
            <badge.Icon strokeWidth={2.6} className={roomy ? 'size-3.5' : 'size-3'} />
          </span>
        )}
      </span>

      <span
        className={cx(
          'mt-1.5 max-w-full rounded-full px-2.5 py-0.5 text-center leading-snug font-extrabold',
          'shadow-[0_3px_0_rgb(60_90_30/0.25),0_6px_12px_rgb(30_60_20/0.2)]',
          // A phone has room for one line between the clearings; the full title is in the panel.
          roomy ? 'line-clamp-2 text-[13px] wrap-break-word' : 'truncate px-2 text-[11px]',
          open || current
            ? 'bg-[#347adf] text-white'
            : locked
              ? 'bg-white/92 text-[#6a6585]'
              : 'bg-white text-[#16181d] group-hover:text-[#1f6fe0]',
        )}
        style={labelShift ? { transform: `translateX(${labelShift}px)` } : undefined}
      >
        {title}
      </span>
    </button>
  )
}

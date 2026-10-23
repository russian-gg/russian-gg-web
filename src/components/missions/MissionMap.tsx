import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check, Lock, Timer } from 'lucide-react'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { Meter } from '../motion'
import { missionStatusLabel, type MissionRow } from './mission-row'
import { zoneOf, ZONE_ICON, type MissionZone } from './zones'

/*
 * The road's geometry, in pixels, in two sizes: roomy from a tablet up, compact on a phone.
 * Columns are as many as the width allows at `minStep` apart, up to `maxCols` — past that a
 * wider screen spreads the same row out rather than packing more in — and the road folds back
 * and forth row by row, so the whole of it is on screen at once. `pad` keeps an edge node's title
 * and the bend of the road inside the content area: the bend bows out by at most three
 * quarters of `pad * BEND`, which stays inside `pad` and clears an edge node's title.
 *
 * `top` is the room above the first row for its zone label.
 */
const ROOMY = { node: 80, row: 216, minStep: 184, maxCols: 6, wave: 22, pad: 120, label: 168, top: 96, roomy: true }
const COMPACT = { node: 56, row: 156, minStep: 104, maxCols: 3, wave: 10, pad: 60, label: 104, top: 60, roomy: false }
const BEND = 1.25

type Layout = {
  cols: number
  node: number
  pad: number
  roomy: boolean
  labelWidth: number
  width: number
  height: number
  rowOf: (index: number) => number
  colOf: (index: number) => number
  x: (index: number) => number
  y: (index: number) => number
}

function layoutFor(width: number, count: number): Layout {
  const size = width >= 640 ? ROOMY : COMPACT
  // At least three across even on the narrowest phone, so the road still winds.
  const fit = Math.floor((width - size.pad * 2) / size.minStep) + 1
  const cols = Math.max(1, Math.min(count, size.maxCols, Math.max(3, fit)))
  const step = cols > 1 ? (width - size.pad * 2) / (cols - 1) : 0
  const rows = Math.ceil(count / cols)
  const rowOf = (index: number) => Math.floor(index / cols)
  // Odd rows run right to left: the road turns at the edge instead of jumping back.
  const colOf = (index: number) => {
    const c = index % cols
    return rowOf(index) % 2 === 0 ? c : cols - 1 - c
  }
  const x = (index: number) => (cols > 1 ? size.pad + colOf(index) * step : width / 2)
  const y = (index: number) =>
    size.top + size.node / 2 + rowOf(index) * size.row + size.wave * Math.sin(colOf(index) * 1.1)

  return {
    cols,
    node: size.node,
    pad: size.pad,
    roomy: size.roomy,
    labelWidth: cols > 1 ? Math.min(size.label, step - 8) : size.label,
    width,
    height: size.top + (rows - 1) * size.row + size.node + size.wave + 64,
    rowOf,
    colOf,
    x,
    y,
  }
}

/** The road between two missions: level along a row, bowing out past the edge at a turn. */
function segmentPath(layout: Layout, i: number) {
  const x0 = layout.x(i)
  const y0 = layout.y(i)
  const x1 = layout.x(i + 1)
  const y1 = layout.y(i + 1)
  if (layout.rowOf(i) !== layout.rowOf(i + 1)) {
    const outward = (x0 > layout.width / 2 ? 1 : -1) * layout.pad * BEND
    return `M ${x0} ${y0} C ${x0 + outward} ${y0}, ${x1 + outward} ${y1}, ${x1} ${y1}`
  }
  return `M ${x0} ${y0} C ${(x0 + x1) / 2} ${y0}, ${(x0 + x1) / 2} ${y1}, ${x1} ${y1}`
}

/**
 * Every mission on one road, in the usual order, folded to fit the width it is given — the
 * whole road is visible, nothing scrolls sideways, and a phone simply gets more, narrower rows.
 *
 * The road runs through town: the page puts the town illustration behind it (see `TownBackdrop`), and
 * each mission belongs to a part of town (see `zones.ts`) whose name is written above the
 * first mission there. The picture is decoration only — `aria-hidden`, under the road — so
 * every title and the road itself sit on something solid enough to read against it.
 *
 * Nothing starts selected. Choosing a mission opens its panel (see `MissionDetailsSheet`); the
 * map only reports which one.
 *
 * The nodes are one roving-tabindex group: Tab enters at the mission that is up next, and the
 * arrow keys move the way they look — left and right along a row, up and down between rows.
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
  const zones = rows.map((row) => zoneOf(row.mission))
  // Each part of town is named once, where the road first enters it; coming back to a part
  // later does not repeat the label.
  const zoneLabels = zones.flatMap((zone, i) => (zones.indexOf(zone) === i ? [i] : []))
  const tabbableId =
    (focusId && rows.some((row) => row.mission.id === focusId) ? focusId : null) ?? currentId ?? rows[0]?.mission.id

  const move = (event: KeyboardEvent<HTMLOListElement>) => {
    if (!layout) return
    const index = rows.findIndex((row) => row.mission.id === tabbableId)
    if (index < 0) return

    const row = layout.rowOf(index)
    const col = layout.colOf(index)
    const at = (r: number, c: number) => {
      if (r < 0 || c < 0 || c >= layout.cols) return null
      const i = r * layout.cols + (r % 2 === 0 ? c : layout.cols - 1 - c)
      return i < rows.length ? i : null
    }
    const next =
      event.key === 'ArrowRight'
        ? at(row, col + 1)
        : event.key === 'ArrowLeft'
          ? at(row, col - 1)
          : event.key === 'ArrowDown'
            ? (at(row + 1, col) ?? (row + 1 <= layout.rowOf(rows.length - 1) ? rows.length - 1 : null))
            : event.key === 'ArrowUp'
              ? at(row - 1, col)
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? rows.length - 1
                  : undefined
    if (next === undefined) return

    event.preventDefault()
    if (next === null) return
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

      <div ref={frame} className="relative mt-3">
        {layout && (
          <div className="relative" style={{ height: layout.height }}>
            {/*
              Contrast only where it is needed: a soft pool of light under each mission and its
              title, so the picture stays a picture everywhere else.
            */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {rows.map((row, index) => (
                <span
                  key={`glow-${row.mission.id}`}
                  className="absolute"
                  style={{
                    left: layout.x(index) - layout.labelWidth / 2 - 24,
                    top: layout.y(index) - layout.node / 2 - 20,
                    width: layout.labelWidth + 48,
                    height: layout.node + (layout.roomy ? 96 : 84),
                    backgroundImage:
                      'radial-gradient(closest-side, color-mix(in oklab, var(--color-ground-sunken) 78%, transparent), transparent)',
                  }}
                />
              ))}
            </div>

            <svg
              aria-hidden="true"
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="pointer-events-none absolute inset-0"
              fill="none"
            >
              {/* A soft light halo under the dots, so the road reads on any part of the picture. */}
              {rows.slice(1).map((row, i) => (
                <path
                  key={`halo-${row.mission.id}`}
                  d={segmentPath(layout, i)}
                  strokeWidth={layout.roomy ? 11 : 9}
                  strokeLinecap="round"
                  className="stroke-ground-raised/75"
                />
              ))}
              {rows.slice(1).map((row, i) => {
                const walked = rows[i].status === 'done' && row.status === 'done'
                return (
                  <path
                    key={row.mission.id}
                    d={segmentPath(layout, i)}
                    strokeWidth={layout.roomy ? 5 : 4}
                    strokeLinecap="round"
                    strokeDasharray="0.5 11"
                    className={walked ? 'stroke-milestone' : 'stroke-signal/85'}
                  />
                )
              })}
            </svg>

            {/* Where the road enters a new part of town. */}
            {zoneLabels.map((index, n, starts) => {
              // Two parts of town can begin on neighbouring missions; the second label then
              // steps up a line instead of sitting on top of the first.
              const previous = starts[n - 1]
              const crowded =
                previous !== undefined &&
                layout.rowOf(previous) === layout.rowOf(index) &&
                Math.abs(layout.x(previous) - layout.x(index)) < (layout.roomy ? 200 : 150)
              const lift = (layout.roomy ? 40 : 32) + (crowded ? 28 : 0)
              return (
                <ZoneLabel
                  key={`zone-${index}`}
                  zone={zones[index]}
                  label={copy.zones[zones[index]]}
                  style={{ left: layout.x(index), top: layout.y(index) - layout.node / 2 - lift }}
                />
              )
            })}

            <ol onKeyDown={move} className="contents">
              {rows.map((row, index) => (
                <li
                  key={row.mission.id}
                  className="absolute"
                  style={{
                    left: layout.x(index) - layout.labelWidth / 2,
                    top: layout.y(index) - layout.node / 2,
                    width: layout.labelWidth,
                  }}
                >
                  <MissionNode
                    row={row}
                    open={row.mission.id === openId}
                    current={row.mission.id === currentId}
                    size={layout.node}
                    tabbable={row.mission.id === tabbableId}
                    buttonRef={(el) => {
                      buttons.current[index] = el
                    }}
                    onFocus={() => setFocusId(row.mission.id)}
                    onOpen={(node) => onOpen(row.mission.id, node)}
                  />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * One mission on the road, in one system for every state: a numbered disc, the number always
 * the strongest thing on it, and at most one status badge in one place — a lock when closed,
 * a tick when finished, a clock when tried. Its title sits on a small surface of its own under
 * it. The state is spelled out in the button's name for a screen reader, so it is never told by
 * colour alone.
 */
function MissionNode({
  row,
  open,
  current,
  size,
  tabbable,
  buttonRef,
  onFocus,
  onOpen,
}: {
  row: MissionRow
  open: boolean
  current: boolean
  /** The node's diameter in pixels, from the layout. */
  size: number
  tabbable: boolean
  buttonRef: (el: HTMLButtonElement | null) => void
  onFocus: () => void
  onOpen: (node: HTMLElement) => void
}) {
  const t = useT()
  const { number, title, status, locked } = row
  const done = status === 'done' && !locked
  const roomy = size >= 64
  const badge = locked
    ? { Icon: Lock, tone: 'bg-ink-muted text-ground-raised' }
    : done
      ? { Icon: Check, tone: 'bg-milestone text-on-signal' }
      : status === 'inProgress'
        ? { Icon: Timer, tone: 'bg-caution text-ground-raised' }
        : null

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
          // The white rim is the disc's own edge, not a ring around it; the only ring is the
          // one that says "this one is open".
          'relative flex shrink-0 items-center justify-center rounded-full border-[3px] border-ground-raised font-black tabular-nums',
          'shadow-[0_6px_16px_rgb(22_24_29/0.22)]',
          roomy ? 'text-[1.75rem]' : 'text-lg',
          'motion-safe:transition-[scale,translate,box-shadow] motion-safe:duration-150',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-signal',
          locked
            ? 'bg-linear-to-b from-ground-raised to-ground-sunken text-ink-muted'
            : done
              ? 'bg-milestone text-on-signal'
              : current
                ? 'bg-signal text-on-signal shadow-[0_8px_22px_rgb(52_122_223/0.45)]'
                : 'bg-ground-raised text-signal-ink',
          open ? 'scale-110 ring-4 ring-signal/40' : 'group-hover:-translate-y-0.5',
        )}
        style={{ width: size, height: size }}
      >
        {number}

        {badge && (
          <span
            className={cx(
              'absolute -right-1 -bottom-1 flex items-center justify-center rounded-full border-2 border-ground-raised',
              roomy ? 'size-7' : 'size-6',
              badge.tone,
            )}
          >
            <badge.Icon aria-hidden="true" strokeWidth={2.6} className={roomy ? 'size-3.5' : 'size-3'} />
          </span>
        )}
      </span>

      <span
        className={cx(
          // A compact surface: the picture behind is busy, and a title must read on any part
          // of it — but it is a caption, not a card.
          'mt-2.5 line-clamp-2 max-w-full rounded-lg border px-2 py-0.5 text-center leading-snug font-bold wrap-break-word',
          'shadow-[0_1px_3px_rgb(22_24_29/0.12)]',
          roomy ? 'text-[13px]' : 'text-xs',
          open
            ? 'border-signal bg-signal text-on-signal'
            : locked
              ? 'border-ink/5 bg-ground-raised/90 text-ink-muted'
              : 'border-ink/5 bg-ground-raised/95 text-ink group-hover:text-signal-ink',
        )}
      >
        {title}
      </span>
    </button>
  )
}

function ZoneLabel({ zone, label, style }: { zone: MissionZone; label: string; style: CSSProperties }) {
  const Icon = ZONE_ICON[zone]
  return (
    <span
      className="pointer-events-none absolute flex max-w-48 -translate-x-1/2 items-center gap-1.5 rounded-md border border-ink/10 bg-ground-raised/90 px-2 py-0.5 text-[11px] font-extrabold tracking-[.06em] whitespace-nowrap text-ink uppercase shadow-[0_1px_2px_rgb(22_24_29/0.10)]"
      style={style}
    >
      <Icon aria-hidden="true" strokeWidth={2.2} className="size-3.5 shrink-0 text-signal-ink" />
      <span className="truncate">{label}</span>
    </span>
  )
}

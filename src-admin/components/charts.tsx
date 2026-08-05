import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../../src/lib/cx'

/**
 * The panel's charts, drawn by hand in SVG.
 *
 * Colour is assigned by the job it does, not by taste. One series carries no identity, so it
 * wears the product's own signal blue; a split between named things needs hues that stay
 * apart for a colourblind reader, and those three were run through the palette validator
 * against a white card — worst adjacent pair ΔE 13.6 under deuteranopia, 23.6 with full
 * colour vision, every step inside the lightness band and above 3:1 on the surface. Do not
 * add a fourth by eye: fold the rest into "Boshqa" or re-run the validator.
 *
 * Identity is never carried by colour alone — every categorical chart here ships a legend
 * with the value beside it, and the rankings are labelled in text.
 */
const SERIES = ['#1f6fe0', '#b45309', '#0e9488'] as const

const GRID = 'var(--color-hairline)'
const INK_FAINT = 'var(--color-ink-faint)'

/** Measured rather than scaled: a stretched viewBox would render 2px strokes at 2.7px. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

type Point = { date: string; value: number }

function Tooltip({ x, label, children }: { x: number; label: string; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-xl border-2 border-hairline bg-ground-raised px-3 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
      style={{ left: x }}
    >
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="text-sm font-extrabold tabular-nums text-ink">{children}</div>
    </div>
  )
}

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })

/**
 * Change over time, cumulative. A line rather than columns: the question is the shape of the
 * climb, and ninety columns of a running total is a solid block with a staircase on top.
 */
export function LineChart({
  points,
  height = 220,
  format = (value: number) => value.toLocaleString('ru-RU'),
  label,
}: {
  points: Point[]
  height?: number
  format?: (value: number) => string
  label: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">Ma'lumot yo'q</p>
  }

  const padding = { top: 16, right: 16, bottom: 24, left: 16 }
  const plotWidth = Math.max(0, width - padding.left - padding.right)
  const plotHeight = height - padding.top - padding.bottom

  const values = points.map((point) => point.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  // A flat line sits in the middle of its own band rather than on the floor, and a series
  // that only ever climbs still gets headroom above the last point.
  const top = max === min ? max + 1 : max + (max - min) * 0.1
  const bottom = max === min ? Math.max(0, max - 1) : min - (max - min) * 0.05

  const x = (index: number) =>
    padding.left + (points.length === 1 ? plotWidth / 2 : (plotWidth * index) / (points.length - 1))
  const y = (value: number) => padding.top + plotHeight * (1 - (value - bottom) / (top - bottom))

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`).join(' ')
  const area = `${line} L${x(points.length - 1)},${padding.top + plotHeight} L${x(0)},${padding.top + plotHeight} Z`

  const last = points[points.length - 1]
  const active = hover === null ? null : points[hover]

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}: ${format(points[0].value)} dan ${format(last.value)} gacha, ${points.length} kun`}
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            const ratio = (event.clientX - bounds.left - padding.left) / (plotWidth || 1)
            setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))))
          }}
          onPointerLeave={() => setHover(null)}
        >
          {/* Recessive: two rules, hairline weight, behind the data. */}
          {[0, 0.5, 1].map((step) => (
            <line
              key={step}
              x1={padding.left}
              x2={padding.left + plotWidth}
              y1={padding.top + plotHeight * step}
              y2={padding.top + plotHeight * step}
              stroke={GRID}
              strokeWidth={1}
            />
          ))}

          <path d={area} fill={SERIES[0]} opacity={0.08} />
          <path d={line} fill="none" stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {active && (
            <g>
              <line
                x1={x(hover!)}
                x2={x(hover!)}
                y1={padding.top}
                y2={padding.top + plotHeight}
                stroke={INK_FAINT}
                strokeWidth={1}
              />
              <circle cx={x(hover!)} cy={y(active.value)} r={5} fill={SERIES[0]} stroke="var(--color-ground-raised)" strokeWidth={2} />
            </g>
          )}

          {/* The end of the line is the number people came for, so it is labelled directly. */}
          <circle cx={x(points.length - 1)} cy={y(last.value)} r={4} fill={SERIES[0]} />

          <text x={padding.left} y={height - 6} fontSize={11} fill={INK_FAINT}>
            {shortDay(points[0].date)}
          </text>
          <text x={padding.left + plotWidth} y={height - 6} fontSize={11} fill={INK_FAINT} textAnchor="end">
            {shortDay(last.date)}
          </text>
        </svg>
      )}

      {active && (
        <Tooltip x={x(hover!)} label={shortDay(active.date)}>
          {format(active.value)}
        </Tooltip>
      )}
    </div>
  )
}

/**
 * Counts per day. Columns rather than a line: each day is a separate, countable thing, and a
 * line between two zero days invents a slope through nothing.
 */
export function ColumnChart({
  points,
  height = 180,
  format = (value: number) => value.toLocaleString('ru-RU'),
  label,
}: {
  points: Point[]
  height?: number
  format?: (value: number) => string
  label: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">Ma'lumot yo'q</p>
  }

  const padding = { top: 12, right: 4, bottom: 24, left: 4 }
  const plotWidth = Math.max(0, width - padding.left - padding.right)
  const plotHeight = height - padding.top - padding.bottom
  const max = Math.max(1, ...points.map((point) => point.value))

  const slot = plotWidth / points.length
  // A 2px gap of surface between columns, and never a column so thin it disappears.
  const barWidth = Math.max(2, Math.min(28, slot - 2))
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const active = hover === null ? null : points[hover]

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}: ${points.length} kun ichida jami ${format(total)}`}
          onPointerLeave={() => setHover(null)}
        >
          <line
            x1={padding.left}
            x2={padding.left + plotWidth}
            y1={padding.top + plotHeight}
            y2={padding.top + plotHeight}
            stroke={GRID}
            strokeWidth={1}
          />

          {points.map((point, index) => {
            const barHeight = point.value === 0 ? 0 : Math.max(3, (plotHeight * point.value) / max)
            const left = padding.left + slot * index + (slot - barWidth) / 2

            return (
              <g key={point.date} onPointerEnter={() => setHover(index)}>
                {/* Hit target the full height of the plot: a 3px column is not a target. */}
                <rect x={padding.left + slot * index} y={padding.top} width={slot} height={plotHeight} fill="transparent" />
                {barHeight > 0 && (
                  <rect
                    x={left}
                    y={padding.top + plotHeight - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={Math.min(4, barWidth / 2)}
                    fill={SERIES[0]}
                    opacity={hover === null || hover === index ? 1 : 0.45}
                  />
                )}
              </g>
            )
          })}

          <text x={padding.left} y={height - 6} fontSize={11} fill={INK_FAINT}>
            {shortDay(points[0].date)}
          </text>
          <text x={padding.left + plotWidth} y={height - 6} fontSize={11} fill={INK_FAINT} textAnchor="end">
            {shortDay(points[points.length - 1].date)}
          </text>
        </svg>
      )}

      {active && (
        <Tooltip x={padding.left + slot * hover! + slot / 2} label={shortDay(active.date)}>
          {format(active.value)}
        </Tooltip>
      )}
    </div>
  )
}

/** A line small enough to sit inside a stat card. No axes, no hover — it is a shape, not a chart. */
export function Sparkline({ points, height = 44 }: { points: Point[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()

  if (points.length < 2) return <div className="h-11" />

  const max = Math.max(...points.map((point) => point.value))
  const min = Math.min(...points.map((point) => point.value))
  const span = max === min ? 1 : max - min

  const path = points
    .map((point, index) => {
      const x = (width * index) / (points.length - 1)
      const y = height - 4 - ((height - 8) * (point.value - min)) / span
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')

  return (
    <div ref={ref} aria-hidden="true">
      {width > 0 && (
        <svg width={width} height={height}>
          <path d={path} fill="none" stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}

/**
 * A split of one whole into a few named parts. Kept to three slices — beyond that the arcs
 * stop being comparable and a ranked bar list answers the same question better.
 */
export function Donut({
  slices,
  size = 160,
  format = (value: number) => value.toLocaleString('ru-RU'),
}: {
  slices: Array<{ label: string; value: number }>
  size?: number
  format?: (value: number) => string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)

  const radius = size / 2
  const thickness = size * 0.22
  const centre = radius - thickness / 2
  const circumference = 2 * Math.PI * centre
  // 2px of surface between segments, expressed as arc length.
  const gap = total === 0 ? 0 : 2

  let offset = 0

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} role="img" aria-label={slices.map((s) => `${s.label}: ${format(s.value)}`).join(', ')}>
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          <circle cx={radius} cy={radius} r={centre} fill="none" stroke="var(--color-ground-sunken)" strokeWidth={thickness} />
          {slices.map((slice, index) => {
            if (total === 0 || slice.value === 0) return null

            const length = (circumference * slice.value) / total
            const dash = Math.max(0, length - gap)
            const element = (
              <circle
                key={slice.label}
                cx={radius}
                cy={radius}
                r={centre}
                fill="none"
                stroke={SERIES[index % SERIES.length]}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                opacity={hover === null || hover === slice.label ? 1 : 0.4}
                onPointerEnter={() => setHover(slice.label)}
                onPointerLeave={() => setHover(null)}
              />
            )
            offset += length

            return element
          })}
        </g>
      </svg>

      {/* The legend is not decoration: it is what stops identity resting on colour alone. */}
      <ul className="space-y-2">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full"
              style={{ background: SERIES[index % SERIES.length] }}
            />
            <span className="text-ink-muted">{slice.label}</span>
            <span className="font-extrabold tabular-nums text-ink">{format(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Ranked magnitude. The track behind each bar is what makes "second place is half of first"
 * readable at a glance, which a bare bar cannot do.
 */
export function BarList({
  items,
  format = (value: number) => value.toLocaleString('ru-RU'),
  labelWidth = 'w-44',
}: {
  items: Array<{ label: string; value: number }>
  format?: (value: number) => string
  labelWidth?: string
}) {
  const max = Math.max(1, ...items.map((item) => item.value))

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">Hali hodisa yozilmagan</p>
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3" title={`${item.label}: ${format(item.value)}`}>
          <span className={cx('shrink-0 truncate text-sm text-ink-muted', labelWidth)}>{item.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-[var(--radius-control)] bg-ground-sunken">
            <span
              className="block h-full rounded-[var(--radius-control)]"
              style={{ width: `${Math.max(2, (100 * item.value) / max)}%`, background: SERIES[0] }}
            />
          </span>
          <span className="w-16 shrink-0 text-right text-sm font-extrabold tabular-nums text-ink">
            {format(item.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

import type { CSSProperties } from 'react'
import { Check, Crown, Lock, Timer } from 'lucide-react'
import { cx } from '../../lib/cx'
import { discFace, discThickness, type DiscTone } from './disc-geometry'
import '../map/map.css'

/*
 * The disc's colours. The picture behind it is the same bright daylight in either theme, so
 * these are fixed rather than taken from the theme: a dark-theme surface would read as a hole
 * in the grass.
 */
const TONE: Record<DiscTone, { face: string; side: string; ink: string; shade: string }> = {
  done: { face: 'linear-gradient(#7eeab5, #22b06f)', side: '#138556', ink: '#ffffff', shade: '#0d6a43' },
  current: { face: 'linear-gradient(#7db3fa, #347adf)', side: '#1f56ad', ink: '#ffffff', shade: '#17489a' },
  open: { face: 'linear-gradient(#ffffff, #dde9fb)', side: '#9db8e0', ink: '#1f6fe0', shade: '#ffffff' },
  locked: { face: 'linear-gradient(#ffffff, #e2e0ec)', side: '#a19cb8', ink: '#6a6585', shade: '#ffffff' },
}

const BADGE = {
  pro: { Icon: Crown, className: 'bg-coin text-coin-ink' },
  locked: { Icon: Lock, className: 'bg-ink-muted text-white' },
  done: { Icon: Check, className: 'bg-[#22b06f] text-white' },
  tried: { Icon: Timer, className: 'bg-caution text-white' },
} as const
export type DiscBadge = keyof typeof BADGE | null

/**
 * One mission on the road: a thick numbered disc laid down in its clearing, like a game piece
 * set on the ground, seen from above at the picture's angle, with the mission's title on a tag
 * under it.
 *
 * The number is always the strongest thing on the disc. At most one badge sits on its edge — a
 * crown for a Pro mission, a lock for one shut by progress, a tick when finished, a clock when
 * tried — and the state is said in the button's name too, so it is never told by colour alone.
 * The next mission has a «Start» tag above it and a ring pulsing on the ground around it.
 *
 * Only the picture is here; the map wraps it in the button.
 */
export function MissionDisc({
  number,
  tone,
  badge,
  size,
  roomy,
  title,
  showTitle,
  titleShift,
  active,
  startLabel,
  afterIntro,
}: {
  number: number
  tone: DiscTone
  badge: DiscBadge
  /** The disc's width in pixels; its height follows from the angle it lies at. */
  size: number
  roomy: boolean
  title: string
  showTitle: boolean
  /** How far the title is moved sideways to stay inside the map. */
  titleShift: number
  /** The disc whose details are open. */
  active: boolean
  startLabel: string
  /** Seconds until the map's opening is over; the ring and tag start moving after it. */
  afterIntro: number
}) {
  const shade = TONE[tone]
  const face = discFace(size)
  const depth = discThickness(size)
  const current = tone === 'current'
  const B = badge ? BADGE[badge] : null
  const delay = { '--after-intro': `${afterIntro}s` } as CSSProperties
  const ellipse: CSSProperties = { position: 'absolute', left: 0, width: size, height: face, borderRadius: '50%' }

  return (
    <>
      <span
        className={cx(
          'relative block shrink-0 rounded-[50%]',
          'motion-safe:transition-transform motion-safe:duration-150',
          'group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-signal',
          active ? '-translate-y-1' : 'group-hover:-translate-y-1',
        )}
        style={{ width: size, height: face + depth }}
      >
        {/* Its shadow on the grass. */}
        <span
          aria-hidden="true"
          className="absolute rounded-[50%] bg-[rgb(20_45_10/0.38)] blur-[3px]"
          style={{ left: -size * 0.06, width: size * 1.12, height: face, top: depth + face * 0.22 }}
        />

        {/* The next mission calls for attention; the open one keeps a steady ring. */}
        {(current || active) && (
          <span
            aria-hidden="true"
            className={cx('absolute rounded-[50%] border-4', active ? 'border-white' : 'coin-ring border-white/90')}
            style={{
              ...delay,
              left: -8,
              top: -8 + depth / 2,
              width: size + 16,
              height: face + 16,
              boxShadow: '0 0 0 4px rgb(52 122 223 / 0.35)',
            }}
          />
        )}

        {/* The disc's edge: a band and the lower rim, together its thickness. */}
        <span aria-hidden="true" style={{ ...ellipse, top: depth, background: shade.side }} />
        <span aria-hidden="true" className="absolute left-0" style={{ top: face / 2, width: size, height: depth, background: shade.side }} />

        {/* The face, with the number on it. */}
        <span
          aria-hidden="true"
          className="flex items-center justify-center border-[3px] border-white font-black tabular-nums group-active:translate-y-[var(--sink)] motion-safe:transition-transform motion-safe:duration-100"
          style={
            {
              ...ellipse,
              top: 0,
              background: shade.face,
              color: shade.ink,
              fontSize: Math.round(face * 0.62),
              lineHeight: 1,
              // Digits sit high in their line box; this centres them on the face by eye.
              paddingTop: Math.round(face * 0.06),
              boxShadow: 'inset 0 3px 0 rgb(255 255 255 / 0.55), inset 0 -4px 0 rgb(0 0 0 / 0.08)',
              textShadow: shade.ink === '#ffffff' ? `0 2px 0 ${shade.shade}` : undefined,
              '--sink': `${Math.round(depth * 0.6)}px`,
            } as CSSProperties
          }
        >
          {number}
        </span>

        {B && (
          <span
            aria-hidden="true"
            className={cx(
              'absolute z-[2] flex items-center justify-center rounded-full border-2 border-white shadow-[0_2px_0_rgb(0_0_0/0.18)]',
              roomy ? 'size-7' : 'size-6',
              B.className,
            )}
            style={{ right: roomy ? -6 : -10, top: face - (roomy ? 20 : 15) }}
          >
            <B.Icon strokeWidth={2.6} className={roomy ? 'size-3.5' : 'size-3'} />
          </span>
        )}

        {current && (
          <span
            aria-hidden="true"
            className="coin-tag absolute left-1/2 rounded-full bg-white px-2 py-0.5 font-black tracking-[0.06em] whitespace-nowrap text-[#1f56ad] uppercase shadow-[0_2px_0_rgb(0_0_0/0.12)]"
            style={{ ...delay, top: -(roomy ? 26 : 20), fontSize: roomy ? 11 : 9, translate: `calc(-50% + ${titleShift}px) 0` }}
          >
            {startLabel}
          </span>
        )}
      </span>

      {showTitle && (
        <span
          className={cx(
            'relative mt-1.5 max-w-full rounded-full text-center leading-snug font-extrabold',
            'shadow-[0_3px_0_rgb(60_90_30/0.25),0_6px_12px_rgb(30_60_20/0.2)]',
            // A phone has room for one line between the clearings; the full title is in the panel.
            roomy ? 'line-clamp-2 px-2.5 py-0.5 text-[13px] wrap-break-word' : 'truncate px-2 py-0.5 text-[11px]',
            active || current
              ? 'bg-[#347adf] text-white'
              : tone === 'locked'
                ? 'bg-white/92 text-[#6a6585]'
                : 'bg-white text-[#16181d] group-hover:text-[#1f6fe0]',
          )}
          style={{ left: titleShift }}
        >
          {title}
        </span>
      )}
    </>
  )
}

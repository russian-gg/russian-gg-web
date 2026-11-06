import type { CSSProperties, ReactNode } from 'react'
import { Check, Crown, Lock, Timer } from 'lucide-react'
import { cx } from '../../lib/cx'
import './map.css'

/**
 * A map marker: a round 3D coin standing on its spot in the picture, with the title on a tag
 * under it. The missions road and the 90-day sky use the same coin in their own colours, so the
 * two maps read as one system without looking alike.
 *
 * Only the picture is here; the caller wraps it in the button and says what it is for. The
 * state is never told by colour alone: the badge (tick, crown, lock, clock) and the button's
 * name say it too.
 *
 * Geometry, from the approved design: `size` is the coin's base width; the next coin is drawn
 * a fifth larger, with a «Start» tag above it and a ring pulsing on the ground under it. The
 * coin's foot is `size * 0.2` below the anchor, so it looks set into the ground rather than
 * floating over it.
 */
import type { CoinBadge, CoinTone } from './coin-geometry'

type Shade = { face: string; rim: string; ink: string }

/*
 * The pictures behind the coins are the same daylight in either theme, so these colours are
 * fixed rather than taken from the theme: a dark-theme coin would read as a hole in the grass.
 */
const COIN_PALETTES: Record<'missions' | 'days', Record<CoinTone, Shade>> = {
  // A finished mission is a gold coin earned; an open one is a white coin waiting.
  missions: {
    done: { face: 'linear-gradient(#ffd75e, #f0a91c)', rim: '#b77708', ink: '#ffffff' },
    current: { face: 'linear-gradient(#5b9cf0, #2f6fd6)', rim: '#1c4fa3', ink: '#ffffff' },
    open: { face: 'linear-gradient(#ffffff, #dde9fb)', rim: '#9db8e0', ink: '#1f6fe0' },
    pro: { face: 'linear-gradient(#e4e0f2, #c9c3e0)', rim: '#9a94b8', ink: '#6a6585' },
    locked: { face: 'linear-gradient(#eef0f3, #d9dde3)', rim: '#aeb4bf', ink: '#8d94a1' },
  },
  // A finished day is green, like the course's milestones.
  days: {
    done: { face: 'linear-gradient(#3fcf8c, #1fa566)', rim: '#137a4a', ink: '#ffffff' },
    current: { face: 'linear-gradient(#5b9cf0, #2f6fd6)', rim: '#1c4fa3', ink: '#ffffff' },
    open: { face: 'linear-gradient(#ffffff, #dde9fb)', rim: '#9db8e0', ink: '#1f6fe0' },
    pro: { face: 'linear-gradient(#e4e0f2, #c9c3e0)', rim: '#9a94b8', ink: '#6a6585' },
    locked: { face: 'linear-gradient(#eef0f3, #d9dde3)', rim: '#aeb4bf', ink: '#8d94a1' },
  },
}

const BADGES = {
  done: { Icon: Check, className: 'bg-[#22b06f] text-white' },
  pro: { Icon: Crown, className: 'bg-[#f4c84d] text-[#7b5200]' },
  locked: { Icon: Lock, className: 'bg-[#8d94a1] text-white' },
  tried: { Icon: Timer, className: 'bg-[#e08a14] text-white' },
} as const

const PILL: Record<CoinTone | 'active', string> = {
  done: 'bg-white text-[#16181d]',
  open: 'bg-white text-[#16181d]',
  current: 'bg-[#347adf] text-white',
  active: 'bg-[#347adf] text-white',
  pro: 'bg-white/92 text-[#6a6585]',
  locked: 'bg-white/75 text-[#5b6270]',
}

export function CoinFace({
  number,
  tone,
  badge,
  palette,
  size,
  ground,
  roomy,
  title,
  showTitle,
  titleShift = 0,
  active = false,
  startLabel,
  afterIntro = 0,
  groundShadow = 'rgb(20 45 10 / 0.38)',
  titleShadow = '0 3px 0 rgb(60 90 30 / 0.25), 0 6px 12px rgb(30 60 20 / 0.2)',
}: {
  number: ReactNode
  tone: CoinTone
  badge: CoinBadge
  palette: 'missions' | 'days'
  /** The coin's base width in pixels. */
  size: number
  /** Width of the spot it stands on; the ring under the next coin follows its shape. */
  ground: number
  roomy: boolean
  title: string
  showTitle: boolean
  /** How far the title slides sideways to stay inside the map. */
  titleShift?: number
  /** The coin whose details are open. */
  active?: boolean
  /** The word on the tag above the next coin. */
  startLabel: string
  /** Seconds until the opening of the map is over; the ring and tag start moving after it. */
  afterIntro?: number
  groundShadow?: string
  titleShadow?: string
}) {
  const shade = COIN_PALETTES[palette][tone]
  const current = tone === 'current'
  const d = Math.round(size * (current ? 1.22 : 1.05))
  const depth = Math.max(4, Math.round(d * 0.1))
  const bodyHeight = d + depth
  const b = roomy ? 24 : 18
  const ringWidth = Math.round(ground * 0.86)
  const delay = { '--after-intro': `${afterIntro}s` } as CSSProperties
  const B = badge ? BADGES[badge] : null

  return (
    <>
      {(current || active) && (
        <span
          aria-hidden="true"
          className={cx('absolute left-1/2 rounded-[50%] border-4 border-white/95', !active && 'coin-ring')}
          style={{
            ...delay,
            width: ringWidth,
            height: Math.round(ringWidth * 0.5),
            marginLeft: -ringWidth / 2,
            top: bodyHeight - ringWidth * 0.25,
            background: 'rgb(52 122 223 / 0.18)',
            boxShadow: '0 0 0 4px rgb(52 122 223 / 0.4), 0 0 24px rgb(52 122 223 / 0.55)',
          }}
        />
      )}
      <span
        className={cx(
          'relative block shrink-0 motion-safe:transition-transform motion-safe:duration-150',
          'group-focus-visible:outline-3 group-focus-visible:outline-offset-4 group-focus-visible:outline-signal group-focus-visible:rounded-full',
          active ? '-translate-y-1' : 'group-hover:-translate-y-1',
        )}
        style={{ width: d, height: bodyHeight }}
      >
        {/* Its shadow on the ground. */}
        <span
          aria-hidden="true"
          className="absolute rounded-[50%] blur-[3px]"
          style={{ left: -d * 0.08, top: bodyHeight - d * 0.16, width: d * 1.16, height: d * 0.32, background: groundShadow }}
        />
        {/* The rim: the coin's thickness. */}
        <span aria-hidden="true" className="absolute left-0 rounded-full" style={{ top: depth, width: d, height: d, background: shade.rim }} />
        {/* The face, with the number on it. */}
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 flex items-center justify-center rounded-full border-white font-black tabular-nums group-active:translate-y-0.5"
          style={{
            width: d,
            height: d,
            borderWidth: Math.max(2, Math.round(d * 0.06)),
            background: shade.face,
            color: shade.ink,
            fontSize: Math.round(d * 0.44),
            lineHeight: 1,
            boxShadow: `inset 0 ${Math.round(d * 0.06)}px 0 rgb(255 255 255 / 0.35), inset 0 -${Math.round(d * 0.06)}px 0 rgb(0 0 0 / 0.1)`,
          }}
        >
          {number}
        </span>
        {B && (
          <span
            aria-hidden="true"
            className={cx('absolute z-[2] flex items-center justify-center rounded-full border-2 border-white shadow-[0_2px_0_rgb(0_0_0/0.18)]', B.className)}
            style={{ width: b, height: b, right: -b * 0.25, top: -b * 0.15 }}
          >
            <B.Icon strokeWidth={2.8} style={{ width: b * 0.5, height: b * 0.5 }} />
          </span>
        )}
        {current && (
          <span
            aria-hidden="true"
            className="coin-tag absolute left-1/2 rounded-full bg-white px-2 py-0.5 font-black tracking-[0.06em] whitespace-nowrap text-[#1f56ad] uppercase shadow-[0_2px_0_rgb(0_0_0/0.12)]"
            style={{
              ...delay,
              top: -d * 0.42,
              fontSize: roomy ? 11 : 9,
              translate: `calc(-50% + ${titleShift}px) 0`,
            }}
          >
            {startLabel}
          </span>
        )}
      </span>
      {showTitle && (
        <span
          className={cx(
            'relative max-w-full rounded-full text-center leading-[1.3] font-extrabold',
            roomy ? 'line-clamp-2 px-2.5 py-0.5 text-[13px] wrap-break-word' : 'truncate px-2 py-0.5 text-[11px]',
            PILL[active ? 'active' : tone],
          )}
          style={{ marginTop: Math.round(size * 0.2), left: titleShift, boxShadow: titleShadow }}
        >
          {title}
        </span>
      )}
    </>
  )
}

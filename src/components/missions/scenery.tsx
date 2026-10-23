import type { JSX, SVGProps } from 'react'

/*
 * A small town in separate pieces, one SVG each, from which `ZoneScene` builds the stand-in
 * picture for a mission whose own illustration has not been delivered yet.
 *
 * Every colour is a theme token, so the town is drawn in the product's own palette and turns
 * with it in the dark theme. Soft fills, one hairline stroke, round corners — the pieces are
 * meant to be read at a glance and then ignored; the road and its missions stay on top.
 */

type PieceProps = Omit<SVGProps<SVGSVGElement>, 'viewBox'>

/** A piece of scenery: drawn on a 120×100 ground (buildings) or its own small box (props). */
export type Piece = (props: PieceProps) => JSX.Element

const wall = 'fill-ground-raised stroke-hairline'
const glass = 'fill-signal/15'
const door = 'fill-signal/30'

function Shadow({ cx = 60, w = 46 }: { cx?: number; w?: number }) {
  return <ellipse cx={cx} cy={98} rx={w} ry={3} className="fill-ink/6" />
}

function Svg({ box, children, ...props }: PieceProps & { box: string }) {
  return (
    <svg viewBox={box} aria-hidden="true" focusable="false" strokeWidth={1.5} {...props}>
      {children}
    </svg>
  )
}

export function ApartmentBlock(props: PieceProps) {
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow />
      <rect x={20} y={14} width={80} height={86} rx={6} className={wall} />
      <rect x={16} y={8} width={88} height={10} rx={4} className="fill-signal-soft stroke-hairline" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect key={`${row}-${col}`} x={30 + col * 22} y={26 + row * 17} width={16} height={11} rx={2.5} className={glass} />
        )),
      )}
      <rect x={52} y={78} width={16} height={22} rx={3} className={door} />
      <rect x={48} y={74} width={24} height={4} rx={2} className="fill-signal-soft" />
    </Svg>
  )
}

export function House(props: PieceProps) {
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow w={40} />
      <rect x={26} y={46} width={68} height={54} rx={5} className={wall} />
      <path d="M18 50 L60 16 L102 50 Z" strokeLinejoin="round" className="fill-danger-soft stroke-hairline" />
      <rect x={34} y={58} width={16} height={14} rx={2.5} className={glass} />
      <rect x={70} y={58} width={16} height={14} rx={2.5} className={glass} />
      <rect x={52} y={74} width={16} height={26} rx={3} className={door} />
      <circle cx={60} cy={36} r={5} className={glass} />
    </Svg>
  )
}

/** A shop on the street: the sign is a blank plank, never lettering. */
export function Storefront({ tone = 'caution', ...props }: PieceProps & { tone?: 'caution' | 'danger' | 'milestone' | 'signal' }) {
  const stripe = { caution: 'fill-caution-soft', danger: 'fill-danger-soft', milestone: 'fill-milestone-soft', signal: 'fill-signal-soft' }[tone]
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow />
      <rect x={14} y={24} width={92} height={76} rx={6} className={wall} />
      <rect x={10} y={18} width={100} height={10} rx={4} className="fill-ground-sunken stroke-hairline" />
      <rect x={34} y={30} width={52} height={8} rx={3} className={stripe} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M${14 + i * 15.33} 42 h15.33 v10 a7.66 7.66 0 0 1 -15.33 0 Z`}
          className={i % 2 === 0 ? `${stripe} stroke-hairline` : 'fill-ground-raised stroke-hairline'}
        />
      ))}
      <rect x={22} y={64} width={46} height={28} rx={3} className={glass} />
      <rect x={76} y={64} width={20} height={36} rx={3} className={door} />
      <rect x={20} y={92} width={50} height={6} rx={2} className="fill-milestone/25" />
    </Svg>
  )
}

export function MarketStall(props: PieceProps) {
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow w={48} />
      <rect x={20} y={30} width={4} height={68} rx={2} className="fill-caution/30" />
      <rect x={96} y={30} width={4} height={68} rx={2} className="fill-caution/30" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M${12 + i * 19.2} 26 h19.2 v12 a9.6 9.6 0 0 1 -19.2 0 Z`}
          className={i % 2 === 0 ? 'fill-milestone-soft stroke-hairline' : 'fill-ground-raised stroke-hairline'}
        />
      ))}
      <path d="M10 26 L60 8 L110 26 Z" strokeLinejoin="round" className="fill-milestone-soft stroke-hairline" />
      <rect x={16} y={68} width={88} height={30} rx={4} className="fill-caution-soft stroke-hairline" />
      {[26, 40, 54].map((cx) => (
        <circle key={cx} cx={cx} cy={64} r={6} className="fill-danger/35" />
      ))}
      {[70, 84, 96].map((cx) => (
        <circle key={cx} cx={cx} cy={64} r={6} className="fill-milestone/40" />
      ))}
      <rect x={28} y={78} width={24} height={14} rx={2} className="fill-caution/20" />
      <rect x={68} y={78} width={24} height={14} rx={2} className="fill-caution/20" />
    </Svg>
  )
}

export function CafeTerrace(props: PieceProps) {
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow w={50} />
      <rect x={58} y={38} width={3} height={52} rx={1.5} className="fill-ink/25" />
      <path d="M22 42 Q60 6 98 42 Z" className="fill-danger-soft stroke-hairline" />
      <path d="M41 42 Q60 6 79 42 Z" className="fill-ground-raised stroke-hairline" />
      <ellipse cx={60} cy={76} rx={22} ry={5} className="fill-ground-raised stroke-hairline" />
      <rect x={58} y={76} width={4} height={22} rx={2} className="fill-ink/25" />
      <rect x={20} y={70} width={14} height={4} rx={2} className="fill-caution/35" />
      <rect x={20} y={70} width={3} height={28} rx={1.5} className="fill-caution/35" />
      <rect x={86} y={70} width={14} height={4} rx={2} className="fill-caution/35" />
      <rect x={97} y={70} width={3} height={28} rx={1.5} className="fill-caution/35" />
      <rect x={52} y={66} width={8} height={8} rx={2} className="fill-signal/30" />
      <circle cx={68} cy={70} r={3} className="fill-caution/40" />
    </Svg>
  )
}

export function BusStop(props: PieceProps) {
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow w={44} />
      <rect x={16} y={28} width={70} height={8} rx={3} className="fill-signal-soft stroke-hairline" />
      <rect x={22} y={36} width={58} height={44} rx={3} className="fill-signal/10 stroke-hairline" />
      <rect x={20} y={36} width={4} height={62} rx={2} className="fill-ink/25" />
      <rect x={78} y={36} width={4} height={62} rx={2} className="fill-ink/25" />
      <rect x={30} y={80} width={42} height={5} rx={2.5} className="fill-caution/35" />
      <rect x={98} y={22} width={3} height={76} rx={1.5} className="fill-ink/25" />
      <circle cx={99.5} cy={22} r={9} className="fill-signal/35 stroke-hairline" />
      <rect x={95} y={18} width={9} height={8} rx={2} className="fill-ground-raised" />
    </Svg>
  )
}

export function Taxi(props: PieceProps) {
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow w={44} />
      <path d="M30 58 L40 40 H80 L92 58 Z" strokeLinejoin="round" className="fill-caution-soft stroke-hairline" />
      <rect x={16} y={56} width={88} height={26} rx={9} className="fill-caution-soft stroke-hairline" />
      <path d="M44 44 H58 V56 H38 Z" className={glass} />
      <path d="M62 44 H77 L84 56 H62 Z" className={glass} />
      <rect x={50} y={32} width={20} height={8} rx={2} className="fill-ground-raised stroke-hairline" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={20 + i * 10} y={66} width={5} height={5} className={i % 2 ? 'fill-ink/15' : 'fill-transparent'} />
      ))}
      <circle cx={36} cy={84} r={8} className="fill-ink/55" />
      <circle cx={84} cy={84} r={8} className="fill-ink/55" />
      <circle cx={36} cy={84} r={3} className="fill-ground-raised" />
      <circle cx={84} cy={84} r={3} className="fill-ground-raised" />
    </Svg>
  )
}

/** A clinic or a pharmacy: the same building, told apart by the colour of its cross. */
export function Clinic({ pharmacy = false, ...props }: PieceProps & { pharmacy?: boolean }) {
  const cross = pharmacy ? 'fill-milestone/55' : 'fill-danger/45'
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow />
      <rect x={16} y={22} width={88} height={78} rx={6} className={wall} />
      <rect x={12} y={16} width={96} height={10} rx={4} className="fill-ground-sunken stroke-hairline" />
      <circle cx={60} cy={40} r={11} className="fill-ground-raised stroke-hairline" />
      <rect x={57} y={32} width={6} height={16} rx={1.5} className={cross} />
      <rect x={52} y={37} width={16} height={6} rx={1.5} className={cross} />
      {[26, 82].map((x) => (
        <rect key={x} x={x} y={34} width={14} height={12} rx={2.5} className={glass} />
      ))}
      <rect x={24} y={60} width={26} height={20} rx={3} className={glass} />
      <rect x={70} y={60} width={26} height={20} rx={3} className={glass} />
      <rect x={50} y={66} width={20} height={34} rx={3} className={door} />
    </Svg>
  )
}

export function Bank(props: PieceProps) {
  return (
    <Svg box="0 0 120 100" {...props}>
      <Shadow w={50} />
      <path d="M14 34 L60 10 L106 34 Z" strokeLinejoin="round" className="fill-signal-soft stroke-hairline" />
      <rect x={16} y={34} width={88} height={8} rx={2} className="fill-ground-sunken stroke-hairline" />
      {[24, 42, 60, 78].map((x) => (
        <rect key={x} x={x} y={42} width={10} height={44} rx={2} className={wall} />
      ))}
      <rect x={34} y={48} width={6} height={32} className="fill-signal/10" />
      <rect x={70} y={48} width={6} height={32} className="fill-signal/10" />
      <rect x={14} y={86} width={92} height={6} rx={2} className="fill-ground-sunken stroke-hairline" />
      <rect x={10} y={92} width={100} height={6} rx={2} className="fill-ground-sunken stroke-hairline" />
      <circle cx={60} cy={26} r={4} className="fill-caution/40" />
    </Svg>
  )
}

/* ---------------------------------------------------------------------------- props */

export function Tree(props: PieceProps) {
  return (
    <Svg box="0 0 40 60" {...props}>
      <ellipse cx={20} cy={58} rx={12} ry={2} className="fill-ink/6" />
      <rect x={18} y={34} width={4} height={24} rx={2} className="fill-caution/30" />
      <circle cx={20} cy={22} r={15} className="fill-milestone/25" />
      <circle cx={13} cy={28} r={9} className="fill-milestone/30" />
      <circle cx={27} cy={27} r={9} className="fill-milestone/20" />
    </Svg>
  )
}

export function Lamp(props: PieceProps) {
  return (
    <Svg box="0 0 24 60" {...props}>
      <ellipse cx={12} cy={58} rx={6} ry={1.5} className="fill-ink/6" />
      <rect x={11} y={12} width={2.5} height={46} rx={1.2} className="fill-ink/25" />
      <rect x={6} y={6} width={13} height={9} rx={3} className="fill-caution-soft stroke-hairline" />
    </Svg>
  )
}

/**
 * A faint row of rooftops along the top of the map: distance, not detail. Drawn once and
 * stretched to the width it is given.
 */
export function Skyline(props: PieceProps) {
  const blocks = [
    [0, 50], [60, 34], [110, 62], [170, 40], [230, 70], [300, 46], [350, 58], [420, 30], [470, 66],
    [540, 44], [600, 74], [660, 38], [720, 56], [790, 42], [850, 68], [920, 36], [980, 60],
    [1040, 48], [1100, 64], [1160, 40],
  ]
  return (
    <Svg box="0 0 1200 100" preserveAspectRatio="none" {...props}>
      {blocks.map(([x, h]) => (
        <rect key={x} x={x} y={100 - h} width={52} height={h} rx={4} className="fill-signal/[0.05]" />
      ))}
      <rect x={636} y={2} width={4} height={60} className="fill-signal/10" />
      <circle cx={638} cy={30} r={6} className="fill-signal/10" />
    </Svg>
  )
}

/* Named variants, so each piece in the zone lists is a component of its own. */
export const WarmShop = (props: PieceProps) => <Storefront tone="caution" {...props} />
export const RoseShop = (props: PieceProps) => <Storefront tone="danger" {...props} />
export const BlueShop = (props: PieceProps) => <Storefront tone="signal" {...props} />
export const Pharmacy = (props: PieceProps) => <Clinic pharmacy {...props} />

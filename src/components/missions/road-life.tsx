import { useMemo, type CSSProperties } from 'react'
import '../map/map.css'

/*
 * Small life on the missions road: cars driving it in both directions, butterflies over the
 * clearings, and cloud shadows sliding over the land. Decoration only — hidden from assistive
 * technology, never in the way of a click, and gone for anyone who asks for less motion.
 *
 * Everything moves on its own route and rhythm, drawn from a seeded random, so the road looks
 * alive rather than scripted, and the same every time it is built. The keyframes that differ
 * per car or butterfly are generated here and written into the page with the map.
 */

/**
 * The road's centre line in the road picture (`mission-road.webp`, 1672 × 851), from the
 * bottom edge to the top edge. Found from the asphalt itself — at every step along the road,
 * the middle of the grey band — and both ends are at the same x, so the line carries on into
 * the next copy of the picture up. If the picture is redrawn, trace it again.
 */
const ROAD_W = 1672
const ROAD_H = 851
// prettier-ignore
const ROAD: ReadonlyArray<readonly [number, number]> = [
  [921, 851], [897, 819], [876, 802], [860, 783], [844, 764], [828, 746], [809, 730], [790, 714], [770, 699], [748, 688], [725, 679], [702, 670],
  [678, 664], [654, 661], [630, 660], [606, 658], [582, 655], [558, 652], [534, 648], [510, 645], [486, 642], [463, 636], [440, 630], [416, 627],
  [392, 627], [368, 625], [344, 620], [320, 617], [296, 614], [273, 609], [250, 603], [227, 596], [205, 586], [185, 574], [168, 559], [157, 542],
  [153, 526], [155, 513], [163, 500], [175, 489], [191, 479], [211, 468], [232, 460], [254, 454], [277, 448], [301, 444], [325, 440], [349, 439],
  [373, 438], [397, 439], [421, 440], [444, 443], [468, 450], [491, 458], [514, 464], [537, 468], [559, 475], [580, 486], [603, 494], [626, 501],
  [648, 509], [670, 517], [692, 526], [714, 533], [737, 540], [761, 547], [785, 551], [810, 553], [835, 557], [859, 561], [882, 564], [907, 564],
  [932, 563], [956, 560], [980, 555], [1003, 549], [1026, 539], [1048, 527], [1067, 512], [1083, 493], [1099, 474], [1115, 456], [1134, 441], [1155, 429],
  [1178, 419], [1201, 410], [1224, 403], [1248, 398], [1272, 395], [1296, 391], [1319, 387], [1343, 383], [1367, 379], [1390, 375], [1413, 368], [1436, 360],
  [1460, 354], [1482, 346], [1501, 332], [1515, 313], [1521, 293], [1520, 275], [1512, 259], [1502, 245], [1492, 235], [1480, 226], [1464, 217], [1448, 211],
  [1434, 205], [1417, 193], [1396, 182], [1373, 175], [1351, 170], [1329, 165], [1307, 162], [1284, 159], [1260, 159], [1237, 159], [1214, 158], [1191, 159],
  [1168, 158], [1143, 158], [1119, 159], [1097, 166], [1076, 177], [1057, 190], [1036, 202], [1015, 213], [992, 221], [969, 228], [946, 235], [923, 242],
  [900, 249], [877, 255], [853, 259], [828, 263], [803, 267], [777, 271], [753, 276], [729, 279], [706, 282], [681, 283], [657, 285], [633, 289],
  [609, 291], [585, 292], [561, 291], [536, 286], [512, 280], [488, 278], [464, 277], [440, 276], [416, 276], [392, 272], [369, 265], [349, 255],
  [333, 244], [322, 228], [318, 216], [319, 209], [325, 200], [332, 192], [342, 184], [358, 175], [378, 165], [399, 157], [421, 150], [443, 143],
  [467, 136], [491, 131], [515, 130], [539, 131], [563, 131], [587, 128], [611, 125], [634, 121], [658, 117], [682, 113], [705, 109], [728, 102],
  [750, 94], [772, 84], [794, 74], [815, 63], [834, 48], [852, 33], [870, 17], [921, 0], [921, 0],
]
/** Lane centre from the road's centre line, in picture pixels. Traffic keeps to the right. */
const LANE = 18

type Point = readonly [number, number]

/** A seeded random, so the road is the same every time it is built. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A smooth curve through the points (Catmull–Rom, as cubic Béziers). */
function smoothPath(points: readonly Point[], closed = false): string {
  const p = closed ? [...points, points[0], points[1], points[2]] : points
  const at = (i: number) => p[Math.max(0, Math.min(p.length - 1, i))]
  const start = closed ? 1 : 0
  const end = closed ? p.length - 2 : p.length - 1
  let d = `M${p[start][0].toFixed(1)} ${p[start][1].toFixed(1)}`
  for (let i = start; i < end; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

function pathLength(points: readonly Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  return total
}

/** The line moved `d` to the right-hand side of travel (screen y points down). */
function lane(points: readonly Point[], d: number): Point[] {
  return points.map((p, k) => {
    const a = points[Math.max(0, k - 1)]
    const b = points[Math.min(points.length - 1, k + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const n = Math.hypot(dx, dy) || 1
    return [p[0] - (dy / n) * d, p[1] + (dx / n) * d] as const
  })
}

/** Keyframes along the road with an uneven speed: cruising, slowing down, the odd short stop. */
function speedProfile(name: string, rnd: () => number, length: number, speed: number) {
  const segments = 9 + Math.floor(rnd() * 7)
  const marks = Array.from({ length: segments - 1 }, () => rnd()).sort((a, b) => a - b)
  const ds = [0, ...marks, 1]
  const frames: Array<[number, number]> = [[0, 0]]
  let t = 0
  for (let j = 0; j < segments; j++) {
    t += ((ds[j + 1] - ds[j]) * length) / (speed * (0.55 + rnd() * 0.8))
    frames.push([t, ds[j + 1]])
    if (rnd() < 0.18 && j < segments - 1) {
      t += 1.2 + rnd() * 2.3
      frames.push([t, ds[j + 1]])
    }
  }
  const body = frames
    .map(([ti, di]) => `${((ti / t) * 100).toFixed(2)}%{offset-distance:${(di * 100).toFixed(2)}%;animation-timing-function:ease-in-out}`)
    .join('')
  return { css: `@keyframes ${name}{${body}}`, seconds: t }
}

const CAR_COLOURS: ReadonlyArray<readonly [string, string]> = [
  ['#c8323a', '#7f1620'],
  ['#f2f3f5', '#a9adb5'],
  ['#aeb4bd', '#6b717b'],
  ['#2c4a8a', '#152650'],
  ['#2b2d33', '#0f1013'],
  ['#3f8f5a', '#1f5232'],
  ['#e7e2d4', '#9c9583'],
]
type CarKind = 'sedan' | 'van' | 'taxi' | 'hatch'

/** A small car seen from above, facing right: body, roof, glass, lights and a soft shadow. */
function Car({ id, kind, colour, length }: { id: string; kind: CarKind; colour: readonly [string, string]; length: number }) {
  const [c, dark] = kind === 'taxi' ? (['#f3b51c', '#a26b06'] as const) : colour
  const width = kind === 'van' ? 22 : 20
  const roof = kind === 'van' ? [6, 35] : [14, 29]
  const glass = kind === 'van' ? [35, 38.5] : [29, 33.5]
  return (
    <svg width={length} height={(length * width) / 44} viewBox={`0 0 44 ${width}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${id}b`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".55" />
          <stop offset=".18" stopColor={c} />
          <stop offset=".8" stopColor={c} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" x2="1">
          <stop offset="0" stopColor="#1d2a3c" />
          <stop offset=".55" stopColor="#3d5876" />
          <stop offset="1" stopColor="#9fb8d4" />
        </linearGradient>
        <filter id={`${id}s`} x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
      </defs>
      <rect x="2.5" y="3" width="41" height={width - 2} rx="7" fill="rgba(0,0,0,.42)" filter={`url(#${id}s)`} />
      <rect x="1" y="1" width="42" height={width - 2} rx="6.5" fill={`url(#${id}b)`} stroke={dark} strokeWidth=".5" />
      <rect x={roof[0]} y="3.6" width={roof[1] - roof[0]} height={width - 7.2} rx="2.6" fill={c} stroke={dark} strokeOpacity=".35" strokeWidth=".5" />
      <path
        d={`M${glass[0]} 3.4 L${glass[1]} 4.6 Q${glass[1] + 1.4} ${width / 2} ${glass[1]} ${width - 4.6} L${glass[0]} ${width - 3.4} Z`}
        fill={`url(#${id}g)`}
      />
      {kind !== 'van' && (
        <path d={`M13.5 3.8 L10 4.8 Q9 ${width / 2} 10 ${width - 4.8} L13.5 ${width - 3.8} Z`} fill={`url(#${id}g)`} opacity=".9" />
      )}
      <rect x="41" y="2.6" width="1.6" height="3.2" rx=".8" fill="#fff8d6" />
      <rect x="41" y={width - 5.8} width="1.6" height="3.2" rx=".8" fill="#fff8d6" />
      <rect x="1.2" y="2.6" width="1.4" height="3.4" rx=".6" fill="#d6262f" />
      <rect x="1.2" y={width - 6} width="1.4" height="3.4" rx=".6" fill="#d6262f" />
      <ellipse cx="29.5" cy=".6" rx="1.4" ry=".9" fill={dark} />
      <ellipse cx="29.5" cy={width - 0.6} rx="1.4" ry=".9" fill={dark} />
      {kind === 'taxi' && (
        <>
          <rect x="19" y={width / 2 - 2.4} width="5" height="4.8" rx="1" fill="#1f1f1f" />
          <rect x="19.6" y={width / 2 - 1.8} width="3.8" height="3.6" rx=".6" fill="#ffe680" />
        </>
      )}
    </svg>
  )
}

const BUTTERFLY_COLOURS: ReadonlyArray<readonly [string, string, string]> = [
  ['#f6a234', '#d4520a', '#2a170c'],
  ['#69b7ff', '#1d53d1', '#14213d'],
  ['#ffe768', '#f0b90f', '#5a4410'],
  ['#ffffff', '#e4e1ea', '#3a3540'],
]

/** A butterfly seen from above, head first (+x). Each side folds about the body. */
function Butterfly({ id, size, colours }: { id: string; size: number; colours: readonly [string, string, string] }) {
  const [a, b, edge] = colours
  const side = (
    <>
      <path
        d="M0.6 -2 C3 -6.5 9 -10.5 12.8 -8.8 C14.4 -7.8 13.4 -3.2 11.2 -1.2 C8.2 1 4.2 1.2 0.8 0.4 Z"
        fill={`url(#${id})`}
        stroke={edge}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M0.8 0.4 C4.2 0.8 8.2 2.2 9 5.6 C9.6 8.6 6.2 10.8 3.7 9.4 C1.9 8.4 0.9 5.2 0.6 2 Z"
        fill={`url(#${id})`}
        stroke={edge}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M1.2 -1.2 C4.5 -4 8 -6.6 11.6 -7.4 M1.4 -0.4 C5 -1.6 8.4 -2.6 11.4 -2.4 M1.2 1.2 C4 2.4 6.4 4 7.6 6.6 M1 2 C2.4 4 3.2 6.4 3.8 8.6"
        stroke={edge}
        strokeWidth=".45"
        strokeOpacity=".75"
        fill="none"
      />
      <circle cx="12.2" cy="-6.6" r=".55" fill="#fff" />
      <circle cx="11.4" cy="-8.6" r=".5" fill="#fff" />
      <circle cx="12.6" cy="-4.4" r=".5" fill="#fff" />
      <circle cx="7.6" cy="8.4" r=".5" fill="#fff" />
      <circle cx="5.2" cy="9.8" r=".45" fill="#fff" />
    </>
  )
  return (
    <svg width={size} height={size} viewBox="-15 -15 30 30" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={id} cx=".15" cy=".5" r=".95">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </radialGradient>
      </defs>
      <g transform="rotate(90)">
        <g className={`${id}-w`} style={{ transformOrigin: '0 0' }}>
          {side}
        </g>
        <g style={{ transform: 'scaleX(-1)' }}>
          <g className={`${id}-w`} style={{ transformOrigin: '0 0' }}>
            {side}
          </g>
        </g>
        <ellipse cx="0" cy="1.6" rx="1" ry="6.2" fill={edge} />
        <circle cx="0" cy="-5.4" r="1.4" fill={edge} />
        <path d="M-0.5 -6.4 q-1.2 -2.6 -2.8 -3.8 M0.5 -6.4 q1.2 -2.6 2.8 -3.8" stroke={edge} strokeWidth=".5" fill="none" />
      </g>
    </svg>
  )
}

/**
 * Cars and butterflies, in the map's own coordinates, so they scroll with the road.
 *
 * `tileTop` is where the copy of the picture holding missions 1–7 begins; the cars use the
 * six copies from there up, and the butterflies the clearings of the first two.
 */
export function RoadLife({
  tileWidth,
  tileHeight,
  offset,
  tileTop,
  roomy,
  clearings,
}: {
  tileWidth: number
  tileHeight: number
  offset: number
  tileTop: number
  roomy: boolean
  /** The clearings' centres in the picture, as fractions. */
  clearings: ReadonlyArray<readonly [number, number]>
}) {
  const life = useMemo(() => {
    const rnd = seeded(roomy ? 7 : 11)
    const sx = tileWidth / ROAD_W
    const sy = tileHeight / ROAD_H
    const centre: Point[] = []
    for (let tile = 0; tile < 6; tile++) {
      const top = tileTop - tile * tileHeight
      const copy = ROAD.map(([x, y]) => [offset + x * sx, top + y * sy] as const)
      centre.push(...(centre.length ? copy.slice(1) : copy))
    }

    const css: string[] = []
    const kinds: CarKind[] = ['sedan', 'sedan', 'van', 'taxi', 'sedan', 'hatch']
    const cars = Array.from({ length: roomy ? 6 : 4 }, (_, i) => {
      const up = i % 2 === 0
      const route = lane(up ? centre : [...centre].reverse(), LANE * sx)
      const name = `rl-car${i}`
      const { css: kf, seconds } = speedProfile(name, rnd, pathLength(route), tileWidth * (0.04 + rnd() * 0.02))
      css.push(kf)
      const kind = kinds[i % kinds.length]
      return {
        name,
        kind,
        colour: CAR_COLOURS[Math.floor(rnd() * CAR_COLOURS.length)],
        length: (kind === 'van' ? 44 : kind === 'hatch' ? 34 : 40) * (roomy ? 1 : 0.55),
        path: smoothPath(route),
        seconds,
        delay: rnd() * seconds,
      }
    })

    const spots = [0, 1].flatMap((tile) =>
      clearings.map(([fx, fy]) => [offset + fx * tileWidth, tileTop - tile * tileHeight + fy * tileHeight] as const),
    )
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[spots[i], spots[j]] = [spots[j], spots[i]]
    }
    const flies = Array.from({ length: roomy ? 13 : 7 }, (_, i) => {
      const [sx0, sy0] = spots[i % spots.length]
      const cx = sx0 + (rnd() - 0.5) * 0.12 * tileWidth
      const cy = sy0 - (0.03 + rnd() * 0.06) * tileHeight
      const radius = tileWidth * (0.04 + rnd() * 0.04)
      const angles = Array.from({ length: 7 + Math.floor(rnd() * 5) }, () => rnd() * Math.PI * 2).sort((a, b) => a - b)
      let loop: Point[] = angles.map((a) => [cx + radius * (0.3 + rnd() * 0.7) * Math.cos(a), cy + radius * 0.7 * (0.3 + rnd() * 0.7) * Math.sin(a)] as const)
      if (rnd() < 0.5) loop = loop.reverse()
      const seconds = pathLength([...loop, loop[0]]) / ((roomy ? 30 : 16) * (0.7 + rnd() * 0.6))
      const id = `rl-bf${i}`
      // An uneven wingbeat: quick flaps, now and then a short glide with the wings half open.
      const frames: string[] = []
      let t = 0
      while (t < 0.98) {
        frames.push(`${(t * 100).toFixed(1)}%{transform:scaleX(1)}`)
        frames.push(`${Math.min(99, (t + 0.025) * 100).toFixed(1)}%{transform:scaleX(${(0.12 + rnd() * 0.18).toFixed(2)})}`)
        t += 0.05 + rnd() * 0.025
        if (rnd() < 0.12) {
          frames.push(`${Math.min(99, t * 100).toFixed(1)}%{transform:scaleX(.8)}`)
          t += 0.08 + rnd() * 0.07
        }
      }
      frames.push('100%{transform:scaleX(1)}')
      css.push(`@keyframes ${id}-f{${frames.join('')}}.${id}-w{animation:${id}-f ${(2.6 + rnd() * 1.4).toFixed(2)}s linear infinite}`)
      css.push(`@keyframes ${id}-m{from{offset-distance:0%}to{offset-distance:100%}}`)
      css.push(`@keyframes ${id}-b{0%,100%{transform:rotate(-14deg) translateY(0)}50%{transform:rotate(12deg) translateY(-3px)}}`)
      return {
        id,
        path: smoothPath(loop, true),
        seconds,
        delay: rnd() * seconds,
        wobble: 0.9 + rnd() * 0.8,
        size: (roomy ? 30 : 18) * (0.85 + rnd() * 0.3),
        colours: BUTTERFLY_COLOURS[i % BUTTERFLY_COLOURS.length],
      }
    })
    return { css: css.join('\n'), cars, flies }
  }, [tileWidth, tileHeight, offset, tileTop, roomy, clearings])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <style>{life.css}</style>
      {life.cars.map((car) => (
        <span
          key={car.name}
          className="amb"
          style={{
            offsetPath: `path('${car.path}')`,
            offsetRotate: 'auto',
            animation: `${car.name} ${car.seconds.toFixed(0)}s linear -${car.delay.toFixed(0)}s infinite`,
            zIndex: 1,
          }}
        >
          <Car id={car.name} kind={car.kind} colour={car.colour} length={car.length} />
        </span>
      ))}
      {life.flies.map((fly) => (
        <span
          key={fly.id}
          className="amb"
          style={{
            offsetPath: `path('${fly.path}')`,
            offsetRotate: 'auto',
            animation: `${fly.id}-m ${fly.seconds.toFixed(1)}s linear -${fly.delay.toFixed(1)}s infinite`,
            zIndex: 2,
          }}
        >
          <span style={{ display: 'block', animation: `${fly.id}-b ${fly.wobble.toFixed(2)}s ease-in-out infinite` }}>
            <Butterfly id={fly.id} size={fly.size} colours={fly.colours} />
          </span>
        </span>
      ))}
    </div>
  )
}

/** Shadows of passing clouds, sliding over the visible part of the map at their own speeds. */
export function CloudShadows() {
  const shadows = useMemo(() => {
    const rnd = seeded(9)
    return [
      { top: 8, w: 70, h: 46, s: 70, dy: 18 },
      { top: 46, w: 58, h: 38, s: 58, dy: -10 },
      { top: 72, w: 80, h: 50, s: 86, dy: 8 },
    ].map((c) => ({ ...c, seconds: c.s * (0.85 + rnd() * 0.35), delay: rnd() * c.s }))
  }, [])
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[3000] overflow-hidden">
      {shadows.map((c) => (
        <span
          key={c.top}
          className="amb amb-shadow"
          style={
            {
              left: `-${c.w}%`,
              top: `${c.top - 10}%`,
              width: `${c.w}%`,
              height: `${c.h}%`,
              '--dx': `${Math.round((100 / c.w) * 100 + 100)}%`,
              '--dy': `${c.dy}%`,
              animationDuration: `${c.seconds.toFixed(0)}s`,
              animationDelay: `-${c.delay.toFixed(1)}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

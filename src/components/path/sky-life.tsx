import { useMemo, type CSSProperties } from 'react'
import puff1 from '../../assets/images/sky/puff-1.webp'
import puff2 from '../../assets/images/sky/puff-2.webp'
import puff3 from '../../assets/images/sky/puff-3.webp'
import '../map/map.css'

/*
 * Small life in the sky of the 90-day map: seagulls, cumulus clouds drifting with the wind,
 * blossom petals and thin gusts of air. Decoration only — hidden from assistive technology,
 * never in the way of a click, and gone for anyone who asks for less motion.
 *
 * Everything moves on its own route and rhythm, drawn from a seeded random, so the sky looks
 * alive rather than scripted, and the same every time it is built. The keyframes that differ
 * per bird or petal are generated here and written into the page with the map.
 */

type Point = readonly [number, number]

const PUFFS = [
  { src: puff1, ratio: 223 / 503 },
  { src: puff2, ratio: 216 / 407 },
  { src: puff3, ratio: 190 / 537 },
]

/** A seeded random, so the sky is the same every time it is built. */
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
function smoothPath(p: readonly Point[]): string {
  const at = (i: number) => p[Math.max(0, Math.min(p.length - 1, i))]
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`
  for (let i = 0; i < p.length - 1; i++) {
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

/*
 * A seagull seen from below: both wings and the body as one outline. Every pose has the same
 * commands, so CSS can morph the wings between them (browsers that cannot, keep the glide).
 */
const WING = {
  glide: 'M-15 0 C-10 -2.6 -4.5 -2.2 0 1 C4.5 -2.2 10 -2.6 15 0 C10 0.6 4.5 1.4 0 3.2 C-4.5 1.4 -10 0.6 -15 0 Z',
  up: 'M-12.5 -9 C-9 -5 -4.5 -2 0 1 C4.5 -2 9 -5 12.5 -9 C9.5 -4 4.5 0.4 0 3.2 C-4.5 0.4 -9.5 -4 -12.5 -9 Z',
  down: 'M-13 6.5 C-9 3.2 -4.5 0.4 0 1 C4.5 0.4 9 3.2 13 6.5 C8.5 4.4 4.5 3.4 0 3.2 C-4.5 3.4 -8.5 4.4 -13 6.5 Z',
  soar: 'M-15.5 -1.5 C-10 -3.6 -4.5 -2.6 0 1 C4.5 -2.6 10 -3.6 15.5 -1.5 C10 -0.5 4.5 1.2 0 3.2 C-4.5 1.2 -10 -0.5 -15.5 -1.5 Z',
}

/** Bursts of wingbeats with glides between them, never the same rhythm twice. */
function flapKeyframes(name: string, rnd: () => number) {
  const beats = 2 + Math.floor(rnd() * 4)
  const glide = 0.35 + rnd() * 0.25
  const beat = (1 - glide) / beats
  const frame = (at: number, pose: keyof typeof WING) => `${(at * 100).toFixed(1)}%{d:path("${WING[pose]}")}`
  const frames = [frame(0, 'glide')]
  let t = 0
  for (let i = 0; i < beats; i++) {
    frames.push(frame(t + beat * 0.3, 'up'), frame(t + beat * 0.72, 'down'))
    t += beat
    frames.push(frame(t, 'glide'))
  }
  frames.push(frame(t + glide * 0.5, 'soar'), frame(1, 'glide'))
  return `@keyframes ${name}{${frames.join('')}}`
}

/** Across the sky, or into a circle or two over an island and then on. */
function gullRoute(w: number, h: number, rnd: () => number): Point[] {
  const fromLeft = rnd() < 0.55
  const [x0, x1] = fromLeft ? [-60, w + 60] : [w + 60, -60]
  const y0 = h * (0.06 + rnd() * 0.64)
  const y1 = Math.min(h * 0.85, Math.max(h * 0.04, y0 + h * (rnd() * 0.6 - 0.3)))
  const route: Point[] = [[x0, y0]]
  if (rnd() < 0.4) {
    const cx = w * (0.25 + rnd() * 0.5)
    const cy = h * (0.15 + rnd() * 0.45)
    const r = (0.07 + rnd() * 0.06) * w
    route.push([(x0 + cx) / 2, (y0 + cy) / 2 + h * (rnd() * 0.16 - 0.08)])
    const start = Math.atan2(route[1][1] - cy, route[1][0] - cx)
    const turns = [1, 1.5, 2][Math.floor(rnd() * 3)]
    const sign = rnd() < 0.5 ? -1 : 1
    const steps = Math.round(10 * turns)
    for (let k = 1; k <= steps; k++) {
      const a = start + (sign * 2 * Math.PI * turns * k) / steps
      route.push([cx + r * Math.cos(a) * (0.95 + rnd() * 0.1), cy + r * 0.55 * Math.sin(a) * (0.9 + rnd() * 0.2)])
    }
  } else {
    const n = 3 + Math.floor(rnd() * 2)
    for (let k = 1; k < n; k++) {
      const f = k / 5
      route.push([x0 + (x1 - x0) * f + (rnd() - 0.5) * 0.1 * w, y0 + (y1 - y0) * f + h * (rnd() * 0.2 - 0.1)])
    }
  }
  route.push([x1, y1])
  return route
}

/**
 * The sky over the map's visible box: gulls, petals and gusts, which do not scroll with the map
 * (they are weather, not places).
 */
export function SkyWeather({ width, height, roomy }: { width: number; height: number; roomy: boolean }) {
  const sky = useMemo(() => {
    const rnd = seeded(roomy ? 21 : 23)
    const css: string[] = []

    const gulls = Array.from({ length: roomy ? 18 : 9 }, (_, i) => {
      const depth = 0.55 + rnd() * 0.7
      const route = gullRoute(width, height, rnd)
      const fly = pathLength(route) / ((roomy ? 55 : 30) * (0.6 + 0.5 * depth) * (0.85 + rnd() * 0.35))
      const cycle = fly * (1.15 + rnd() * 0.65)
      css.push(`@keyframes sl-gm${i}{0%{offset-distance:0%}${((fly / cycle) * 100).toFixed(1)}%,100%{offset-distance:100%}}`)
      css.push(flapKeyframes(`sl-gf${i}`, rnd))
      const bank = (4 + rnd() * 5).toFixed(1)
      css.push(`@keyframes sl-gb${i}{0%,100%{transform:rotate(-${bank}deg)}50%{transform:rotate(${bank}deg)}}`)
      // Far birds are smaller, paler and slower.
      const tone = Math.round(118 + (1.25 - depth) * 70)
      return {
        id: `sl-g${i}`,
        i,
        path: smoothPath(route),
        cycle,
        delay: rnd() * cycle,
        size: (roomy ? 26 : 18) * depth,
        opacity: 0.6 + 0.4 * Math.min(1, depth),
        tip: `rgb(${tone - 30},${tone - 36},${tone - 6})`,
        bankSeconds: 2.2 + rnd() * 2.3,
        flapSeconds: 2.6 + rnd() * 2.9,
        flapDelay: rnd() * 3,
      }
    })

    const petals = Array.from({ length: roomy ? 9 : 5 }, (_, i) => {
      const y0 = height * (0.05 + rnd() * 0.85)
      const n = 4 + Math.floor(rnd() * 3)
      const route: Point[] = [[-20, y0]]
      for (let k = 1; k < n; k++) {
        route.push([(width * k) / n + (rnd() - 0.5) * 0.12 * width, y0 + height * (rnd() * 0.26 - 0.12) + k * height * (rnd() * 0.04 - 0.01)])
      }
      route.push([width + 20, y0 + height * (rnd() * 0.35 - 0.15)])
      const fly = pathLength(route) / ((roomy ? 60 : 32) * (0.7 + rnd() * 0.8))
      const cycle = fly * (1.4 + rnd() * 1.8)
      const p = (fly / cycle) * 100
      css.push(
        `@keyframes sl-pm${i}{0%{offset-distance:0%;opacity:0}3%{opacity:1}${(p * 0.97).toFixed(1)}%{opacity:1}${p.toFixed(1)}%,100%{offset-distance:100%;opacity:0}}`,
      )
      const axis = `${(0.2 + rnd() * 0.8).toFixed(2)},${(0.2 + rnd() * 0.8).toFixed(2)},${(rnd() * 0.6).toFixed(2)}`
      css.push(`@keyframes sl-pt${i}{from{transform:rotate3d(${axis},0deg)}to{transform:rotate3d(${axis},${rnd() < 0.5 ? -360 : 360}deg)}}`)
      return {
        id: `sl-p${i}`,
        i,
        path: smoothPath(route),
        cycle,
        delay: rnd() * cycle,
        tumble: 1.1 + rnd() * 1.5,
        size: (8 + rnd() * 5) * (roomy ? 1 : 0.7),
        colour: ['#f7a8c8', '#f4b6d2', '#fbc7dc'][Math.floor(rnd() * 3)],
      }
    })

    const gusts = Array.from({ length: roomy ? 6 : 3 }, (_, i) => {
      const y0 = height * (0.08 + rnd() * 0.77)
      const x0 = width * (rnd() * 0.5 - 0.05)
      const span = width * (0.35 + rnd() * 0.25)
      let route: Point[] = [[x0, y0]]
      for (let k = 1; k < 5; k++) route.push([x0 + (span * k) / 4, y0 + height * (rnd() * 0.1 - 0.05)])
      // Now and then the gust has a little curl in the middle.
      if (rnd() < 0.5) {
        const [cx, cy] = route[2]
        const r = height * (0.025 + rnd() * 0.02)
        const curl = Array.from({ length: 7 }, (_, k) => [cx + r * Math.sin((k * Math.PI) / 3), cy - r + r * Math.cos((k * Math.PI) / 3)] as const)
        route = [...route.slice(0, 2), ...curl, ...route.slice(3)]
      }
      const length = pathLength(route)
      const dash = length * (0.22 + rnd() * 0.13)
      const seconds = 2.6 + rnd() * 1.6
      const cycle = seconds * (2.5 + rnd() * 2.5)
      const p = (seconds / cycle) * 100
      css.push(
        `@keyframes sl-w${i}{0%{stroke-dashoffset:${dash.toFixed(0)};opacity:0}${(p * 0.2).toFixed(1)}%{opacity:.85}${(p * 0.75).toFixed(1)}%{opacity:.6}${p.toFixed(1)}%,100%{stroke-dashoffset:${(-length).toFixed(0)};opacity:0}}`,
      )
      return { id: `sl-w${i}`, path: smoothPath(route), dash, length, cycle, delay: rnd() * cycle, stroke: (1.4 + rnd()) * (roomy ? 1 : 0.8) }
    })

    return { css: css.join('\n'), gulls, petals, gusts }
  }, [width, height, roomy])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[3000] overflow-hidden">
      <style>{sky.css}</style>
      {sky.gusts.map((g) => (
        <svg key={g.id} className="amb" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          <path
            d={g.path}
            fill="none"
            stroke="#ffffff"
            strokeWidth={g.stroke}
            strokeLinecap="round"
            strokeDasharray={`${g.dash.toFixed(0)} ${(g.length + g.dash).toFixed(0)}`}
            style={{ animation: `${g.id} ${g.cycle.toFixed(1)}s ease-in-out -${g.delay.toFixed(1)}s infinite` }}
          />
        </svg>
      ))}
      {sky.gulls.map((g) => (
        <span
          key={g.id}
          className="amb"
          style={{
            offsetPath: `path('${g.path}')`,
            offsetRotate: '0deg',
            animation: `sl-gm${g.i} ${g.cycle.toFixed(1)}s linear -${g.delay.toFixed(1)}s infinite`,
            opacity: g.opacity,
          }}
        >
          <span style={{ display: 'block', animation: `sl-gb${g.i} ${g.bankSeconds.toFixed(1)}s ease-in-out infinite` }}>
            <svg width={g.size} height={g.size * 0.72} viewBox="-16 -11 32 23" style={{ display: 'block', overflow: 'visible' }}>
              <defs>
                <linearGradient id={`${g.id}w`} x1="0" x2="1">
                  <stop offset="0" stopColor={g.tip} />
                  <stop offset=".22" stopColor="#e9e6f3" />
                  <stop offset=".5" stopColor="#ffffff" />
                  <stop offset=".78" stopColor="#e9e6f3" />
                  <stop offset="1" stopColor={g.tip} />
                </linearGradient>
              </defs>
              <path
                d={WING.glide}
                fill={`url(#${g.id}w)`}
                style={{ animation: `sl-gf${g.i} ${g.flapSeconds.toFixed(2)}s linear -${g.flapDelay.toFixed(1)}s infinite` }}
              />
              <ellipse cx="0" cy="1.6" rx="1.7" ry="2.2" fill="#ffffff" />
              <path d="M0 -0.4 l0.7 -1.4 l0.7 1.4z" fill="#f2b33d" />
            </svg>
          </span>
        </span>
      ))}
      {sky.petals.map((p) => (
        <span
          key={p.id}
          className="amb"
          style={{
            offsetPath: `path('${p.path}')`,
            offsetRotate: 'auto',
            animation: `sl-pm${p.i} ${p.cycle.toFixed(1)}s linear -${p.delay.toFixed(1)}s infinite`,
          }}
        >
          <span style={{ display: 'block', animation: `sl-pt${p.i} ${p.tumble.toFixed(2)}s linear infinite` }}>
            <svg width={p.size} height={p.size * 0.7} viewBox="-6 -4 12 8" style={{ display: 'block' }}>
              <defs>
                <linearGradient id={`${p.id}c`} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#ffe3ee" />
                  <stop offset="1" stopColor={p.colour} />
                </linearGradient>
              </defs>
              <path d="M-5.5 0 C-3 -4 3 -3.6 5 -0.6 L4 0 L5 0.6 C3 3.6 -3 4 -5.5 0Z" fill={`url(#${p.id}c)`} />
            </svg>
          </span>
        </span>
      ))}
    </div>
  )
}

/**
 * Cumulus clouds in the map itself, under the coins: they drift with the wind at different
 * depths and speeds all the way up the trail, so they pass under the days rather than over them.
 */
export function SkyClouds({ width, mapHeight, roomy }: { width: number; mapHeight: number; roomy: boolean }) {
  const clouds = useMemo(() => {
    const rnd = seeded(roomy ? 31 : 37)
    const n = Math.floor(mapHeight / (roomy ? 330 : 260))
    return Array.from({ length: n }, (_, i) => {
      const depth = 0.45 + rnd() * 0.55
      const puff = PUFFS[Math.floor(rnd() * PUFFS.length)]
      const w = (roomy ? width * 0.26 : width * 0.5) * depth
      const h = w * puff.ratio
      const seconds = (70 + rnd() * 70) / (0.5 + depth * 0.6)
      return {
        key: i,
        src: puff.src,
        w,
        h,
        top: (mapHeight * (i + rnd())) / n - h / 2,
        seconds,
        delay: rnd() * seconds,
        opacity: 0.4 + 0.4 * depth,
        bob: 3 + rnd() * 5,
        bobSeconds: 6 + rnd() * 5,
      }
    })
  }, [width, mapHeight, roomy])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      {clouds.map((c) => (
        <span
          key={c.key}
          className="amb sky-drift"
          style={
            {
              left: -c.w,
              top: c.top,
              '--to': `${width + c.w}px`,
              animationDuration: `${c.seconds.toFixed(0)}s`,
              animationDelay: `-${c.delay.toFixed(0)}s`,
              opacity: c.opacity,
            } as CSSProperties
          }
        >
          <img
            src={c.src}
            alt=""
            width={Math.round(c.w)}
            height={Math.round(c.h)}
            className="sky-bob block"
            style={{ '--f': `-${c.bob.toFixed(0)}px`, animationDuration: `${c.bobSeconds.toFixed(1)}s` } as CSSProperties}
          />
        </span>
      ))}
    </div>
  )
}

import type { CSSProperties } from 'react'

/**
 * The only moving part of the banner.
 *
 * The illustration behind it is one static SVG the browser paints once. Animating any of it
 * would mean re-rasterising a drawing that covers half the screen on every frame, so the birds
 * live above it as four small elements instead — each one a transform, which the compositor
 * handles without touching the page.
 *
 * Four, not a flock. The point is a sky that is alive when you happen to look at it, not a
 * screensaver: at these opacities a learner reading the heading should never once be pulled
 * away by something crossing the corner of their eye.
 *
 * Reduced motion is handled in the stylesheet, where the whole layer is removed — the birds
 * drawn into the background SVG are the still version of this.
 */

type Bird = {
  /** Vertical placement in the banner. */
  top: string
  size: string
  opacity: number
  /** One crossing, left edge to right. */
  cross: string
  /**
   * The rise and fall underneath the crossing. Deliberately not a factor of `cross`: two loops
   * that divide into each other retrace the same arc every lap, and the path stops reading as
   * flight and starts reading as a wave.
   */
  rise: string
  /** How far it climbs at the top of that arc. Negative is upward. */
  lift: string
  flap: string
  /** Where it enters and leaves, as a share of the banner's width. */
  from: string
  to: string
  delay: string
  /** Phones get the two largest only: the illustration band is short, and four birds in it
      read as clutter rather than as sky. */
  smallScreens: boolean
}

const BIRDS: Bird[] = [
  {
    top: '20%',
    size: '26px',
    opacity: 0.55,
    cross: '17s',
    rise: '6.3s',
    lift: '-26px',
    flap: '0.9s',
    from: '-8%',
    to: '104%',
    delay: '0s',
    smallScreens: true,
  },
  {
    top: '34%',
    size: '19px',
    opacity: 0.42,
    cross: '23s',
    rise: '8.1s',
    lift: '-34px',
    flap: '1.15s',
    from: '-14%',
    to: '108%',
    delay: '-6s',
    smallScreens: true,
  },
  {
    top: '13%',
    size: '13px',
    opacity: 0.3,
    cross: '28s',
    rise: '10.4s',
    lift: '-20px',
    flap: '1.4s',
    from: '-6%',
    to: '106%',
    delay: '-15s',
    smallScreens: false,
  },
  {
    top: '46%',
    size: '10px',
    opacity: 0.24,
    cross: '34s',
    rise: '12.7s',
    lift: '-16px',
    flap: '1.7s',
    from: '-10%',
    to: '110%',
    delay: '-24s',
    smallScreens: false,
  },
]

export function AnimatedBirds() {
  return (
    <div className="hero-birds pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {BIRDS.map((bird, index) => (
        <span
          key={index}
          className={bird.smallScreens ? 'hero-bird' : 'hero-bird hidden md:block'}
          style={
            {
              top: bird.top,
              '--bird-size': bird.size,
              '--bird-opacity': bird.opacity,
              '--bird-cross': bird.cross,
              '--bird-rise': bird.rise,
              '--bird-lift': bird.lift,
              '--bird-flap': bird.flap,
              '--bird-from': bird.from,
              '--bird-to': bird.to,
              /*
               * Negative, so each bird is already somewhere over the banner on the first frame.
               * Starting them all at zero would mean an empty sky for the first few seconds and
               * then four birds entering together from the same edge.
               */
              '--bird-delay': bird.delay,
            } as CSSProperties
          }
        >
          <BirdGlyph />
        </span>
      ))}
    </div>
  )
}

/**
 * Two strokes meeting at the shoulders. At the sizes used here a bird is a handful of pixels,
 * so the flap is a squash of the whole pair rather than two wings hinged separately — which is
 * what the eye reads as flapping anyway, and it animates a transform rather than path data.
 */
function BirdGlyph() {
  return (
    <svg viewBox="0 0 24 10" className="hero-bird__body" fill="none" aria-hidden="true">
      <g
        className="hero-bird__wings"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1.5 7.2Q6 1.2 12 6" />
        <path d="M22.5 7.2Q18 1.2 12 6" />
      </g>
    </svg>
  )
}

/**
 * The product tour's timeline: a scene is a list of steps, and every step's timing is known
 * before it plays, so the whole demo is a pure function of one number — the time elapsed.
 *
 * A step can glide the cursor to a named target (`data-tour="name"` on an element inside the
 * stage), press it, change the mock's state and then hold. The order inside a step is always:
 *
 *     move (moveMs) → press (PRESS_MS) → state applied + caption → hold
 *
 * Because nothing depends on wall-clock callbacks, pausing is just "stop advancing the
 * number", a reduced-motion poster is "the state after step N", and the progress bar on the
 * active tab is `elapsed / total`.
 */

export interface Step<S> {
  /** Name of the target (`data-tour`) the cursor glides to. */
  move?: string
  /** How long the glide takes. */
  moveMs?: number
  /** Press the target once the cursor is on it: ripple, pressed state, then `set` applies. */
  click?: boolean
  /** The change to the mock's state this step makes. */
  set?: Partial<S>
  /** The caption (0-based) highlighted from the moment `set` applies. */
  caption?: number
  /** How long the result stays on screen before the next step starts. */
  hold: number
}

export interface Scene<S> {
  initial: S
  steps: ReadonlyArray<Step<S>>
  /**
   * The step whose resulting state is the scene's most informative still frame — what a
   * visitor who asked for reduced motion sees instead of the demo.
   */
  poster: number
}

export interface Timing {
  start: number
  moveStart: number
  moveEnd: number
  press: number
  /** When the step's `set` and caption apply. */
  settle: number
  end: number
}

export const MOVE_MS = 820
export const PRESS_MS = 180

export function plan<S>(steps: ReadonlyArray<Step<S>>): { times: Timing[]; total: number } {
  let t = 0
  const times = steps.map((step) => {
    const start = t
    const moveStart = t
    if (step.move) t += step.moveMs ?? MOVE_MS
    const moveEnd = t
    const press = t
    if (step.click) t += PRESS_MS
    const settle = t
    t += step.hold
    return { start, moveStart, moveEnd, press, settle, end: t }
  })
  return { times, total: t }
}

/** The mock's state once the first `count` steps have applied. */
export function stateAfter<S>(scene: Scene<S>, count: number): S {
  let state = scene.initial
  for (let i = 0; i < Math.min(count, scene.steps.length); i++) {
    const patch = scene.steps[i].set
    if (patch) state = { ...state, ...patch }
  }
  return state
}

/** The caption highlighted once the first `count` steps have applied. */
export function captionAfter<S>(steps: ReadonlyArray<Step<S>>, count: number): number {
  let caption = 0
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const value = steps[i].caption
    if (value !== undefined) caption = value
  }
  return caption
}

/** Ease in-out cubic: the cursor leaves gently, travels, and settles onto its target. */
export function easeInOut(p: number) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
}

/** The fixed design sizes the mock is drawn at; the stage scales them to its container. */
export const DESIGN = {
  wide: { width: 880, height: 540 },
  compact: { width: 400, height: 520 },
} as const

/** Below this panel width the compact design is used. Mirrored by the container query in tour.css. */
export const COMPACT_BELOW = 680

import type { Scene } from './engine'

/*
 * The three scripts. Each caption index points at `stepN` (N = index + 1) in
 * `landing.tour.<scene>` of the dictionaries.
 */

/* ---------------------------------------------------------------------------- lessons */

export type LessonsState = {
  /**
   * map: the 90-day path · details: the lesson card risen over the map · lesson: the lesson's
   * «Практикуй!» step, on its last AI question · complete: the lesson's closing card.
   */
  view: 'map' | 'details' | 'lesson' | 'complete'
  /** Days finished on the path. */
  done: number
  /** The AI question being read aloud. */
  audio: boolean
  mic: 'idle' | 'listening' | 'processing' | 'checked'
}

export const lessonsScene: Scene<LessonsState> = {
  initial: { view: 'map', done: 3, audio: false, mic: 'idle' },
  steps: [
    { caption: 0, hold: 900 },
    { move: 'day-4', click: true, set: { view: 'details' }, hold: 1300 },
    // The question plays by itself when it comes up, as it does in the lesson.
    { move: 'start', click: true, set: { view: 'lesson', audio: true }, caption: 1, hold: 1900 },
    { set: { audio: false }, hold: 500 },
    { move: 'mic', moveMs: 700, click: true, set: { mic: 'listening' }, caption: 2, hold: 1900 },
    // Pressed again to stop: the answer goes to the AI.
    { move: 'mic', moveMs: 120, click: true, set: { mic: 'processing' }, hold: 800 },
    { set: { mic: 'checked' }, hold: 1800 },
    { move: 'next', click: true, set: { view: 'complete' }, caption: 3, hold: 1700 },
    { move: 'finish', click: true, set: { view: 'map', done: 4, mic: 'idle' }, hold: 2400 },
  ],
  poster: 6,
}

/* --------------------------------------------------------------------------- missions */

export type MissionsState = {
  /** The road (`/practice`), the brief (`/missions/:id`), the call (`…/live`), the result. */
  view: 'road' | 'brief' | 'live' | 'result'
  /** The chosen mission's details over the road: shut, risen, and scrolled down to its button. */
  sheet: 'closed' | 'open' | 'scrolled'
  /**
   * The call: 0 the penguin's first line · 1 the learner answering · 2 the penguin's second
   * line · 3 the learner answering again.
   */
  turn: number
  /** «What did they say?» pressed: the penguin's last line written out under the sphere. */
  line: boolean
  /** Mission 1 is finished once its result has been seen, and the road moves on to 2. */
  done: boolean
}

export const missionsScene: Scene<MissionsState> = {
  initial: { view: 'road', sheet: 'closed', turn: 0, line: false, done: false },
  steps: [
    { caption: 0, hold: 700 },
    { move: 'mission-2', hold: 350 },
    { move: 'mission-1', moveMs: 600, click: true, set: { sheet: 'open' }, hold: 1100 },
    { set: { sheet: 'scrolled' }, hold: 700 },
    { move: 'sheet-start', click: true, set: { view: 'brief', sheet: 'closed' }, caption: 1, hold: 1700 },
    { move: 'brief-start', click: true, set: { view: 'live', turn: 0 }, caption: 2, hold: 1500 },
    { set: { turn: 1 }, hold: 1600 },
    { set: { turn: 2 }, hold: 900 },
    { move: 'show-line', click: true, set: { line: true }, hold: 1700 },
    { set: { turn: 3 }, hold: 1500 },
    { set: { view: 'result', line: false }, caption: 3, hold: 2800 },
    { move: 'nav-practice', click: true, set: { view: 'road', turn: 0, done: true }, hold: 1300 },
  ],
  poster: 10,
}

/* ------------------------------------------------------------------------------ games */

export type GamesState = {
  /** The games shelf, then «Пила»: its setup screen, the round, the results. */
  view: 'shelf' | 'setup' | 'play' | 'result'
  /** The phone shelf scrolled down to the second card. */
  scrolled: boolean
  /** The question being answered (0-based). */
  round: number
  /** The threat meter: how close the saw is, 0–100. */
  threat: number
  /** The round's clock. */
  seconds: number
  /** Words of the answer heard so far. */
  words: number
  speaking: boolean
}

const gamesStart: GamesState = { view: 'shelf', scrolled: false, round: 0, threat: 0, seconds: 60, words: 0, speaking: false }

export const gamesScene: Scene<GamesState> = {
  initial: gamesStart,
  steps: [
    { caption: 0, hold: 600 },
    { move: 'game-rod-runner', hold: 450 },
    { set: { scrolled: true }, hold: 650 },
    { move: 'game-arra', moveMs: 650, click: true, set: { view: 'setup' }, hold: 1000 },
    { move: 'arra-start', click: true, set: { view: 'play', threat: 12 }, caption: 1, hold: 800 },
    { set: { threat: 34, seconds: 57 }, hold: 1000 },
    { set: { speaking: true, words: 4, threat: 28, seconds: 55 }, hold: 700 },
    { set: { words: 9, threat: 19, seconds: 53 }, hold: 700 },
    { set: { words: 15, threat: 11, seconds: 50 }, hold: 900 },
    { set: { speaking: false, round: 1, words: 0, threat: 9, seconds: 48 }, caption: 2, hold: 1100 },
    { set: { speaking: true, words: 7, threat: 4, seconds: 45 }, hold: 800 },
    { set: { words: 16, threat: 0, seconds: 41 }, hold: 1000 },
    { set: { view: 'result', speaking: false }, caption: 3, hold: 2800 },
    { move: 'arra-back', click: true, set: gamesStart, hold: 900 },
  ],
  poster: 11,
}

import { useEffect, useRef, useState } from 'react'
import type { GameFeedback, GamePrompt, GameSession, GameTurn } from '../../../lib/speaking-games'
import type { GameSlug } from '../speaking/copy'

/*
  What the previews on the games page play: a round of each game with nobody at the
  microphone. The Russian is the games' own material — the same topic, sentences and
  situation a learner meets — so a card shows the game as it is, not a description of it.
*/

export const TEZ_GAPIR_WORDS = ['Мама', 'папа', 'брат', 'сестра', 'бабушка', 'дедушка', 'моя', 'семья']

export const ERROR_HUNT_ROUNDS = [
  { wrong: 'Она пришла с школы.', right: 'Она пришла из школы.' },
  { wrong: 'Я живу в Ташкент.', right: 'Я живу в Ташкенте.' },
  { wrong: 'Это мой мама.', right: 'Это моя мама.' },
]

export const FIRST_REACTION_SCENES = [
  { id: 'sit_056', scene: 'job_interview.gif', textRu: 'Вас пригласили на собеседование.', answer: 'Ого! Я готов! Когда собеседование?' },
  { id: 'sit_035', scene: 'overslept_work.gif', textRu: 'Вы проспали на работу.', answer: 'Ой! Я опоздал! Бегу на работу.' },
]

export const LIFE_TOPIC = { title: 'Чай или кофе?', line: 'Ты любишь чай или кофе? Почему?' }

const NO_FEEDBACK: GameFeedback = {
  answer: '', correct: null, points: 0, explanation: '', correctAnswer: null,
  criteria: [], words: [], characterPhrase: '', evaluationKind: '',
}

export function demoPrompt(id: string, textRu: string, kind: string, scene: string | null = null): GamePrompt {
  return { id, textRu, titleUz: null, kind, scene, options: [] }
}

export function demoTurn(roundIndex: number, correct: boolean): GameTurn {
  return {
    roundIndex,
    prompt: demoPrompt(`demo-${roundIndex}`, '', 'correction'),
    feedback: { ...NO_FEEDBACK, answer: '…', correct, points: correct ? 1 : 0 },
    answeredAt: '',
    locationId: null,
  }
}

export function demoSession(slug: GameSlug, parts: Partial<GameSession> & Pick<GameSession, 'prompt'>): GameSession {
  return {
    id: `demo-${slug}`, gameSlug: slug, version: 1, status: 'answering', character: 'penguin', level: 'A1',
    score: 0, roundIndex: 0, totalRounds: 5, durationSeconds: 10, roundStartedAt: null,
    deadlineUtc: null, serverNowUtc: '', feedback: null, history: [], clues: [], locations: [],
    achievements: [], summary: null, availableActions: [], pendingAnswer: null,
    ...parts,
  }
}

export function solvedFeedback(answer: string): GameFeedback {
  return { ...NO_FEEDBACK, answer, correct: true, points: 1 }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Seconds since the preview started, ticking while `running` and only then. A card that has
 * scrolled away, or a banner slide that is not up, stops its clock rather than re-rendering a
 * game screen nobody can see; a learner who asked for less motion gets the first frame.
 */
export function useDemoClock(running: boolean, stepMs = 100) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running || prefersReducedMotion()) return
    const startedAt = performance.now() - seconds * 1000
    const id = window.setInterval(() => setSeconds((performance.now() - startedAt) / 1000), stepMs)
    return () => window.clearInterval(id)
    // `seconds` only seeds the restart, so a paused preview resumes where it stopped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, stepMs])
  return seconds
}

/** Whether an element is on screen, so off-screen previews can stop. */
export function useOnScreen<T extends Element>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '120px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, visible] as const
}

export { prefersReducedMotion }

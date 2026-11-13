import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { useNavigate } from 'react-router-dom'
import { useSpeechRecognition } from '../../lib/speech'
import { SawGameView } from './saw/SawGameView'

/**
 * Arra — the saw.
 *
 * A question sits on the screen and a blade rolls toward you from the left. Speaking pushes it
 * back; silence and hesitation let it come on. Survive a minute and the round is yours.
 *
 * The blade is driven by the same arithmetic the placement uses — how much Russian comes out,
 * and whether it comes out in runs rather than single words — because a game that rewards a
 * model's opinion of you teaches you to please a model. This one rewards speaking, measurably.
 */

const ROUND_SECONDS = 60

/** How far the blade travels, in percent of the track, per second of each state. */
/** Loud enough to be a voice rather than a room. */
const VOICE = 6

const ADVANCE_IDLE = 7
const ADVANCE_STALLED = 12
const RETREAT_MAX = 16

type Phase = 'ready' | 'playing' | 'cut' | 'won'

export function SawGame() {
  const t = useT().arcade.saw
  const navigate = useNavigate()
  // Russian recognition on purpose: the blade retreats for Russian, so Russian is the thing
  // that has to be heard well. Uzbek still registers as speech, which is what stops the stall.
  // Continuous: the whole round is one long answer, so the mic must stay open across pauses.
  const speech = useSpeechRecognition('ru-RU', { continuous: true })
  // The hook returns a fresh object each render but these functions are stable. Depend on the
  // functions, never the object — a `[speech]` dependency fires on every blade tick, and a cleanup
  // that closes the mic on every render means the recogniser is never actually listening.
  const { reset: resetSpeech, start: startSpeech, stop: stopSpeech } = speech

  const [phase, setPhase] = useState<Phase>('ready')
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  /** 0 is the far left, 100 is the avatar. */
  const [blade, setBlade] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)

  const heard = useRef({ text: '', at: 0, words: 0, russian: 0 })
  /*
   * Whether a voice is arriving at all, measured from the microphone rather than from the
   * recogniser.
   *
   * The recogniser is set to Russian because Russian is what the blade retreats for — but a
   * learner answering in Uzbek produces no Russian result at all, and the blade read that as
   * silence and rolled straight over somebody who was talking the whole time. Loudness has no
   * language.
   */
  const level = useRef({
    loud: 0,
    at: 0,
    stream: null as MediaStream | null,
    ctx: null as AudioContext | null,
  })
  const question = t.questions[round % t.questions.length]

  const listenForVoice = useCallback(async () => {
    if (level.current.ctx) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)

      const samples = new Uint8Array(analyser.frequencyBinCount)
      level.current = { loud: 0, at: Date.now(), stream, ctx }

      const read = () => {
        if (!level.current.ctx) return

        analyser.getByteTimeDomainData(samples)
        // Distance from silence, averaged. Cheap, and enough to tell talking from a room.
        let sum = 0
        for (const sample of samples) sum += Math.abs(sample - 128)
        level.current.loud = sum / samples.length
        if (level.current.loud > VOICE) level.current.at = Date.now()

        requestAnimationFrame(read)
      }

      read()
    } catch {
      // No meter, so the recogniser is the only signal — which is the behaviour it had before.
    }
  }, [])

  const releaseVoice = useCallback(() => {
    level.current.stream?.getTracks().forEach((track) => track.stop())
    void level.current.ctx?.close()
    level.current = { loud: 0, at: 0, stream: null, ctx: null }
  }, [])

  const start = useCallback(() => {
    heard.current = { text: '', at: Date.now(), words: 0, russian: 0 }
    void listenForVoice()
    resetSpeech()
    startSpeech()
    setBlade(0)
    setSecondsLeft(ROUND_SECONDS)
    setPhase('playing')
  }, [listenForVoice, resetSpeech, startSpeech])

  const stop = useCallback(() => {
    stopSpeech()
  }, [stopSpeech])

  /*
   * Every transcript update is a heartbeat: it says they are still talking, and how much of
   * what they said was Russian. Held in a ref so the blade loop can read it without a render
   * per syllable.
   */
  useEffect(() => {
    if (phase !== 'playing') return

    const text = speech.transcript.trim()
    if (!text || text === heard.current.text) return

    const words = text.split(/\s+/).filter(Boolean)
    const russian = words.filter((word) => /[Ѐ-ӿ]/.test(word)).length

    // Only Russian moves this clock. It is what the blade retreats from, and a transcript
    // that grew without any Russian in it is somebody still speaking Uzbek.
    heard.current = {
      text,
      at: russian > heard.current.russian ? Date.now() : heard.current.at,
      words: words.length,
      russian,
    }
  }, [speech.transcript, phase])

  // The blade, and the clock it is racing.
  useEffect(() => {
    if (phase !== 'playing') return

    const tick = window.setInterval(() => {
      const now = Date.now()
      const sinceRussian = (now - heard.current.at) / 1000
      const sinceVoice = (now - level.current.at) / 1000
      const { words, russian } = heard.current

      setBlade((position) => {
        /*
         * Three states, and the middle one is the whole lesson.
         *
         * Russian pushes the blade away. Talking in Uzbek holds it exactly where it is —
         * everybody here can speak Uzbek all day, so rewarding it would make the game
         * winnable without ever attempting the language it is for. Silence lets it come on.
         *
         * Nothing punishes a wrong Russian word. Only stopping, and only staying in Uzbek.
         */
        const step =
          sinceRussian < 1.5
            ? -Math.min(RETREAT_MAX, 4 + russian * 3 + Math.min(words, 12) * 0.5)
            : sinceVoice < 1.5
              ? 0
              : sinceVoice < 3
                ? ADVANCE_IDLE
                : ADVANCE_STALLED

        const next = position + step / 10

        if (next >= 100) {
          setPhase('cut')

          return 100
        }

        return Math.max(0, next)
      })
    }, 100)

    return () => window.clearInterval(tick)
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing') return

    const timer = window.setInterval(() => {
      setSecondsLeft((left) => {
        if (left <= 1) {
          setPhase('won')

          return 0
        }

        return left - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [phase])

  // Whatever ends the round, the microphone closes with it.
  useEffect(() => {
    if (phase === 'cut' || phase === 'won') {
      stop()
      releaseVoice()
    }
  }, [phase, stop, releaseVoice])

  useEffect(
    () => () => {
      stopSpeech()
      releaseVoice()
    },
    [stopSpeech, releaseVoice],
  )

  useEffect(() => {
    if (phase === 'won') setScore((current) => current + 1)
  }, [phase])

  const spoken = useMemo(() => speech.transcript.trim(), [speech.transcript])
  const speaking = phase === 'playing' && heard.current.russian > 0 && Date.now() - heard.current.at < 1500

  return <SawGameView
    phase={phase} blade={blade} secondsLeft={secondsLeft} score={score} round={round}
    question={question} transcript={spoken} speaking={speaking} supported={speech.supported}
    error={speech.status === 'denied' ? t.micDenied : undefined}
    onStart={start} onBack={() => navigate('/games')}
    onNext={() => { setRound((current) => current + 1); setPhase('ready') }}
  />
}

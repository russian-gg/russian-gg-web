import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SawGameView } from './saw/SawGameView'
import { SawAudio } from './saw/audio'
import { SawInput } from './saw/input'
import { SAW_SIGNALS, SawVoiceMeter, endSawVoice, sawMicrophoneError, sawVoiceUnavailable, startSawVoice } from './saw/live'
import { LiveVoiceSession, releaseMicrophone, requestMicrophone } from '../../lib/liveVoice'
import type { VoiceSessionTicket } from '../../lib/types'
import { getSawReply, isSawLanguageError, sawError } from './saw/dialogue'
import type { SawMessage } from './saw/dialogue'
import { contentWords, fillerCount, nextThreat, resultFor } from './saw/engine'
import { CONTACT_DURATION_MS, ROUND_SECONDS, SAW_TOPICS } from './saw/model'
import type { SawCharacter, SawEmotion, SawPhase, SawResult } from './saw/model'

type Run = {
  audio: SawAudio; speech: SawInput; timer?: number; finishTimer?: number; alive: boolean; paused: boolean;
  elapsed: number; spoken: number; threat: number; lastRussian: number; lastChange: number;
  silence: number; reminded: boolean; current: string; previous: string[]; fillers: number;
  history: SawMessage[];
  // Live round: the hero's voice session, the meter its mouth follows, and what has to be handed back.
  live?: LiveVoiceSession; liveId?: string; meter?: SawVoiceMeter; playback?: AudioContext; microphoneHeld?: boolean;
}

const MICROPHONE_ERROR = 'Не удалось включить микрофон. Разреши доступ к нему и попробуй ещё раз.'
const LIVE_LEVEL = 'A2'
// The clock stops while the hero talks, so a round can outlast its minute; this is the hard stop.
const LIVE_LIMIT_MS = 140_000

export function SawGame() {
  const navigate = useNavigate()
  const [character, setCharacter] = useState<SawCharacter>('penguin')
  const [topic, setTopic] = useState('everyday')
  const [phase, setPhase] = useState<SawPhase>('ready')
  const [blade, setBlade] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  const [question, setQuestion] = useState('')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [tutorSpeaking, setTutorSpeaking] = useState(false)
  const [microphoneOnly, setMicrophoneOnly] = useState(false)
  const [micActive, setMicActive] = useState(false)
  const [busy, setBusy] = useState('')
  const [volume, setVolume] = useState(0)
  const [emotion, setEmotion] = useState<SawEmotion>('idle')
  const [result, setResult] = useState<SawResult>()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [meter, setMeter] = useState<SawVoiceMeter>()
  const [liveRound, setLiveRound] = useState(false)
  const sound = useRef(true)
  const run = useRef<Run | null>(null)
  const impact = useRef<Run | null>(null)
  const supported = SawInput.supported

  const release = useCallback(() => {
    const active = run.current
    run.current = null
    if (!active) return
    active.alive = false
    window.clearInterval(active.timer)
    window.clearTimeout(active.finishTimer)
    active.speech.abort()
    active.audio.close()
    if (active.live) void active.live.close()
    else void active.playback?.close().catch(() => {})
    if (active.microphoneHeld) releaseMicrophone()
    if (active.liveId) endSawVoice(active.liveId)
  }, [])

  const finish = useCallback(async (reason: SawResult['reason']) => {
    const active = run.current
    if (!active?.alive) return
    active.alive = false
    window.clearInterval(active.timer)
    if (active.live) {
      const live = active.live
      setSpeaking(false); setMicActive(false); setBusy(''); setVolume(0)
      active.audio.setThreat(active.threat, false, true)
      if (reason !== 'surrender') active.audio.cue(reason === 'silence' ? 'impact' : 'complete')
      setResult(resultFor([...active.previous, active.current].join(' '), active.spoken, active.elapsed, reason))
      if (reason === 'surrender') { setTutorSpeaking(false); setPhase('cut'); release(); return }
      // The hero gets the last word, a cheer or a yelp, while the result comes up.
      void live.finishWithFeedback(reason === 'complete' ? SAW_SIGNALS.won : SAW_SIGNALS.lost).catch(() => {})
        .finally(() => { if (run.current === active) { setTutorSpeaking(false); release() } })
      if (reason === 'complete') { setPhase('won'); setScore((value) => value + 1); return }
      setBlade(100); setEmotion('panic'); setPhase('impact')
      impact.current = active
      window.setTimeout(() => {
        if (impact.current !== active) return
        impact.current = null
        setPhase('cut')
      }, CONTACT_DURATION_MS)
      return
    }
    const contactEndsAt = performance.now() + CONTACT_DURATION_MS
    if (reason === 'silence') {
      setBlade(100)
      setEmotion('panic')
      setPhase('impact')
    }
    active.audio.setThreat(active.threat, false, true)
    if (reason !== 'surrender') active.audio.cue(reason === 'silence' ? 'impact' : 'complete')
    setSpeaking(false)
    setTutorSpeaking(false)
    setMicActive(false)
    setBusy('')
    setVolume(0)
    if (!active.paused) active.current = await active.speech.finish(300)
    active.audio.stopMicrophone()
    if (run.current !== active) return
    setResult(resultFor([...active.previous, active.current].join(' '), active.spoken, active.elapsed, reason))
    if (reason === 'silence') {
      active.finishTimer = window.setTimeout(() => {
        if (run.current !== active) return
        setPhase('cut')
        release()
      }, Math.max(0, contactEndsAt - performance.now()))
      return
    }
    setPhase(reason === 'complete' ? 'won' : 'cut')
    if (reason === 'complete' && active.speech.mode === 'recognition') setScore((value) => value + 1)
    if (reason === 'complete') active.finishTimer = window.setTimeout(release, 650)
    else release()
  }, [release])

  useEffect(() => release, [release])
  useEffect(() => {
    const interrupt = () => {
      if (!document.hidden || !run.current) return
      impact.current = null
      release()
      setPhase('ready')
      setBusy('')
      setTutorSpeaking(false)
      setMicActive(false)
      setError('Игра остановлена: вкладка была скрыта. Начни новый раунд, когда будешь готов.')
    }
    document.addEventListener('visibilitychange', interrupt)
    return () => document.removeEventListener('visibilitychange', interrupt)
  }, [release])

  const start = async () => {
    if (run.current?.alive || !supported) return
    if (run.current) release()
    impact.current = null
    setMeter(undefined); setLiveRound(false)
    setError(''); setNotice(''); setResult(undefined); setBlade(0); setSecondsLeft(ROUND_SECONDS)
    setRound(0); setTranscript(''); setQuestion(''); setSpeaking(false); setPhase('starting')
    setTutorSpeaking(false); setMicrophoneOnly(false); setMicActive(false); setVolume(0)
    setBusy('Подключаем собеседника…'); setEmotion('idle')
    let audio: SawAudio
    try { audio = new SawAudio(); audio.setEnabled(sound.current) } catch {
      setError('Не удалось включить звук. Открой игру в современном браузере.'); setPhase('ready'); return
    }
    // Opened inside the tap, so the browser lets the hero's voice play.
    let playback: AudioContext | undefined
    try { playback = new AudioContext(); void playback.resume().catch(() => {}) } catch { playback = undefined }
    const active: Run = {
      playback,
      audio, speech: null as unknown as SawInput, alive: true, paused: true,
      elapsed: 0, spoken: 0, threat: 0, lastRussian: -Infinity, lastChange: 0,
      silence: 0, reminded: false, current: '', previous: [], fillers: 0, history: [],
    }
    const fail = (message: string) => {
      if (!active.alive) return
      release(); setPhase('ready'); setBusy(''); setSpeaking(false); setTutorSpeaking(false); setMicActive(false); setError(message)
    }
    active.speech = new SawInput((text) => {
      if (!active.alive || active.paused) return
      if (text !== active.current) {
        if (contentWords(text).length > contentWords(active.current).length) {
          active.lastRussian = performance.now(); active.silence = 0; active.reminded = false
        }
        active.lastChange = performance.now()
      }
      active.current = text
      const count = fillerCount(text)
      active.threat = nextThreat(active.threat, 0, false, Math.max(0, count - active.fillers))
      active.fillers = Math.max(active.fillers, count)
      setTranscript(text)
      if (active.threat >= 100) void finish('silence')
    }, (status) => {
      if (!active.alive) return
      if (status === 'microphone-only') setMicrophoneOnly(true)
    })
    run.current = active
    const selectedTopic = SAW_TOPICS.find((item) => item.id === topic)?.label ?? SAW_TOPICS[0].label

    const resumeListening = async () => {
      setBusy('Включаем распознавание…')
      await active.speech.start()
      if (!active.alive) return
      active.lastRussian = -Infinity
      active.lastChange = performance.now()
      active.paused = false
      setBusy(''); setPhase('playing')
    }

    const converse = async (event: 'opening' | 'answer' | 'silence') => {
      if (!active.alive) return
      active.paused = true
      setSpeaking(false); setMicActive(false); setVolume(0); setBusy('Собеседник готовит вопрос…')
      active.audio.setThreat(active.threat, false, true)
      const text = event === 'opening' ? '' : await active.speech.finish(250)
      if (!active.alive) return
      active.current = event === 'answer' ? text.trim() : ''; active.fillers = 0
      setTranscript('')
      try {
        const response = await getSawReply(character, selectedTopic, event === 'answer' ? text : '', active.history, event)
        if (!active.alive) return
        if (event === 'answer' && text.trim()) {
          active.previous.push(text.trim())
          active.history.push({ role: 'user', text })
        }
        active.current = ''
        setError('')
        setNotice(response.isFallback ? 'Тренировка · готовые вопросы' : '')
        active.history.push({ role: 'assistant', text: response.characterReply })
        active.history = active.history.slice(-8)
        active.threat = Math.max(0, Math.min(100, active.threat + response.threatChange))
        setBlade(active.threat); setQuestion(response.characterReply)
        if (active.threat >= 100) { await finish('silence'); return }
        if (event === 'answer') setRound((value) => value + 1)
        setEmotion(response.animation === 'happy' ? 'happy' : response.animation === 'sad' ? 'silence' : response.animation === 'angry' ? 'panic' : 'idle')
        setBusy(sound.current ? 'Слушай собеседника — таймер на паузе' : 'Твой собеседник задал вопрос')
        active.audio.cue(event === 'opening' ? 'start' : 'reply')
        try {
          await active.audio.speak(response.characterReply, character, {
            onSpeaking: (value) => { if (active.alive) setTutorSpeaking(value) },
          })
        } catch {
          if (active.alive) setNotice(response.isFallback ? 'Готовые вопросы · озвучка Gemini недоступна' : 'Озвучка Gemini недоступна · вопрос на экране')
        }
        if (!active.alive) return
        await resumeListening()
      } catch (caught) {
        if (!active.alive) return
        if (event === 'answer' && isSawLanguageError(caught)) {
          active.current = ''
          setError(sawError(caught))
          try { await resumeListening() } catch (restartError) { fail(sawError(restartError)) }
          return
        }
        fail(sawError(caught))
      }
    }

    const dropLive = () => {
      if (active.live) void active.live.close()
      else void active.playback?.close().catch(() => {})
      active.live = undefined; active.playback = undefined; active.meter = undefined
      if (active.microphoneHeld) releaseMicrophone()
      active.microphoneHeld = false
      if (active.liveId) endSawVoice(active.liveId)
      active.liveId = undefined
      setMeter(undefined); setLiveRound(false); setTutorSpeaking(false)
    }

    /*
      The live round. The hero speaks first and keeps the conversation going by itself; this loop
      only owns the clock and the blade, and tells the hero when the blade is close so it can
      cry out. 'unavailable' hands the round to the written game below.
    */
    const playLive = async (voice: AudioContext): Promise<'started' | 'failed' | 'unavailable'> => {
      let ticket: VoiceSessionTicket
      try {
        await requestMicrophone()
        active.microphoneHeld = true
        if (!active.alive) return 'failed'
        ticket = await startSawVoice(character, LIVE_LEVEL, selectedTopic)
      } catch (caught) {
        if (!active.alive) return 'failed'
        if (sawMicrophoneError(caught)) { fail(MICROPHONE_ERROR); return 'failed' }
        if (sawVoiceUnavailable(caught)) { dropLive(); return 'unavailable' }
        fail(sawError(caught)); return 'failed'
      }
      if (!active.alive) { endSawVoice(ticket.sessionId); return 'failed' }
      active.liveId = ticket.sessionId

      const voiceMeter = new SawVoiceMeter(voice)
      voiceMeter.setEnabled(sound.current)
      active.meter = voiceMeter
      let heroSpeaking = false
      let voiceHeard = false
      let voiceAt = 0
      let loudness = 0
      let wordsArrived = false
      let replyPending = false
      let replyAt = 0
      let started = false
      let broken = false
      const breakLive = () => {
        if (!active.alive) return
        if (started) fail('Связь с собеседником прервалась. Начни новый раунд.')
        else broken = true
      }
      const live = new LiveVoiceSession(ticket, {
        onStatus: (status) => { if (status === 'listening') replyPending = false },
        onConnected: () => {},
        onInputLevel: (level, speaking) => { loudness = level; voiceHeard = speaking; voiceAt = performance.now() },
        onPlayback: (playing) => {
          heroSpeaking = playing
          replyAt = performance.now()
          if (run.current === active) setTutorSpeaking(playing)
        },
        onInputTranscript: (text) => {
          if (!active.alive || text === active.current) return
          // Only Russian words push the blade back: a cough, a neighbour or another language do not.
          if (contentWords(text).length > contentWords(active.current).length) wordsArrived = true
          active.current = text
          setTranscript(text)
        },
        onOutputTranscript: (text) => {
          replyPending = true
          replyAt = performance.now()
          if (run.current === active && text.trim()) setQuestion(text)
        },
        onTurnComplete: () => {
          replyPending = false
          if (!active.alive || !active.current.trim()) return
          active.previous.push(active.current.trim())
          active.current = ''
          setRound((value) => value + 1)
        },
        onError: breakLive,
        onDropped: breakLive,
        onSilenceTimeout: () => {},
        onNoSpeech: () => {},
      }, { continuous: true, playbackContext: voice, playbackDestination: voiceMeter.input, respectAudioMute: false, outputTranscriptDeltas: true })
      active.live = live
      setMeter(voiceMeter); setLiveRound(true)

      try { await live.start() } catch (caught) {
        if (!active.alive) return 'failed'
        if (sawMicrophoneError(caught)) { fail(MICROPHONE_ERROR); return 'failed' }
        dropLive(); return 'unavailable'
      }
      if (!active.alive) return 'failed'
      if (broken) { dropLive(); return 'unavailable' }
      started = true
      active.paused = false
      audio.setVoiced(true)
      setBusy(''); setPhase('playing')

      const beganAt = performance.now()
      let lastTick = beganAt
      let pendingVoice = 0   // seconds of voice the provider has not turned into words yet
      let creep = 0          // threat added while that voice was being treated as noise
      let backed = false     // this stretch of voice has produced Russian words
      let nearArmed = true
      let criticalArmed = true
      active.timer = window.setInterval(() => {
        const now = performance.now()
        const dt = Math.min(0.3, Math.max(0, (now - lastTick) / 1000))
        lastTick = now
        if (!active.alive) return
        const voiced = voiceHeard && now - voiceAt < 300 && !heroSpeaking
        if (wordsArrived) {
          // Words for the voice that was on hold: credit it, and take back what the blade gained meanwhile.
          wordsArrived = false
          backed = true
          active.spoken += pendingVoice
          active.threat = Math.max(0, active.threat - creep - pendingVoice * 5)
          pendingVoice = 0; creep = 0; active.silence = 0; active.reminded = false
        }
        if (!voiced && now - voiceAt > 900) backed = false
        if (!voiced && now - voiceAt > 2500) { pendingVoice = 0; creep = 0 }
        // The hero is talking, or about to: the clock and the blade wait for it.
        const waiting = heroSpeaking || (replyPending && now - replyAt < 3500)
        const previousThreat = active.threat
        const isSpeaking = !waiting && voiced && backed
        if (isSpeaking) {
          active.elapsed += dt; active.spoken += dt; active.silence = 0
          active.threat = nextThreat(active.threat, dt, true)
        } else if (!waiting && voiced && pendingVoice < 3) {
          active.elapsed += dt; pendingVoice += dt
        } else if (!waiting) {
          active.elapsed += dt; active.silence += dt
          active.threat = nextThreat(active.threat, dt, false)
          if (voiced) creep += active.threat - previousThreat
        }
        setBlade(active.threat); setSecondsLeft(Math.max(0, Math.ceil(ROUND_SECONDS - active.elapsed)))
        setSpeaking(isSpeaking); setMicActive(voiced); setVolume(voiced ? Math.min(1, loudness * 14) : 0)
        setEmotion(isSpeaking ? 'speaking' : active.threat >= 80 ? 'panic' : active.silence >= 2 ? 'silence' : 'idle')
        audio.setThreat(active.threat, isSpeaking, waiting)
        if (previousThreat < 80 && active.threat >= 80) audio.cue('warning')
        if (active.threat >= 100) { void finish('silence'); return }
        if (active.elapsed >= ROUND_SECONDS || now - beganAt >= LIVE_LIMIT_MS) { void finish('complete'); return }

        // Cues for the hero, only into a real silence so they never talk over the learner.
        if (active.threat < 35) nearArmed = true
        if (active.threat < 60) criticalArmed = true
        if (waiting || voiced) return
        let cue = ''
        if (active.threat >= 80 && criticalArmed) { cue = SAW_SIGNALS.critical; criticalArmed = false; nearArmed = false }
        else if (active.threat >= 55 && nearArmed) { cue = SAW_SIGNALS.near; nearArmed = false }
        else if (active.silence >= 3 && active.threat < 45 && !active.reminded) { cue = SAW_SIGNALS.silent; active.reminded = true }
        if (cue && live.requestTutorResponse(cue)) { replyPending = true; replyAt = now }
      }, 100)
      return 'started'
    }

    if (playback) {
      const outcome = await playLive(playback)
      if (outcome !== 'unavailable') return
    }

    try {
      await audio.openMicrophone()
      if (!active.alive) return
      await converse('opening')
      if (!active.alive) return
      let lastTick = performance.now()
      active.timer = window.setInterval(() => {
        const now = performance.now()
        const dt = Math.min(0.3, Math.max(0, (now - lastTick) / 1000))
        lastTick = now
        if (!active.alive || active.paused) return
        const level = audio.level()
        const voiceDetected = active.speech.sample(level, now)
        const isSpeaking = active.speech.mode === 'microphone-only' ? voiceDetected : now - active.lastRussian < 1200
        active.elapsed += dt
        if (isSpeaking) active.spoken += dt
        else if (!voiceDetected || active.current.trim()) active.silence += dt
        const previousThreat = active.threat
        if (isSpeaking || !voiceDetected || active.current.trim()) active.threat = nextThreat(active.threat, dt, isSpeaking)
        setBlade(active.threat); setSecondsLeft(Math.max(0, Math.ceil(ROUND_SECONDS - active.elapsed)))
        setSpeaking(isSpeaking); setMicActive(voiceDetected); setVolume(level)
        setEmotion(isSpeaking ? 'speaking' : active.threat >= 80 ? 'panic' : active.silence >= 2 ? 'silence' : 'idle')
        audio.setThreat(active.threat, isSpeaking, false)
        if (previousThreat < 80 && active.threat >= 80) audio.cue('warning')
        if (active.threat >= 100) { void finish('silence'); return }
        if (active.elapsed >= ROUND_SECONDS) { void finish('complete'); return }
        if (!voiceDetected && active.speech.mode === 'recognition' && contentWords(active.current).length > 0 && now - active.lastChange >= 1100) void converse('answer')
        else if (!voiceDetected && active.silence >= 3 && !active.reminded && active.speech.mode === 'recognition') { active.reminded = true; void converse('silence') }
      }, 100)
    } catch {
      fail(MICROPHONE_ERROR)
    }
  }

  return <SawGameView phase={phase} blade={blade} secondsLeft={secondsLeft} score={score} round={round}
    question={question} transcript={transcript} speaking={speaking} supported={supported} error={error} notice={notice}
    tutorSpeaking={tutorSpeaking} microphoneOnly={microphoneOnly} micActive={micActive}
    character={character} emotion={emotion} topic={topic} volume={volume} result={result} busy={busy}
    live={liveRound} voiceLevel={meter?.level}
    soundEnabled={soundEnabled} onCharacter={setCharacter} onTopic={setTopic} onStart={() => void start()}
    onSurrender={() => void finish('surrender')} onBack={() => { impact.current = null; release(); navigate('/games') }}
    onNext={() => { impact.current = null; release(); setError(''); setNotice(''); setPhase('ready') }}
    onToggleSound={() => {
      sound.current = !sound.current
      setSoundEnabled(sound.current)
      run.current?.audio.setEnabled(sound.current)
      run.current?.meter?.setEnabled(sound.current)
    }} />
}

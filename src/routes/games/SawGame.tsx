import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SawGameView } from './saw/SawGameView'
import { SawAudio } from './saw/audio'
import { SawInput } from './saw/input'
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
}

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
  const sound = useRef(true)
  const run = useRef<Run | null>(null)
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
  }, [])

  const finish = useCallback(async (reason: SawResult['reason']) => {
    const active = run.current
    if (!active?.alive) return
    active.alive = false
    window.clearInterval(active.timer)
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
    setError(''); setNotice(''); setResult(undefined); setBlade(0); setSecondsLeft(ROUND_SECONDS)
    setRound(0); setTranscript(''); setQuestion(''); setSpeaking(false); setPhase('starting')
    setTutorSpeaking(false); setMicrophoneOnly(false); setMicActive(false); setVolume(0)
    setBusy('Подключаем собеседника…'); setEmotion('idle')
    let audio: SawAudio
    try { audio = new SawAudio(); audio.setEnabled(sound.current) } catch {
      setError('Не удалось включить звук. Открой игру в современном браузере.'); setPhase('ready'); return
    }
    const active: Run = {
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
      fail('Не удалось включить микрофон. Разреши доступ к нему и попробуй ещё раз.')
    }
  }

  return <SawGameView phase={phase} blade={blade} secondsLeft={secondsLeft} score={score} round={round}
    question={question} transcript={transcript} speaking={speaking} supported={supported} error={error} notice={notice}
    tutorSpeaking={tutorSpeaking} microphoneOnly={microphoneOnly} micActive={micActive}
    character={character} emotion={emotion} topic={topic} volume={volume} result={result} busy={busy}
    soundEnabled={soundEnabled} onCharacter={setCharacter} onTopic={setTopic} onStart={() => void start()}
    onSurrender={() => void finish('surrender')} onBack={() => { release(); navigate('/games') }}
    onNext={() => { release(); setError(''); setNotice(''); setPhase('ready') }}
    onToggleSound={() => { sound.current = !sound.current; setSoundEnabled(sound.current); run.current?.audio.setEnabled(sound.current) }} />
}

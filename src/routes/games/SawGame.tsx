import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameSpeech } from '../../lib/game-speech'
import { SawGameView } from './saw/SawGameView'
import { SawAudio } from './saw/audio'
import { getSawReply, isSawLanguageError, sawError } from './saw/dialogue'
import type { SawMessage } from './saw/dialogue'
import { contentWords, fillerCount, nextThreat, resultFor } from './saw/engine'
import { CONTACT_DURATION_MS, ROUND_SECONDS, SAW_TOPICS } from './saw/model'
import type { SawCharacter, SawEmotion, SawPhase, SawResult } from './saw/model'

type Run = {
  audio: SawAudio; speech: GameSpeech; timer?: number; finishTimer?: number; alive: boolean; paused: boolean;
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
  const [busy, setBusy] = useState('')
  const [volume, setVolume] = useState(0)
  const [emotion, setEmotion] = useState<SawEmotion>('idle')
  const [result, setResult] = useState<SawResult>()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const sound = useRef(true)
  const run = useRef<Run | null>(null)
  const supported = typeof window !== 'undefined' && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)

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
    active.audio.close()
    const contactEndsAt = performance.now() + CONTACT_DURATION_MS
    if (reason === 'silence') {
      setBlade(100)
      setEmotion('panic')
      setPhase('impact')
    }
    setSpeaking(false)
    setBusy('')
    setVolume(0)
    if (!active.paused) active.current = await active.speech.finish(300)
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
    if (reason === 'complete') setScore((value) => value + 1)
    release()
  }, [release])

  useEffect(() => release, [release])
  useEffect(() => {
    const interrupt = () => {
      if (!document.hidden || !run.current) return
      release()
      setPhase('ready')
      setBusy('')
      setError('Игра остановлена: вкладка была скрыта. Начни новый раунд, когда будешь готов.')
    }
    document.addEventListener('visibilitychange', interrupt)
    return () => document.removeEventListener('visibilitychange', interrupt)
  }, [release])

  const start = async () => {
    if (run.current || !supported) return
    setError(''); setNotice(''); setResult(undefined); setBlade(0); setSecondsLeft(ROUND_SECONDS)
    setRound(0); setTranscript(''); setQuestion(''); setSpeaking(false); setPhase('starting')
    setBusy('Подключаем собеседника…'); setEmotion('idle')
    let audio: SawAudio
    try { audio = new SawAudio(); audio.setEnabled(sound.current) } catch {
      setError('Не удалось включить звук. Открой игру в современном браузере.'); setPhase('ready'); return
    }
    const active: Run = {
      audio, speech: null as unknown as GameSpeech, alive: true, paused: true,
      elapsed: 0, spoken: 0, threat: 0, lastRussian: -Infinity, lastChange: 0,
      silence: 0, reminded: false, current: '', previous: [], fillers: 0, history: [],
    }
    const fail = (message: string) => {
      if (!active.alive) return
      release(); setPhase('ready'); setBusy(''); setSpeaking(false); setError(message)
    }
    active.speech = new GameSpeech((text) => {
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
      if (status === 'denied') fail('Разреши доступ к микрофону в настройках браузера и попробуй ещё раз.')
      else if (status === 'failed' || status === 'unavailable') fail('Распознавание речи недоступно. Проверь соединение и доступ к микрофону.')
    })
    run.current = active
    const selectedTopic = SAW_TOPICS.find((item) => item.id === topic)?.label ?? SAW_TOPICS[0].label

    const resumeListening = async () => {
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
      setSpeaking(false); setBusy('Собеседник готовит вопрос…')
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
        setNotice(response.isFallback ? 'AI временно недоступен. Тренировка с готовыми вопросами без озвучки.' : '')
        active.history.push({ role: 'assistant', text: response.characterReply })
        active.history = active.history.slice(-8)
        active.threat = Math.max(0, Math.min(100, active.threat + response.threatChange))
        setBlade(active.threat); setQuestion(response.characterReply)
        if (active.threat >= 100) { await finish('silence'); return }
        if (event === 'answer') setRound((value) => value + 1)
        setEmotion(response.animation === 'happy' ? 'happy' : response.animation === 'sad' ? 'silence' : response.animation === 'angry' ? 'panic' : 'idle')
        setBusy(sound.current ? 'Слушай собеседника — таймер на паузе' : 'Твой собеседник задал вопрос')
        try { if (!response.isFallback) await active.audio.speak(response.characterReply, character) } catch {
          if (active.alive) setError('Озвучка недоступна. Вопрос показан на экране — отвечай по-русски.')
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
        const isSpeaking = now - active.lastRussian < 1200
        active.elapsed += dt
        if (isSpeaking) active.spoken += dt
        else active.silence += dt
        active.threat = nextThreat(active.threat, dt, isSpeaking)
        setBlade(active.threat); setSecondsLeft(Math.max(0, Math.ceil(ROUND_SECONDS - active.elapsed)))
        setSpeaking(isSpeaking); setVolume(audio.level())
        setEmotion(isSpeaking ? 'speaking' : active.threat >= 80 ? 'panic' : active.silence >= 2 ? 'silence' : 'idle')
        audio.setThreat(active.threat, isSpeaking, false)
        if (active.threat >= 100) { void finish('silence'); return }
        if (active.elapsed >= ROUND_SECONDS) { void finish('complete'); return }
        if (contentWords(active.current).length > 0 && now - active.lastChange >= 1400) void converse('answer')
        else if (active.silence >= 3 && !active.reminded) { active.reminded = true; void converse('silence') }
      }, 100)
    } catch {
      fail('Не удалось включить микрофон. Разреши доступ к нему и попробуй ещё раз.')
    }
  }

  return <SawGameView phase={phase} blade={blade} secondsLeft={secondsLeft} score={score} round={round}
    question={question} transcript={transcript} speaking={speaking} supported={supported} error={error} notice={notice}
    character={character} emotion={emotion} topic={topic} volume={volume} result={result} busy={busy}
    soundEnabled={soundEnabled} onCharacter={setCharacter} onTopic={setTopic} onStart={() => void start()}
    onSurrender={() => void finish('surrender')} onBack={() => { release(); navigate('/games') }}
    onNext={() => { release(); setError(''); setNotice(''); setPhase('ready') }}
    onToggleSound={() => { sound.current = !sound.current; setSoundEnabled(sound.current); run.current?.audio.setEnabled(sound.current) }} />
}

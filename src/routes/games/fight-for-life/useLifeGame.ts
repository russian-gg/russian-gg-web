import { useEffect, useRef, useState } from 'react'
import { LiveVoiceSession, releaseMicrophone, requestMicrophone } from '../../../lib/liveVoice'
import { lifeApi, type LifeActivity, type LifeCharacter, type LifeView } from './api'
import { LifeMeter, type LifeEmotion } from './meter'

const initial = { emotion: 'idle' as LifeEmotion, energy: 1, volume: 0, score: 0, speaking: false, tutor: false }

export function useLifeGame() {
  const [phase, setPhase] = useState<'setup' | 'connecting' | 'playing' | 'saving' | 'result' | 'error'>('setup')
  const [view, setView] = useState<LifeView | null>(null)
  const [visual, setVisual] = useState(initial)
  const [tutorLine, setTutorLine] = useState('')
  const [error, setError] = useState<unknown>(null)
  const alive = useRef(true)
  const epoch = useRef(0)
  const voice = useRef<LiveVoiceSession | null>(null)
  const pendingPlayback = useRef<AudioContext | null>(null)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)
  const current = useRef<LifeView | null>(null)
  const activity = useRef<LifeActivity>({ sequence: 0, speechMilliseconds: 0, speaking: false, tutorSpeaking: false, transcript: '', finish: false })
  const send = useRef<((finish?: boolean) => Promise<void>) | null>(null)

  function close() {
    if (interval.current) clearInterval(interval.current)
    interval.current = null
    const live = voice.current
    voice.current = null
    void live?.close()
    void pendingPlayback.current?.close().catch(() => {})
    pendingPlayback.current = null
    releaseMicrophone()
  }

  useEffect(() => {
    alive.current = true
    const leave = () => {
      close()
      if (current.current && current.current.status !== 'completed')
        lifeApi.leave(current.current.id, { ...activity.current, sequence: activity.current.sequence + 1 })
    }
    const hide = () => { epoch.current++; leave() }
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted && current.current?.status !== 'completed') {
        if (current.current) {
          setError('connection_closed')
          setPhase('error')
        } else setPhase('setup')
      }
    }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', restore)
    return () => {
      alive.current = false
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', restore)
      leave()
    }
  }, [])

  async function start(character: LifeCharacter, level: string, topicId: string) {
    if (voice.current || interval.current || pendingPlayback.current) return
    const run = ++epoch.current
    const valid = () => alive.current && epoch.current === run
    setError(null)
    setTutorLine('')
    setVisual(initial)
    setPhase('connecting')
    current.current = null
    activity.current = { sequence: 0, speechMilliseconds: 0, speaking: false, tutorSpeaking: false, transcript: '', finish: false }
    let failed = false
    let meter: LifeMeter | null = null
    let latestFrame = 0
    let rms = 0
    let speaking = false
    let tutor = false
    let currentText = ''
    const turns: string[] = []
    let busy = false
    let finishRequested = false
    let lastSend = 0
    let closing = false
    let heardSinceSend = false
    const fail = (reason: unknown) => {
      if (!valid() || failed) return
      failed = true
      close()
      setError(reason)
      setPhase('error')
    }
    const transcript = () => [...turns, currentText].filter(Boolean).join('\n').slice(0, 12_000)
    try {
      const playback = new AudioContext()
      pendingPlayback.current = playback
      const playbackReady = playback.resume().then(() => true, () => false)
      await requestMicrophone()
      if (!valid()) { releaseMicrophone(); return }
      if (!await playbackReady) throw new Error('connect_failed')
      if (!valid()) return
      const created = await lifeApi.start(character, level, topicId)
      if (!valid()) { lifeApi.leave(created.id, { ...activity.current, sequence: 1 }); return }
      current.current = created
      setView(created)
      const ticket = await lifeApi.voice(created.id)
      if (!valid()) return
      const live = new LiveVoiceSession(ticket, {
        onStatus: () => {},
        onConnected: () => {},
        onInputLevel: (volume, active) => {
          rms = volume
          speaking = active
          latestFrame = performance.now()
        },
        onPlayback: (playing) => {
          tutor = playing
          if (valid()) setVisual(old => ({ ...old, tutor: playing }))
        },
        onInputTranscript: (text) => { currentText = text },
        onOutputTranscript: (text) => { if (valid()) setTutorLine(text) },
        onTurnComplete: () => {
          if (currentText.trim()) turns.push(currentText.trim())
          currentText = ''
        },
        onError: fail,
        onDropped: () => fail('connection_closed'),
        onSilenceTimeout: () => {},
        onNoSpeech: () => {},
      }, { continuous: true, playbackContext: playback, respectAudioMute: false })
      voice.current = live
      pendingPlayback.current = null
      await live.start()
      if (!valid() || failed) { await live.close(); return }
      const begun = await lifeApi.begin(created.id)
      if (!valid() || failed) { await live.close(); return }
      current.current = begun
      setView(begun)
      meter = new LifeMeter(performance.now())
      setPhase('playing')

      send.current = async (finish = false) => {
        finishRequested ||= finish
        if (busy || failed || !valid() || !meter || current.current?.status === 'completed') return
        busy = true
        lastSend = performance.now()
        activity.current = {
          sequence: activity.current.sequence + 1,
          speechMilliseconds: Math.min(120_000, Math.floor(meter.speechMs)),
          silenceMilliseconds: Math.min(10_000, Math.floor(meter.silenceMs)),
          speaking: heardSinceSend && !closing,
          tutorSpeaking: tutor && !closing,
          transcript: transcript(), finish: finishRequested,
        }
        heardSinceSend = false
        try {
          const result = await lifeApi.activity(created.id, activity.current)
          if (!valid()) return
          current.current = result
          if (result.status === 'completed') {
            close()
            setView(result)
            setVisual((old) => ({ ...old, score: result.score, energy: result.outcome === 'won' ? 1 : 0, emotion: result.outcome === 'won' ? 'won' : result.outcome === 'silence' ? 'frozen' : 'idle' }))
            setPhase('result')
          }
        } catch (reason) { fail(reason) }
        finally {
          busy = false
          if (finishRequested && !activity.current.finish && !failed) void send.current?.(true)
        }
      }

      interval.current = setInterval(() => {
        if (!meter || !valid() || failed) return
        const now = performance.now()
        const isSpeaking = speaking && now - latestFrame < 300 && !tutor && !closing
        const outcome = meter.advance(now, isSpeaking, tutor)
        heardSinceSend ||= isSpeaking
        setVisual({
          emotion: meter.emotion(isSpeaking), energy: Math.max(0, 1 - meter.silenceMs / 10_000),
          volume: isSpeaking ? Math.min(1, rms * 14) : 0, score: Math.floor(meter.speechMs / 1000), speaking: isSpeaking, tutor,
        })
        if (outcome && !closing) {
          closing = true
          setPhase('saving')
          void voice.current?.close()
          voice.current = null
        }
        if (now - lastSend >= (closing ? 300 : 1000)) void send.current?.()
      }, 100)
    } catch (reason) { fail(reason) }
  }

  async function stop() {
    close()
    setPhase('saving')
    await send.current?.(true)
  }

  async function recover() {
    setError(null)
    setPhase('saving')
    try {
      if (!current.current) { setPhase('setup'); return }
      let result = await lifeApi.get(current.current.id)
      if (result.status !== 'completed')
        result = await lifeApi.activity(result.id, { ...activity.current, sequence: activity.current.sequence + 1, speaking: false, tutorSpeaking: false, finish: true })
      if (!alive.current) return
      current.current = result
      setView(result)
      setPhase('result')
    } catch (reason) { if (alive.current) { setError(reason); setPhase('error') } }
  }

  function reset() {
    epoch.current++
    close()
    current.current = null
    setView(null)
    setTutorLine('')
    setError(null)
    setVisual(initial)
    setPhase('setup')
  }
  return { phase, view, visual, tutorLine, error, start, stop, recover, reset }
}

import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { readAudioPreferences, storeAudioPreferences } from '../../../lib/audio-preferences'
import type { GameCopy } from './copy'

type SoundScene = { listening: boolean; speaking: boolean; completed: boolean; feedback: boolean; playingAudio: boolean; remaining: number }

class FireAmbience {
  private context: AudioContext
  private master: GainNode
  private wind: GainNode
  private fire: GainNode
  private noise: AudioBuffer
  private interval: number
  private stopped = false

  constructor() {
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) throw new Error('audio_unavailable')
    const context = this.context = new Context()
    this.master = context.createGain()
    this.master.gain.value = 0
    this.master.connect(context.destination)
    this.noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
    const samples = this.noise.getChannelData(0)
    let previous = 0
    for (let i = 0; i < samples.length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * .08) / 1.08
      samples[i] = previous * 3
    }
    this.wind = this.texture(420, 'lowpass', .025)
    this.fire = this.texture(1700, 'bandpass', .06)
    this.interval = window.setInterval(() => {
      if (this.stopped || context.state !== 'running') return
      this.crackle()
      if (Math.random() < .12) this.cricket()
    }, 430)
    void context.resume().catch(() => {})
  }

  private texture(frequency: number, type: BiquadFilterType, volume: number) {
    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    const gain = this.context.createGain()
    source.buffer = this.noise
    source.loop = true
    filter.type = type
    filter.frequency.value = frequency
    gain.gain.value = volume
    source.connect(filter).connect(gain).connect(this.master)
    source.start()
    return gain
  }

  private crackle(boost = 1) {
    if (this.stopped) return
    const now = this.context.currentTime
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const filter = this.context.createBiquadFilter()
    source.buffer = this.noise
    filter.type = 'highpass'
    filter.frequency.value = 900 + Math.random() * 2200
    gain.gain.setValueAtTime(.025 * boost, now)
    gain.gain.exponentialRampToValueAtTime(.0001, now + .09)
    source.connect(filter).connect(gain).connect(this.master)
    source.start(now, Math.random())
    source.stop(now + .1)
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
  }

  private cricket() {
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.frequency.value = 4200
    gain.gain.value = 0
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0, now + i * .07)
      gain.gain.linearRampToValueAtTime(.002, now + i * .07 + .01)
      gain.gain.linearRampToValueAtTime(0, now + i * .07 + .04)
    }
    oscillator.connect(gain).connect(this.master)
    oscillator.start(now)
    oscillator.stop(now + .25)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }

  update(scene: SoundScene) {
    if (this.stopped) return
    const now = this.context.currentTime
    this.master.gain.setTargetAtTime(scene.completed || scene.playingAudio ? 0 : scene.listening ? .18 : .55, now, scene.completed ? .8 : .2)
    this.wind.gain.setTargetAtTime(scene.speaking ? .002 : .025, now, .25)
    this.fire.gain.setTargetAtTime(.025 + scene.remaining * .035 + (scene.speaking ? .025 : 0), now, .3)
  }

  reward() { this.crackle(2.5) }

  close() {
    if (this.stopped) return
    this.stopped = true
    window.clearInterval(this.interval)
    void this.context.close().catch(() => {})
  }
}

export function TezGapirAmbience({ copy, listening, transcript, completed, feedback, playingAudio, remaining }: {
  copy: GameCopy; listening: boolean; transcript: string; completed: boolean; feedback: boolean; playingAudio: boolean; remaining: number
}) {
  const [muted, setMuted] = useState(() => readAudioPreferences().muted)
  const [unavailable, setUnavailable] = useState(false)
  const control = useRef<HTMLButtonElement>(null)
  const engine = useRef<FireAmbience | null>(null)
  const scene = useRef<SoundScene>({ listening, speaking: false, completed, feedback, playingAudio, remaining })
  const failed = useRef(false)

  useEffect(() => {
    scene.current = { ...scene.current, listening, speaking: listening && scene.current.speaking, completed, feedback, playingAudio, remaining }
    engine.current?.update(scene.current)
  }, [listening, completed, feedback, playingAudio, remaining])

  useEffect(() => {
    if (!listening || !transcript) return
    scene.current = { ...scene.current, speaking: true }
    engine.current?.update(scene.current)
    const timeout = window.setTimeout(() => {
      scene.current = { ...scene.current, speaking: false }
      engine.current?.update(scene.current)
    }, 1100)
    return () => window.clearTimeout(timeout)
  }, [listening, transcript])

  useEffect(() => { if (feedback) engine.current?.reward() }, [feedback])

  useEffect(() => {
    if (!completed) return
    const timeout = window.setTimeout(() => { engine.current?.close(); engine.current = null }, 3500)
    return () => window.clearTimeout(timeout)
  }, [completed])

  useEffect(() => {
    const surface = control.current?.closest('main')
    function activate() {
      if (readAudioPreferences().muted || document.hidden || scene.current.completed || failed.current) return
      try {
        engine.current ??= new FireAmbience()
        engine.current.update(scene.current)
      } catch { failed.current = true; setUnavailable(true) }
    }
    function visibility() { if (document.hidden) { engine.current?.close(); engine.current = null } }
    surface?.addEventListener('pointerup', activate)
    surface?.addEventListener('keydown', activate)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      surface?.removeEventListener('pointerup', activate)
      surface?.removeEventListener('keydown', activate)
      document.removeEventListener('visibilitychange', visibility)
      engine.current?.close()
      engine.current = null
    }
  }, [])

  function toggle() {
    const next = !muted
    setMuted(next)
    storeAudioPreferences({ ...readAudioPreferences(), muted: next })
    if (next) { engine.current?.close(); engine.current = null }
    else if (!completed) {
      try { engine.current ??= new FireAmbience(); engine.current.update(scene.current) }
      catch { failed.current = true; setUnavailable(true) }
    }
  }

  return <button ref={control} className="tg-sound" type="button" onClick={toggle} aria-label={unavailable ? copy.audioFailed : muted ? copy.tezSoundOn : copy.tezSoundOff} title={unavailable ? copy.audioFailed : muted ? copy.tezSoundOn : copy.tezSoundOff} aria-pressed={!muted && !unavailable} disabled={unavailable}>
    {muted || unavailable ? <VolumeX size={16} /> : <Volume2 size={16} />}
  </button>
}

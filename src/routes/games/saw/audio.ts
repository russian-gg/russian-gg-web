import { api } from '../../../lib/api'
import { deadline } from './dialogue'
import type { SawCharacter } from './model'

type SawCue = 'start' | 'warning' | 'impact' | 'complete' | 'reply'
type VoiceOptions = { onSpeaking?: (speaking: boolean) => void }

export class SawAudio {
  private context: AudioContext
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private monitor: GainNode | null = null
  private samples = new Uint8Array(512)
  private stream: MediaStream | null = null
  private motor: OscillatorNode
  private motorGain: GainNode
  private friction: OscillatorNode
  private frictionGain: GainNode
  private frictionFilter: BiquadFilterNode
  private effectsGain: GainNode
  private voiceGain: GainNode
  private playback: AbortController | null = null
  private grind: AudioBufferSourceNode
  private grindGain: GainNode
  private grindFilter: BiquadFilterNode
  private noise: AudioBuffer
  private character: SawCharacter = 'penguin'
  private dangerStep = 0
  private nextHeartbeat = 0
  private closed = false
  private enabled = true
  private voicing = false

  constructor() {
    const contextClass = typeof AudioContext === 'function'
      ? AudioContext
      : (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!contextClass) throw new Error('audio_unavailable')

    this.context = new contextClass()
    this.effectsGain = this.context.createGain()
    this.effectsGain.gain.value = 0.65
    this.effectsGain.connect(this.context.destination)

    this.motor = this.context.createOscillator()
    this.motor.type = 'sawtooth'
    this.motor.frequency.value = 52
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 235
    this.motorGain = this.context.createGain()
    this.motorGain.gain.value = 0
    this.motor.connect(filter).connect(this.motorGain).connect(this.effectsGain)

    this.friction = this.context.createOscillator()
    this.friction.type = 'sawtooth'
    this.friction.frequency.value = 79
    this.frictionFilter = this.context.createBiquadFilter()
    this.frictionFilter.type = 'bandpass'
    this.frictionFilter.frequency.value = 740
    this.frictionFilter.Q.value = 1.2
    this.frictionGain = this.context.createGain()
    this.frictionGain.gain.value = 0
    this.friction.connect(this.frictionFilter).connect(this.frictionGain).connect(this.effectsGain)

    // Teeth on metal: filtered noise chopped at the rate the teeth pass, so the blade hisses instead of humming.
    this.noise = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate)
    const grain = this.noise.getChannelData(0)
    for (let index = 0; index < grain.length; index++) grain[index] = Math.random() * 2 - 1
    this.grind = this.context.createBufferSource()
    this.grind.buffer = this.noise
    this.grind.loop = true
    this.grindFilter = this.context.createBiquadFilter()
    this.grindFilter.type = 'bandpass'
    this.grindFilter.frequency.value = 2300
    this.grindFilter.Q.value = 2.4
    const chop = this.context.createGain()
    chop.gain.value = 0.55
    this.friction.connect(chop.gain)
    this.grindGain = this.context.createGain()
    this.grindGain.gain.value = 0
    this.grind.connect(this.grindFilter).connect(chop).connect(this.grindGain).connect(this.effectsGain)

    this.voiceGain = this.context.createGain()
    this.voiceGain.gain.value = 0.9
    this.voiceGain.connect(this.context.destination)
    this.motor.start()
    this.friction.start()
    this.grind.start()
    void this.context.resume().catch(() => {})
  }

  async openMicrophone(): Promise<void> {
    if (this.closed) throw new Error('cancelled')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1,
    } })
    if (this.closed) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error('cancelled')
    }
    this.stopMicrophone()
    this.stream = stream
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = this.samples.length
    this.microphone = this.context.createMediaStreamSource(stream)
    this.monitor = this.context.createGain()
    this.monitor.gain.value = 0
    // Keep the analyser in the rendered audio graph without monitoring the microphone through the speakers.
    this.microphone.connect(this.analyser).connect(this.monitor).connect(this.context.destination)
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
  }

  stopMicrophone() {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.microphone?.disconnect()
    this.analyser?.disconnect()
    this.monitor?.disconnect()
    this.microphone = null
    this.analyser = null
    this.monitor = null
  }

  level(): number {
    if (!this.analyser || this.closed) return 0
    this.analyser.getByteTimeDomainData(this.samples)
    let sum = 0
    for (const sample of this.samples) sum += (sample - 128) ** 2
    return Math.min(1, Math.sqrt(sum / this.samples.length) / 24)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (this.closed) return
    if (!enabled) this.playback?.abort()
    const now = this.context.currentTime
    this.voiceGain.gain.setTargetAtTime(enabled ? 0.9 : 0, now, 0.025)
    this.effectsGain.gain.setTargetAtTime(enabled ? 0.65 : 0, now, 0.025)
    if (!enabled) this.setThreat(0, false, true)
    else if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
  }

  setThreat(threat: number, playerSpeaking: boolean, paused: boolean) {
    if (this.closed) return
    const now = this.context.currentTime
    const danger = Math.max(0, Math.min(1, threat / 100))
    const ducking = !this.enabled || paused || this.voicing ? 0 : playerSpeaking ? 0.24 : 1
    const pulse = 0.8 + 0.2 * Math.sin(now * Math.PI * (1.6 + danger * 3.6))
    this.motor.frequency.setTargetAtTime(52 + 112 * danger, now, 0.12)
    this.motorGain.gain.setTargetAtTime((0.022 + 0.06 * danger) * pulse * ducking, now, 0.065)
    this.friction.frequency.setTargetAtTime(79 + 126 * danger, now, 0.12)
    this.frictionFilter.frequency.setTargetAtTime(740 + 820 * danger, now, 0.14)
    this.frictionGain.gain.setTargetAtTime(danger ** 2 * 0.04 * ducking, now, 0.065)
    this.grindFilter.frequency.setTargetAtTime(1900 + 3400 * danger, now, 0.1)
    this.grindGain.gain.setTargetAtTime((0.012 + danger ** 1.6 * 0.11) * ducking, now, 0.06)

    // The same steps the scene uses for fear: each one the blade crosses gets a sting and a gasp.
    const step = paused ? this.dangerStep : threat >= 80 ? 3 : threat >= 55 ? 2 : threat >= 30 ? 1 : 0
    if (!paused && this.enabled && !this.voicing) {
      if (step > this.dangerStep) { this.sting(step); this.gasp(step) }
      else if (step < this.dangerStep) this.relief()
      if (danger >= 0.3 && now >= this.nextHeartbeat) {
        this.heartbeat(now, danger)
        this.nextHeartbeat = now + 1.02 - danger * 0.6
      }
    }
    this.dangerStep = step
  }

  private burst(start: number, duration: number, level: number, from: number, to: number, q = 1.4) {
    const source = this.context.createBufferSource()
    source.buffer = this.noise
    const filter = this.context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = q
    filter.frequency.setValueAtTime(from, start)
    filter.frequency.exponentialRampToValueAtTime(to, start + duration)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + Math.min(0.02, duration / 4))
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    source.connect(filter).connect(gain).connect(this.effectsGain)
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
    source.start(start, Math.random())
    source.stop(start + duration + 0.02)
  }

  private heartbeat(now: number, danger: number) {
    const level = 0.1 + danger * 0.16
    this.tone('sine', 68, 41, now, 0.13, level)
    this.tone('sine', 60, 38, now + 0.16 - danger * 0.04, 0.15, level * 0.72)
  }

  private sting(step: number) {
    const now = this.context.currentTime
    const root = 196 + step * 58
    this.burst(now, 0.22 + step * 0.05, 0.05 + step * 0.03, 5200, 1400, 3)
    this.tone('sawtooth', root, root * 0.97, now, 0.3 + step * 0.06, 0.02 + step * 0.008)
    this.tone('sawtooth', root * 1.06, root * 1.09, now, 0.3 + step * 0.06, 0.02 + step * 0.008)
    this.tone('sine', 58, 31, now, 0.4, 0.13)
  }

  // A wordless yelp in the hero's own register: low grunt, high squeak or a theatrical "oh!".
  private gasp(step: number) {
    const voice = this.character === 'penguin' ? { pitch: 185, formant: 760, level: 0.07 }
      : this.character === 'panda' ? { pitch: 430, formant: 1350, level: 0.035 }
        : { pitch: 290, formant: 1050, level: 0.06 }
    const start = this.context.currentTime + 0.07
    const duration = 0.16 + step * 0.05
    const oscillator = this.context.createOscillator()
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(voice.pitch, start)
    oscillator.frequency.exponentialRampToValueAtTime(voice.pitch * (1.35 + step * 0.22), start + duration * 0.45)
    oscillator.frequency.exponentialRampToValueAtTime(voice.pitch * 1.1, start + duration)
    const formant = this.context.createBiquadFilter()
    formant.type = 'bandpass'
    formant.Q.value = 3.2
    formant.frequency.setValueAtTime(voice.formant * 0.75, start)
    formant.frequency.exponentialRampToValueAtTime(voice.formant * 1.4, start + duration * 0.5)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.001, start)
    gain.gain.exponentialRampToValueAtTime(voice.level * (0.8 + step * 0.25), start + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    oscillator.connect(formant).connect(gain).connect(this.effectsGain)
    oscillator.onended = () => { oscillator.disconnect(); formant.disconnect(); gain.disconnect() }
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
    this.burst(start, duration * 0.8, voice.level * 0.5, voice.formant * 1.6, voice.formant * 2.4, 1.2)
  }

  private relief() {
    const now = this.context.currentTime
    this.burst(now, 0.42, 0.04, 2600, 520, 0.9)
    this.tone('sine', 392, 523, now + 0.05, 0.22, 0.03)
  }

  cue(kind: SawCue) {
    if (!this.enabled || this.closed || this.voicing) return
    const now = this.context.currentTime
    if (kind === 'start') {
      this.tone('triangle', 91, 53, now, 0.22, 0.08)
      this.tone('sine', 318, 250, now + 0.06, 0.25, 0.038)
    } else if (kind === 'warning') {
      this.tone('sine', 112, 82, now, 0.18, 0.072)
      this.tone('sine', 112, 73, now + 0.2, 0.24, 0.051)
    } else if (kind === 'impact') {
      this.tone('triangle', 119, 34, now, 0.52, 0.12)
      this.tone('sawtooth', 681, 182, now, 0.17, 0.046)
      this.tone('sine', 1117, 578, now + 0.012, 0.44, 0.036)
      this.burst(now, 0.7, 0.3, 6200, 380, 0.7)
      this.burst(now + 0.05, 0.34, 0.2, 3100, 2700, 6)
    } else if (kind === 'complete') {
      ;[294, 370, 440].forEach((frequency, index) => {
        this.tone('triangle', frequency, frequency, now + index * 0.085, 0.3, 0.051)
      })
    } else {
      this.tone('sine', 294, 440, now, 0.18, 0.039)
    }
  }

  private tone(type: OscillatorType, from: number, to: number, start: number, duration: number, level: number) {
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, start)
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
    gain.gain.setValueAtTime(0.001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    oscillator.connect(gain).connect(this.effectsGain)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  async speak(text: string, character: SawCharacter, { onSpeaking }: VoiceOptions = {}): Promise<void> {
    this.character = character
    if (!this.enabled || this.closed) return
    this.playback?.abort()
    const playback = new AbortController()
    this.playback = playback
    const { signal } = playback
    const start = () => {
      if (signal.aborted || this.playback !== playback) return
      this.voicing = true
      this.setThreat(0, false, true)
      onSpeaking?.(true)
    }
    const cancel = new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
    try {
      await Promise.race([this.playSpeech(text, character, signal, start), cancel])
    } finally {
      if (this.playback === playback) {
        this.playback = null
        this.voicing = false
        onSpeaking?.(false)
      }
    }
  }

  private async playSpeech(text: string, character: SawCharacter, signal: AbortSignal, start: () => void) {
    const blob = await deadline(api.postBlob('/missions/voice/prompt-audio', { text, character, use: 'feedback' }), 15000)
    if (signal.aborted) return
    const bytes = await blob.arrayBuffer()
    if (signal.aborted) return
    const buffer = await deadline(this.context.decodeAudioData(bytes), 2500)
    if (signal.aborted) return
    if (this.context.state === 'suspended') {
      await deadline(this.context.resume(), 1200)
      if (signal.aborted) return
    }
    await this.playClip(buffer, signal, start)
  }

  private playClip(buffer: AudioBuffer, signal: AbortSignal, start: () => void): Promise<void> {
    const voice = this.context.createBufferSource()
    voice.buffer = buffer
    voice.connect(this.voiceGain)
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => done(new Error('voice_timeout'), true), Math.min(15000, buffer.duration * 1000 + 1800))
      const cancel = () => done(undefined, true)
      const done = (error?: Error, stop = false) => {
        window.clearTimeout(timer)
        signal.removeEventListener('abort', cancel)
        voice.onended = null
        if (stop) {
          try { voice.stop() } catch { /* Already ended. */ }
        }
        voice.disconnect()
        if (error) reject(error)
        else resolve()
      }
      voice.onended = () => done()
      signal.addEventListener('abort', cancel, { once: true })
      try {
        voice.start()
        start()
      } catch {
        done(new Error('voice_start_failed'), true)
      }
    })
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.playback?.abort()
    this.stopMicrophone()
    this.motor.stop()
    this.friction.stop()
    this.grind.stop()
    void this.context.close().catch(() => {})
  }
}

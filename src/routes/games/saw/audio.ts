import { api } from '../../../lib/api'
import { deadline } from './dialogue'
import type { SawCharacter } from './model'

export class SawAudio {
  private context: AudioContext
  private analyser: AnalyserNode | null = null
  private samples = new Uint8Array(256)
  private stream: MediaStream | null = null
  private motor: OscillatorNode
  private motorGain: GainNode
  private voiceGain: GainNode
  private voice: AudioBufferSourceNode | null = null
  private releaseVoice: (() => void) | null = null
  private closed = false
  private enabled = true

  constructor() {
    this.context = new AudioContext()
    this.motor = this.context.createOscillator()
    this.motor.type = 'sawtooth'
    this.motor.frequency.value = 45
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 220
    this.motorGain = this.context.createGain()
    this.motorGain.gain.value = 0
    this.motor.connect(filter).connect(this.motorGain).connect(this.context.destination)
    this.voiceGain = this.context.createGain()
    this.voiceGain.connect(this.context.destination)
    this.motor.start()
    void this.context.resume().catch(() => {})
  }

  async openMicrophone(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    if (this.closed) { stream.getTracks().forEach((track) => track.stop()); throw new Error('cancelled') }
    this.stream = stream
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 512
    this.context.createMediaStreamSource(stream).connect(this.analyser)
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
    if (!this.closed) {
      this.voiceGain.gain.setTargetAtTime(enabled ? 1 : 0, this.context.currentTime, 0.04)
      if (!enabled) this.motorGain.gain.setTargetAtTime(0, this.context.currentTime, 0.04)
    }
  }

  setThreat(threat: number, playerSpeaking: boolean, paused: boolean) {
    if (this.closed) return
    this.motor.frequency.setTargetAtTime(45 + threat * 1.7, this.context.currentTime, 0.15)
    this.motorGain.gain.setTargetAtTime(this.enabled && !paused ? (0.008 + threat * 0.00022) * (playerSpeaking ? 0.3 : 1) : 0, this.context.currentTime, 0.1)
  }

  async speak(text: string, character: SawCharacter): Promise<void> {
    if (!this.enabled || this.closed) return
    const blob = await deadline(api.postBlob('/missions/voice/prompt-audio', { text, character, use: 'feedback' }))
    if (this.closed) return
    const buffer = await this.context.decodeAudioData(await blob.arrayBuffer())
    if (this.closed) return
    const voice = this.context.createBufferSource()
    voice.buffer = buffer
    voice.connect(this.voiceGain)
    this.voice = voice
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => { try { voice.stop() } catch { /* Already ended. */ } done() }, Math.min(20000, buffer.duration * 1000 + 2000))
      const done = () => { clearTimeout(timer); this.releaseVoice = null; this.voice = null; resolve() }
      this.releaseVoice = done
      voice.onended = done
      voice.start()
    })
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.voice?.stop()
    this.releaseVoice?.()
    this.motor.stop()
    void this.context.close().catch(() => {})
  }
}

import { GameSpeech } from '../../../lib/game-speech'

export type SawInputStatus = 'idle' | 'starting' | 'listening' | 'microphone-only'

const START_TIMEOUT_MS = 3000
const CONTINUOUS_SPEECH_TIMEOUT_MS = 4000
const MIN_UTTERANCE_MS = 650
const RESULT_GRACE_MS = 1600
const ACTIVITY_ONSET_MS = 90
const ACTIVITY_RELEASE_MS = 420

export class SawInput {
  private speech: GameSpeech
  private active = false
  private generation = 0
  private fallback = false
  private text = ''
  private startupTimer?: ReturnType<typeof setTimeout>
  private floor = 0.01
  private levelSince?: number
  private lastLoud = -Infinity
  private lastSample?: number
  private heardSpeechMs = 0

  constructor(private onText: (text: string) => void, private onStatus: (status: SawInputStatus) => void) {
    this.speech = new GameSpeech((text) => {
      if (!this.active || this.fallback || text === this.text) return
      this.text = text
      this.heardSpeechMs = 0
      this.onText(text)
    }, (status) => {
      if (!this.active || this.fallback) return
      if (status === 'listening') this.onStatus(status)
      if (status === 'denied' || status === 'failed' || status === 'unavailable') this.useMicrophoneOnly()
    })
  }

  static get supported() {
    return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
  }

  get mode() { return this.fallback ? 'microphone-only' : 'recognition' }

  async start(preserve = false) {
    this.abort()
    this.active = true
    this.text = preserve ? this.text : ''
    this.onText(this.text)
    if (this.fallback || !this.speech.supported) {
      this.useMicrophoneOnly()
      return
    }

    const generation = this.generation
    this.onStatus('starting')
    this.startupTimer = setTimeout(() => this.useMicrophoneOnly(), START_TIMEOUT_MS)
    try {
      await this.speech.start(preserve)
    } catch {
      if (this.active && generation === this.generation && !this.fallback) this.useMicrophoneOnly()
    } finally {
      if (generation === this.generation) clearTimeout(this.startupTimer)
    }
  }

  sample(level: number, now = performance.now()) {
    if (!this.active) return false
    const delta = this.lastSample === undefined ? 0 : Math.min(150, Math.max(0, now - this.lastSample))
    this.lastSample = now
    const aboveFloor = level >= Math.max(0.035, this.floor * 2.8)
    if (aboveFloor) {
      this.levelSince ??= now
      if (now - this.levelSince >= ACTIVITY_ONSET_MS) {
        this.lastLoud = now
        this.heardSpeechMs += delta
        if (!this.fallback && this.heardSpeechMs >= CONTINUOUS_SPEECH_TIMEOUT_MS) this.useMicrophoneOnly()
      }
    } else {
      this.levelSince = undefined
      this.floor += (Math.min(0.08, Math.max(0, level)) - this.floor) * 0.08
      if (!this.fallback && this.heardSpeechMs >= MIN_UTTERANCE_MS && now - this.lastLoud >= RESULT_GRACE_MS) {
        this.useMicrophoneOnly()
      }
    }
    return now - this.lastLoud < ACTIVITY_RELEASE_MS
  }

  async finish(timeoutMs?: number) {
    if (!this.active) return this.text
    const generation = this.generation
    const text = this.fallback ? this.text : await this.speech.finish(timeoutMs)
    if (generation !== this.generation) return this.text
    this.text = text
    this.abort()
    return text
  }

  abort() {
    this.generation++
    this.active = false
    clearTimeout(this.startupTimer)
    this.speech.abort()
    this.levelSince = undefined
    this.lastLoud = -Infinity
    this.lastSample = undefined
    this.heardSpeechMs = 0
    this.onStatus('idle')
  }

  private useMicrophoneOnly() {
    this.fallback = true
    clearTimeout(this.startupTimer)
    this.speech.abort()
    this.onStatus('microphone-only')
  }
}

export type GameSpeechStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'unavailable' | 'failed'

type Result = ArrayLike<{ transcript: string }> & { isFinal: boolean }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: { resultIndex: number; results: ArrayLike<Result> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
}

type Constructor = new () => Recognition
function constructor(): Constructor | undefined {
  const scope = window as unknown as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

export class GameSpeech {
  private recognition: Recognition | null = null
  private finalText = ''
  private interimText = ''
  private enabled = false
  private generation = 0
  private restart: ReturnType<typeof setTimeout> | undefined
  private finishPending: (() => void) | undefined
  private startPending: ((error: Error) => void) | undefined

  constructor(
    private onText: (text: string) => void,
    private onStatus: (status: GameSpeechStatus) => void,
  ) {}

  get supported() { return Boolean(constructor()) }
  get transcript() { return [this.finalText, this.interimText].filter(Boolean).join(' ').trim() }

  async start(preserve = false): Promise<void> {
    const previous = preserve ? this.transcript : ''
    this.abort()
    this.finalText = previous
    this.interimText = ''
    this.onText(previous)
    if (!this.supported) {
      this.onStatus('unavailable')
      throw new Error('speech_unavailable')
    }
    this.enabled = true
    this.onStatus('starting')
    await this.open(this.generation)
  }

  private open(generation: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const Ctor = constructor()
      if (!Ctor || !this.enabled || generation !== this.generation) { reject(new Error('speech_cancelled')); return }
      const recognition = new Ctor()
      this.recognition = recognition
      recognition.lang = 'ru-RU'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      const received = new Set<number>()
      let started = false
      const timer = setTimeout(() => {
        if (!started && generation === this.generation && this.recognition === recognition) {
          this.enabled = false
          this.recognition = null
          this.onStatus('failed')
          recognition.abort()
          reject(new Error('speech_start_timeout'))
        }
      }, 12000)
      this.startPending = (error) => { clearTimeout(timer); reject(error) }
      recognition.onstart = () => {
        clearTimeout(timer)
        if (generation !== this.generation || this.recognition !== recognition || !this.enabled) { recognition.abort(); reject(new Error('speech_cancelled')); return }
        started = true
        this.startPending = undefined
        this.onStatus('listening')
        resolve()
      }
      recognition.onresult = (event) => {
        if (generation !== this.generation || this.recognition !== recognition) return
        const pending: string[] = []
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0]?.transcript.trim()
          if (!text) continue
          if (result.isFinal && !received.has(i)) {
            received.add(i)
            this.finalText = [this.finalText, text].filter(Boolean).join(' ')
          } else if (!result.isFinal) pending.push(text)
        }
        this.interimText = pending.join(' ')
        this.onText(this.transcript)
      }
      recognition.onerror = ({ error }) => {
        clearTimeout(timer)
        if (generation !== this.generation || this.recognition !== recognition) return
        if (error === 'no-speech' && started) return
        if (error === 'aborted' && !this.enabled) return
        this.enabled = false
        this.onStatus(error === 'not-allowed' || error === 'service-not-allowed' ? 'denied' : 'failed')
        reject(new Error(error))
      }
      recognition.onend = () => {
        clearTimeout(timer)
        if (generation !== this.generation || this.recognition !== recognition) return
        this.recognition = null
        this.finalText = this.transcript
        this.interimText = ''
        if (this.finishPending) { this.finishPending(); return }
        if (this.enabled && started) {
          this.restart = setTimeout(() => { void this.open(generation).catch(() => {}) }, 150)
        } else if (!started) {
          this.enabled = false
          reject(new Error('speech_ended'))
        }
      }
      try { recognition.start() } catch (error) {
        clearTimeout(timer)
        this.enabled = false
        this.onStatus('failed')
        reject(error)
      }
    })
  }

  async finish(): Promise<string> {
    this.enabled = false
    clearTimeout(this.restart)
    if (!this.recognition) { this.onStatus('idle'); return this.transcript }
    await new Promise<void>((resolve) => {
      const done = () => { clearTimeout(timer); this.finishPending = undefined; resolve() }
      this.finishPending = done
      const timer = setTimeout(done, 1000)
      try { this.recognition?.stop() } catch { done() }
    })
    const text = this.transcript
    this.abort()
    return text
  }

  abort() {
    this.enabled = false
    this.generation++
    clearTimeout(this.restart)
    this.startPending?.(new Error('speech_cancelled'))
    this.startPending = undefined
    this.finishPending?.()
    const recognition = this.recognition
    this.recognition = null
    if (recognition) {
      recognition.onresult = null
      recognition.onend = null
      recognition.onerror = null
      recognition.onstart = null
      try { recognition.abort() } catch { /* A browser may already have released recognition. */ }
    }
    this.onStatus('idle')
  }
}

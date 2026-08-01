import type { VoiceSessionTicket } from './types'

const INPUT_SAMPLE_RATE = 16_000
const OUTPUT_SAMPLE_RATE = 24_000
const TURN_COMPLETE_TIMEOUT_MS = 40_000
const AUTO_STOP_SILENCE_MS = 2_500
const SPEECH_RMS_THRESHOLD = 0.012

export type LiveVoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'closed'

export interface LiveVoiceCallbacks {
  onStatus: (status: LiveVoiceStatus) => void
  onInputTranscript: (text: string) => void
  onOutputTranscript: (text: string) => void
  onError: (message: string) => void
  onTurnComplete: () => void
  onSilenceTimeout: () => void
}

export class LiveVoiceSession {
  private readonly callbacks: LiveVoiceCallbacks
  private readonly ticket: VoiceSessionTicket
  private readonly systemInstruction: string
  private ws: WebSocket | null = null
  private mediaStream: MediaStream | null = null
  private captureContext: AudioContext | null = null
  private captureSource: MediaStreamAudioSourceNode | null = null
  private captureProcessor: ScriptProcessorNode | null = null
  private playbackContext: AudioContext | null = null
  private nextPlaybackTime = 0
  private recording = false
  private closed = false
  private turnCompletePromise: Promise<void> | null = null
  private resolveTurnComplete: (() => void) | null = null
  private rejectTurnComplete: ((error: Error) => void) | null = null
  private readonly startedAt = Date.now()
  private inputTranscript = ''
  private outputTranscript = ''
  private turnSettled = false
  private playbackDrainTimer: number | null = null
  private autoStopRequested = false
  private heardSpeechThisTurn = false
  private lastSpeechAt = 0

  constructor(ticket: VoiceSessionTicket, systemInstruction: string, callbacks: LiveVoiceCallbacks) {
    this.ticket = ticket
    this.systemInstruction = systemInstruction
    this.callbacks = callbacks
  }

  get elapsedSeconds() {
    return Math.max(0, Math.round((Date.now() - this.startedAt) / 1000))
  }

  get isRecording() {
    return this.recording
  }

  async start() {
    this.callbacks.onStatus('connecting')
    this.playbackContext = new AudioContext()
    if (this.playbackContext.state === 'suspended') {
      await this.playbackContext.resume()
    }

    await this.openWebSocket()
    await this.startMicrophone()
    this.heardSpeechThisTurn = false
    this.autoStopRequested = false
    this.lastSpeechAt = Date.now()
    this.ws?.send(JSON.stringify({ realtimeInput: { activityStart: {} } }))
    this.recording = true
    this.callbacks.onStatus('listening')
  }

  async stopAndAwaitTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    if (this.recording) {
      this.recording = false
      this.autoStopRequested = true
      this.stopMicrophone()
      this.callbacks.onStatus('thinking')
      this.turnSettled = false
      this.turnCompletePromise ??= new Promise<void>((resolve, reject) => {
        this.resolveTurnComplete = resolve
        this.rejectTurnComplete = reject
      })
      this.ws.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }))
    }

    await Promise.race([
      this.turnCompletePromise ?? Promise.resolve(),
      wait(TURN_COMPLETE_TIMEOUT_MS).then(() => {
        throw new Error("Gemini javobi kutilyapti, lekin juda cho'zilib ketdi.")
      }),
    ])
  }

  async close() {
    if (this.closed) return
    this.closed = true
    this.recording = false
    this.stopMicrophone()
    this.resolveTurnComplete?.()
    this.resolveTurnComplete = null
    this.rejectTurnComplete = null
    if (this.playbackDrainTimer !== null) {
      window.clearTimeout(this.playbackDrainTimer)
      this.playbackDrainTimer = null
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'client_closed')
    }
    this.ws = null

    if (this.playbackContext) {
      await this.playbackContext.close().catch(() => {})
      this.playbackContext = null
    }

    this.callbacks.onStatus('closed')
  }

  private async openWebSocket() {
    const wsUrl = buildLiveWebSocketUrl(this.ticket)

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl)
      this.ws = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: toModelResourceName(this.ticket.model),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [{ text: this.systemInstruction }],
            },
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: true,
              },
            },
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Kore',
                  },
                },
              },
            },
          },
        }))
      }

      ws.onmessage = async (event) => {
        try {
          const response = (await parseServerMessage(event.data)) as LiveServerMessage

          if (response.setupComplete) {
            resolve()
            return
          }

          if (response.serverContent) {
            const { serverContent } = response
            if (serverContent.inputTranscription?.text) {
              this.inputTranscript = mergeTranscript(
                this.inputTranscript,
                serverContent.inputTranscription.text,
                'input',
              )
              this.callbacks.onInputTranscript(this.inputTranscript)
            }

            if (serverContent.outputTranscription?.text) {
              this.outputTranscript = mergeTranscript(
                this.outputTranscript,
                serverContent.outputTranscription.text,
                'output',
              )
              this.callbacks.onOutputTranscript(this.outputTranscript)
            }

            for (const part of serverContent.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                this.playAudioChunk(part.inlineData.data)
              }
            }

            // Gemini's audio models can report generation completion before the later
            // turn-complete event that assumes realtime playback finished. We close the
            // learner turn when generation is done and the locally queued audio drained.
            if (serverContent.generationComplete) {
              this.finishTurnAfterPlaybackDrain()
            }

            if (serverContent.turnComplete) {
              this.finishTurn()
            }
          }
        } catch (error) {
          rejectOnce(reject, error)
          this.callbacks.onError("Gemini javobini o'qib bo'lmadi.")
        }
      }

      ws.onerror = () => {
        rejectOnce(reject, new Error('Gemini Live websocket ulanmadi.'))
        this.rejectTurnComplete?.(new Error('Gemini Live websocket ulanmadi.'))
        this.callbacks.onError('Gemini Live websocket ulanmadi.')
      }

      ws.onclose = (event) => {
        if (!this.closed && event.code !== 1000) {
          const reason = event.reason || 'Gemini Live session yopildi.'
          rejectOnce(reject, new Error(reason))
          this.rejectTurnComplete?.(new Error(reason))
          this.callbacks.onError(reason)
        }
      }
    })
  }

  private async startMicrophone() {
    if (!window.isSecureContext) {
      throw new Error("Mikrofon uchun HTTPS kerak. Hozir sayt xavfsiz ulanishda ochilmagan.")
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Brauzer mikrofon API'ni qo'llamayapti.")
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (error) {
      throw new Error(await describeMicrophoneError(error))
    }

    this.captureContext = new AudioContext()
    this.captureSource = this.captureContext.createMediaStreamSource(this.mediaStream)
    this.captureProcessor = this.captureContext.createScriptProcessor(4096, 1, 1)
    this.captureSource.connect(this.captureProcessor)
    this.captureProcessor.connect(this.captureContext.destination)

    this.captureProcessor.onaudioprocess = (event) => {
      if (!this.recording || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return
      }

      const input = event.inputBuffer.getChannelData(0)
      const rms = computeRms(input)
      const now = Date.now()
      if (rms >= SPEECH_RMS_THRESHOLD) {
        this.heardSpeechThisTurn = true
        this.lastSpeechAt = now
      } else if (
        this.heardSpeechThisTurn &&
        !this.autoStopRequested &&
        now - this.lastSpeechAt >= AUTO_STOP_SILENCE_MS
      ) {
        this.autoStopRequested = true
        window.setTimeout(() => this.callbacks.onSilenceTimeout(), 0)
      }

      const pcm16 = downsampleToPcm16(input, this.captureContext?.sampleRate ?? INPUT_SAMPLE_RATE)
      if (pcm16.length === 0) return

      this.ws.send(JSON.stringify({
        realtimeInput: {
          audio: {
            data: bytesToBase64(new Uint8Array(pcm16.buffer)),
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
          },
        },
      }))
    }
  }

  private stopMicrophone() {
    this.captureProcessor?.disconnect()
    this.captureSource?.disconnect()
    this.mediaStream?.getTracks().forEach((track) => track.stop())
    this.captureContext?.close().catch(() => {})

    this.captureProcessor = null
    this.captureSource = null
    this.captureContext = null
    this.mediaStream = null
  }

  private playAudioChunk(base64Pcm: string) {
    if (!this.playbackContext) return

    const bytes = base64ToBytes(base64Pcm)
    const samples = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    if (samples.length === 0) return

    const audioBuffer = this.playbackContext.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE)
    const channel = audioBuffer.getChannelData(0)
    for (let i = 0; i < samples.length; i += 1) {
      channel[i] = samples[i] / 0x8000
    }

    const source = this.playbackContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.playbackContext.destination)

    const startAt = Math.max(this.playbackContext.currentTime, this.nextPlaybackTime)
    source.start(startAt)
    this.nextPlaybackTime = startAt + audioBuffer.duration
  }

  private finishTurnAfterPlaybackDrain() {
    if (this.turnSettled) {
      return
    }

    if (!this.playbackContext) {
      this.finishTurn()
      return
    }

    const remainingMs = Math.max(0, (this.nextPlaybackTime - this.playbackContext.currentTime) * 1000)
    if (this.playbackDrainTimer !== null) {
      window.clearTimeout(this.playbackDrainTimer)
    }

    this.playbackDrainTimer = window.setTimeout(() => {
      this.playbackDrainTimer = null
      this.finishTurn()
    }, Math.ceil(remainingMs) + 120)
  }

  private finishTurn() {
    if (this.turnSettled) {
      return
    }

    this.turnSettled = true
    if (this.playbackDrainTimer !== null) {
      window.clearTimeout(this.playbackDrainTimer)
      this.playbackDrainTimer = null
    }

    this.resolveTurnComplete?.()
    this.turnCompletePromise = null
    this.resolveTurnComplete = null
    this.rejectTurnComplete = null
    this.callbacks.onTurnComplete()
    this.callbacks.onStatus('idle')
  }
}

export function playPromptAudio(text: string) {
  if (!text.trim() || typeof speechSynthesis === 'undefined') {
    return
  }

  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ru-RU'
  utterance.rate = 0.9
  speechSynthesis.speak(utterance)
}

function buildLiveWebSocketUrl(ticket: VoiceSessionTicket) {
  const rawBase = ticket.connectUrl.replace(
    'BidiGenerateContent',
    'BidiGenerateContentConstrained',
  )
  const url = new URL(rawBase)
  url.searchParams.set('access_token', ticket.token)
  return url.toString()
}

function toModelResourceName(model: string) {
  return model.startsWith('models/') ? model : `models/${model}`
}

function downsampleToPcm16(input: Float32Array, sourceRate: number) {
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) {
    return new Int16Array()
  }

  if (sourceRate === INPUT_SAMPLE_RATE) {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i += 1) {
      const sample = clampSample(input[i])
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }
    return output
  }

  const ratio = sourceRate / INPUT_SAMPLE_RATE
  const newLength = Math.round(input.length / ratio)
  const output = new Int16Array(newLength)
  let offsetInput = 0

  for (let i = 0; i < newLength; i += 1) {
    const nextOffset = Math.round((i + 1) * ratio)
    let total = 0
    let count = 0

    for (let j = offsetInput; j < nextOffset && j < input.length; j += 1) {
      total += input[j]
      count += 1
    }

    const sample = clampSample(count === 0 ? 0 : total / count)
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    offsetInput = nextOffset
  }

  return output
}

function clampSample(sample: number) {
  return Math.max(-1, Math.min(1, sample))
}

function computeRms(input: Float32Array) {
  if (input.length === 0) {
    return 0
  }

  let total = 0
  for (let i = 0; i < input.length; i += 1) {
    total += input[i] * input[i]
  }

  return Math.sqrt(total / input.length)
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function rejectOnce(reject: (reason?: unknown) => void, error: unknown) {
  try {
    reject(error)
  } catch {
    // The setup promise may already be resolved; ignore duplicate failures.
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function mergeTranscript(previous: string, incoming: string, mode: 'input' | 'output') {
  const next = sanitizeTranscript(incoming)
  if (!next) {
    return previous
  }

  const current = sanitizeTranscript(previous)
  if (!current) {
    return next
  }

  if (next === current || current.endsWith(next)) {
    return current
  }

  if (next.startsWith(current)) {
    return next
  }

  const overlap = longestOverlap(current, next)
  if (overlap > 0) {
    return `${current}${next.slice(overlap)}`
  }

  // Gemini often sends revised transcript snapshots instead of pure deltas.
  // Replacing on strong divergence avoids accumulating junk characters and mixed fragments.
  if (mode === 'input' && shouldReplaceTranscript(current, next)) {
    return next
  }

  const spacer = /[\s(]$/.test(current) || /^[\s).,!?]/.test(next) ? '' : ' '
  return `${current}${spacer}${next}`
}

function longestOverlap(left: string, right: string) {
  const max = Math.min(left.length, right.length)
  for (let size = max; size > 0; size -= 1) {
    if (left.slice(-size) === right.slice(0, size)) {
      return size
    }
  }

  return 0
}

function sanitizeTranscript(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldReplaceTranscript(current: string, next: string) {
  if (current === next) {
    return false
  }

  if (Math.abs(current.length - next.length) > Math.max(18, Math.min(current.length, next.length))) {
    return true
  }

  const currentWords = new Set(tokenizeTranscript(current))
  const nextWords = tokenizeTranscript(next)
  if (currentWords.size === 0 || nextWords.length === 0) {
    return false
  }

  const shared = nextWords.filter((word) => currentWords.has(word)).length
  return shared <= Math.max(1, Math.floor(nextWords.length * 0.25))
}

function tokenizeTranscript(value: string) {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length > 0)
}

async function describeMicrophoneError(error: unknown) {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : "Mikrofonga ulanib bo'lmadi."
  }

  const permissionState = await readMicrophonePermission()

  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    if (permissionState === 'denied') {
      return "Mikrofon brauzer tomonidan bloklangan. Manzil yonidagi qulf ikonkasini bosing va Microphone uchun Allow ni yoqing, keyin sahifani yangilang."
    }

    return "Mikrofon ruxsati berilmadi. Brauzer chiqqan oynada Allow ni bosing. Agar popup ko'rinmasa, manzil yonidagi qulf ikonkasidan Microphone ni Allow qiling."
  }

  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return "Mikrofon topilmadi. Qurilmada mikrofon ulanganini tekshiring."
  }

  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return "Mikrofonni boshqa dastur ushlab turgan bo'lishi mumkin. Zoom, Telegram yoki boshqa audio dasturlarni yopib qayta urinib ko'ring."
  }

  if (error.name === 'SecurityError') {
    return "Brauzer mikrofonni xavfsizlik sababi bilan blokladi. Sahifani secure link orqali ochib qayta urinib ko'ring."
  }

  return error.message || "Mikrofonga ulanib bo'lmadi."
}

async function readMicrophonePermission(): Promise<PermissionState | null> {
  if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') {
    return null
  }

  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return result.state
  } catch {
    return null
  }
}

async function parseServerMessage(data: Blob | ArrayBuffer | string) {
  if (typeof data === 'string') {
    return JSON.parse(data)
  }

  if (data instanceof Blob) {
    return JSON.parse(await data.text())
  }

  if (data instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(data))
  }

  return JSON.parse(String(data))
}

type LiveServerMessage = {
  setupComplete?: object
  serverContent?: {
    turnComplete?: boolean
    generationComplete?: boolean
    inputTranscription?: { text?: string }
    outputTranscription?: { text?: string }
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          data?: string
          mimeType?: string
        }
      }>
    }
  }
}

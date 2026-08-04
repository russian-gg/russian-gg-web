import { api } from './api'
import type { VoiceSessionTicket } from './types'

const INPUT_SAMPLE_RATE = 16_000
const OUTPUT_SAMPLE_RATE = 24_000
const TURN_COMPLETE_TIMEOUT_MS = 40_000
/** How long to wait for the tutor's opening before letting the learner go first anyway. */
const OPENING_TIMEOUT_MS = 12_000
const AUTO_STOP_SILENCE_MS = 2_500
const SPEECH_RMS_THRESHOLD = 0.006

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
  private readonly openingCue: string
  /** The tutor's own opening turn: it closes nothing the learner said, so it is not a turn. */
  private awaitingOpening = false
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

  constructor(ticket: VoiceSessionTicket, callbacks: LiveVoiceCallbacks) {
    this.ticket = ticket
    this.systemInstruction = ticket.systemInstruction
    this.openingCue = ticket.openingCue
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

    /*
     * Microphone and connection are opened together. They do not depend on each other, and
     * doing them in order put the permission prompt on top of an already-open socket with
     * the session clock running — the learner watched "connecting", then got asked for the
     * microphone, then waited again.
     */
    await Promise.all([this.openMicrophone(), this.openWebSocket()])
    await this.openConversation()
    await this.beginNextTurn()
  }

  /**
   * The tutor's opening turn. The provider answers input and never starts a conversation on
   * its own, so connecting and immediately listening left the learner staring at "Gapiring…"
   * waiting for a question nobody had asked — and whether the tutor ever spoke came down to
   * whether the room was noisy enough to trip the provider's own voice detection.
   *
   * The cue itself comes from the server with the ticket: it is part of the scenario
   * contract, not something the browser should be wording.
   */
  private async openConversation() {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    this.callbacks.onStatus('thinking')
    this.awaitingOpening = true
    this.ensureTurnPromise()

    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: this.openingCue }] }],
        turnComplete: true,
      },
    }))

    // A tutor that fails to open is not a reason to abandon the lesson: the learner can
    // still speak first, so this waits and then moves on rather than throwing.
    await Promise.race([this.turnCompletePromise ?? Promise.resolve(), wait(OPENING_TIMEOUT_MS)])
    this.awaitingOpening = false
  }

  async finishCurrentTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    if (this.recording) {
      // Recording stops; the microphone stays open for the next turn.
      this.recording = false
      this.autoStopRequested = true
      this.callbacks.onStatus('thinking')
      this.turnSettled = false
      this.turnCompletePromise ??= new Promise<void>((resolve, reject) => {
        this.resolveTurnComplete = resolve
        this.rejectTurnComplete = reject
      })
      this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }))
    }

    await Promise.race([
      this.turnCompletePromise ?? Promise.resolve(),
      wait(TURN_COMPLETE_TIMEOUT_MS).then(() => {
        throw new Error("Gemini javobi kutilyapti, lekin juda cho'zilib ketdi.")
      }),
    ])
  }

  async beginNextTurn() {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN || this.recording) {
      return
    }

    // The microphone is already open — it belongs to the session, not to the turn. Acquiring
    // it per turn cost a few hundred milliseconds during which the learner was already
    // speaking, so the first word of every turn after the first was simply not recorded.
    this.heardSpeechThisTurn = false
    this.autoStopRequested = false
    this.lastSpeechAt = Date.now()
    this.inputTranscript = ''
    this.outputTranscript = ''
    this.turnSettled = false
    this.turnCompletePromise = null
    this.resolveTurnComplete = null
    this.rejectTurnComplete = null
    this.recording = true
    this.callbacks.onStatus('listening')
  }

  async close() {
    if (this.closed) return
    this.closed = true
    this.recording = false
    this.teardownCapture()
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
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                /*
                 * Without this the recogniser auto-detects, and an Uzbek speaker's Russian —
                 * accented, hesitant, often a single word — gets detected as something else
                 * entirely. It was returning Devanagari for spoken Russian, which then scored
                 * as a failed turn and left the learner repeating themselves.
                 *
                 * The learner speaks Russian and Russian is what gets scored, so the input is
                 * pinned to it. The tutor's Uzbek support is generated text, not transcribed,
                 * so it is unaffected.
                 */
                languageCode: 'ru-RU',
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
              this.ensureTurnPromise()
              this.outputTranscript = mergeTranscript(
                this.outputTranscript,
                serverContent.outputTranscription.text,
                'output',
              )
              this.callbacks.onOutputTranscript(this.outputTranscript)
            }

            for (const part of serverContent.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                this.ensureTurnPromise()
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

  /**
   * Opened once for the whole session. Capture keeps running between turns and the frames
   * are dropped while `recording` is false, which is what makes a turn boundary instant.
   */
  private async openMicrophone() {
    if (this.mediaStream) {
      return
    }

    this.mediaStream = await requestMicrophone()
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

  /** Ends this session's capture graph and hands the shared stream back. */
  private teardownCapture() {
    this.captureProcessor?.disconnect()
    this.captureSource?.disconnect()
    // The stream is the module's, not this session's: releasing it there is what turns the
    // recording indicator off.
    releaseMicrophone()
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

    /*
     * The turn is over however it ended. The provider runs its own end-of-speech detection
     * and can close a turn while the microphone is still open here — and that path left
     * `recording` true, so the next `beginNextTurn` returned early without resetting
     * anything. The learner's second answer was then appended to the first and the two were
     * scored as one sentence, under a status line that said the session was idle.
     */
    this.recording = false

    if (this.playbackDrainTimer !== null) {
      window.clearTimeout(this.playbackDrainTimer)
      this.playbackDrainTimer = null
    }

    this.resolveTurnComplete?.()
    this.turnCompletePromise = null
    this.resolveTurnComplete = null
    this.rejectTurnComplete = null

    // The opening turn closes nothing: the learner has not spoken yet, so reporting it as a
    // completed turn would submit an empty answer for scoring.
    if (this.awaitingOpening) {
      this.awaitingOpening = false
      this.callbacks.onStatus('idle')
      return
    }

    this.callbacks.onTurnComplete()
    this.callbacks.onStatus('idle')
  }

  private ensureTurnPromise() {
    if (this.turnCompletePromise) {
      return
    }

    this.turnSettled = false
    this.turnCompletePromise = new Promise<void>((resolve, reject) => {
      this.resolveTurnComplete = resolve
      this.rejectTurnComplete = reject
    })
  }
}

/*
 * One microphone stream, owned here rather than by whoever asked first.
 *
 * The press and the session both want it: the press so the permission prompt overlaps the
 * round trip that mints the session, the session so it can capture. Two owners means two
 * getUserMedia calls, and the loser's stream is one nobody ever stops — a recording
 * indicator that stays lit after the lesson ends.
 */
let sharedStream: MediaStream | null = null
let pendingStream: Promise<MediaStream> | null = null

/**
 * Asks for the microphone, or hands back the one already open. Call it on the press, so the
 * permission prompt and the session round trip cost their time together rather than in turn.
 */
export function requestMicrophone(): Promise<MediaStream> {
  if (sharedStream?.active) {
    return Promise.resolve(sharedStream)
  }

  pendingStream ??= openMicrophoneStream()
    .then((stream) => {
      sharedStream = stream
      return stream
    })
    .finally(() => {
      pendingStream = null
    })

  return pendingStream
}

/** Ends the shared stream and turns the recording indicator off. Safe when nothing is open. */
export function releaseMicrophone() {
  sharedStream?.getTracks().forEach((track) => track.stop())
  sharedStream = null
}

async function openMicrophoneStream(): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new Error("Mikrofon uchun HTTPS kerak. Hozir sayt xavfsiz ulanishda ochilmagan.")
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Brauzer mikrofon API'ni qo'llamayapti.")
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
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
}

let promptAudio: HTMLAudioElement | null = null
let promptAudioUrl: string | null = null
let promptAudioText: string | null = null
const promptAudioCache = new Map<string, Blob>()

type PromptAudioState = 'idle' | 'loading' | 'playing'
type PromptAudioCallbacks = {
  onStateChange?: (state: PromptAudioState) => void
}

function setCachedPromptAudio(text: string, blob: Blob) {
  if (promptAudioCache.has(text)) {
    promptAudioCache.delete(text)
  }

  promptAudioCache.set(text, blob)

  while (promptAudioCache.size > 12) {
    const oldestKey = promptAudioCache.keys().next().value
    if (!oldestKey) break
    promptAudioCache.delete(oldestKey)
  }
}

export function isPromptAudioPlaying(text?: string) {
  if (!promptAudio || promptAudio.paused) {
    return false
  }

  return text ? promptAudioText === text.trim() : true
}

export async function playPromptAudio(text: string, callbacks?: PromptAudioCallbacks) {
  const normalized = text.trim()
  if (!normalized) {
    return
  }

  callbacks?.onStateChange?.('loading')
  stopPromptAudio()

  const audioBlob =
    promptAudioCache.get(normalized) ?? await api.postBlob('/missions/voice/prompt-audio', { text: normalized })

  if (!promptAudioCache.has(normalized)) {
    setCachedPromptAudio(normalized, audioBlob)
  }

  const audioUrl = URL.createObjectURL(audioBlob)
  const audio = new Audio(audioUrl)
  promptAudio = audio
  promptAudioUrl = audioUrl
  promptAudioText = normalized

  audio.onended = () => {
    callbacks?.onStateChange?.('idle')
    stopPromptAudio()
  }

  audio.onerror = () => {
    callbacks?.onStateChange?.('idle')
    stopPromptAudio()
  }

  try {
    await audio.play()
    callbacks?.onStateChange?.('playing')
  } catch (error) {
    callbacks?.onStateChange?.('idle')
    stopPromptAudio()
    throw error
  }
}

export function stopPromptAudio() {
  if (promptAudio) {
    promptAudio.pause()
    promptAudio.currentTime = 0
    promptAudio = null
  }

  if (promptAudioUrl) {
    URL.revokeObjectURL(promptAudioUrl)
    promptAudioUrl = null
  }

  promptAudioText = null
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

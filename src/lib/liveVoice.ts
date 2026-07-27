import type { VoiceSessionTicket } from './types'

const INPUT_SAMPLE_RATE = 16_000
const OUTPUT_SAMPLE_RATE = 24_000

export type LiveVoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'closed'

export interface LiveVoiceCallbacks {
  onStatus: (status: LiveVoiceStatus) => void
  onInputTranscript: (text: string) => void
  onOutputTranscript: (text: string) => void
  onError: (message: string) => void
  onTurnComplete: () => void
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
    this.recording = true
    this.callbacks.onStatus('listening')
  }

  async stopAndAwaitTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    if (this.recording) {
      this.recording = false
      this.stopMicrophone()
      this.callbacks.onStatus('thinking')
      this.turnCompletePromise ??= new Promise<void>((resolve, reject) => {
        this.resolveTurnComplete = resolve
        this.rejectTurnComplete = reject
      })
      this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }))
    }

    await Promise.race([
      this.turnCompletePromise ?? Promise.resolve(),
      wait(20_000).then(() => {
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
            responseModalities: ['AUDIO'],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [{ text: this.systemInstruction }],
            },
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Kore',
                },
              },
            },
          },
        }))
      }

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(String(event.data)) as LiveServerMessage

          if (response.setupComplete) {
            resolve()
            return
          }

          if (response.serverContent) {
            const { serverContent } = response
            if (serverContent.inputTranscription?.text) {
              this.callbacks.onInputTranscript(serverContent.inputTranscription.text)
            }

            if (serverContent.outputTranscription?.text) {
              this.callbacks.onOutputTranscript(serverContent.outputTranscription.text)
            }

            for (const part of serverContent.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                this.playAudioChunk(part.inlineData.data)
              }
            }

            if (serverContent.turnComplete) {
              this.resolveTurnComplete?.()
              this.turnCompletePromise = null
              this.resolveTurnComplete = null
              this.rejectTurnComplete = null
              this.callbacks.onTurnComplete()
              this.callbacks.onStatus('idle')
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
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

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

type LiveServerMessage = {
  setupComplete?: object
  serverContent?: {
    turnComplete?: boolean
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

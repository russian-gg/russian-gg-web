import { api } from './api'
import type { VoiceSessionTicket } from './types'

const INPUT_SAMPLE_RATE = 16_000
const OUTPUT_SAMPLE_RATE = 24_000
const TURN_COMPLETE_TIMEOUT_MS = 40_000
/** How long to wait for the tutor's opening before letting the learner go first anyway. */
const OPENING_TIMEOUT_MS = 12_000
/**
 * How long a pause ends the turn. A learner assembling a Russian sentence a word at a time
 * pauses inside it, and 2.5s cut them off mid-thought — this audience more than most.
 */
const AUTO_STOP_SILENCE_MS = 3_500

/**
 * Speech is judged against the room, not against a number. A fixed threshold failed both
 * ways: in a cafe the noise floor sat above it, so the turn never ended, and with a distant
 * microphone a quiet voice never reached it, so the turn never started.
 */
const SPEECH_OVER_NOISE = 2.5
/** Below this it is silence however quiet the room is. Stops a soundproofed room from
 * making the threshold so low that the microphone's own hiss counts as speech. */
const MIN_SPEECH_RMS = 0.004
/** Nothing heard at all for this long: say so rather than listen forever. */
const NO_SPEECH_TIMEOUT_MS = 20_000

export type LiveVoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'closed'

/**
 * What went wrong, as something the interface can translate. This file used to hand back
 * finished Uzbek sentences, which meant a learner reading the app in Russian met the one
 * Uzbek text on the screen at the exact moment something had already gone wrong.
 */
export type VoiceErrorCode =
  | 'connect_failed'
  | 'connection_closed'
  | 'unreadable_response'
  | 'turn_timeout'
  | 'mic_insecure'
  | 'mic_unsupported'
  | 'mic_denied'
  | 'mic_blocked'
  | 'mic_not_found'
  | 'mic_busy'
  | 'mic_security'
  | 'mic_failed'

/** The message is for logs and for `catch` blocks that have no dictionary; the code is for people. */
export class VoiceError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    message: string = code,
  ) {
    super(message)
    this.name = 'VoiceError'
  }
}

export interface LiveVoiceCallbacks {
  onStatus: (status: LiveVoiceStatus) => void
  /** The provider socket finished setup; from here the session has truly reached voice. */
  onConnected: () => void
  onInputTranscript: (text: string) => void
  onOutputTranscript: (text: string) => void
  onError: (code: VoiceErrorCode) => void
  /**
   * The connection dropped after it had been working. Separate from onError because it is
   * recoverable: the caller can mint a fresh ticket and continue the same server session.
   */
  onDropped: () => void
  onTurnComplete: () => void
  onSilenceTimeout: () => void
  /** Nothing was heard at all this turn — usually a muted or wrong input device. */
  onNoSpeech: () => void
}

export class LiveVoiceSession {
  private readonly callbacks: LiveVoiceCallbacks
  private readonly ticket: VoiceSessionTicket
  private readonly systemInstruction: string
  private readonly openingCue: string
  /**
   * A tutor turn that closes nothing the learner said — the opening, or a reply the learner
   * cut short. Reporting either as a completed turn would submit an empty answer for scoring.
   */
  private suppressTurnReport = false
  private ws: WebSocket | null = null
  private mediaStream: MediaStream | null = null
  private captureContext: AudioContext | null = null
  private captureSource: MediaStreamAudioSourceNode | null = null
  private captureProcessor: ScriptProcessorNode | null = null
  private playbackContext: AudioContext | null = null
  /** Everything scheduled but not yet played. Without a handle on these, nothing can stop. */
  private playbackSources: AudioBufferSourceNode[] = []
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
  private turnStartedAt = 0
  private noSpeechReported = false
  /** The room's own level. Starts high so the running minimum converges on the first frames. */
  private noiseFloor = Number.POSITIVE_INFINITY
  /** Set once setup succeeded. A close before this is a failure to connect, not a drop. */
  private connected = false

  /**
   * iOS suspends audio contexts when the app goes to the background and does not resume them
   * on the way back, so a learner who checked a message returned to a tutor that was silent
   * and a microphone that heard nothing, with nothing on screen saying so.
   */
  private readonly resumeAudio = () => {
    if (document.visibilityState !== 'visible' || this.closed) {
      return
    }

    void this.captureContext?.resume().catch(() => {})
    void this.playbackContext?.resume().catch(() => {})
  }

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
    document.addEventListener('visibilitychange', this.resumeAudio)
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

    /*
     * No cue, no message. A server older than this bundle does not put one in the ticket, and
     * sending the turn anyway serialises to `parts: [{}]` — which the provider rejects with
     * 1007 and closes the socket, one message after setup succeeded. The lesson then died on
     * arrival with "the connection dropped", on a deployment where the only thing wrong was
     * that the two halves shipped at different times.
     *
     * Without a cue the tutor simply does not open first, which is how it worked before the
     * cue existed. A newer client degrades against an older server; it does not take the
     * session down with it.
     */
    if (!this.openingCue?.trim()) {
      return
    }

    this.callbacks.onStatus('thinking')
    this.suppressTurnReport = true
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
    this.suppressTurnReport = false
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

    let timer: number | null = null
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(
        () => reject(new VoiceError('turn_timeout')),
        TURN_COMPLETE_TIMEOUT_MS,
      )
    })

    try {
      await Promise.race([this.turnCompletePromise ?? Promise.resolve(), timeout])
    } catch (error) {
      /*
       * The provider never closed the turn. The turn is abandoned rather than left hanging:
       * the promise used to stay armed, so a reply arriving at forty-five seconds still fired
       * and submitted an answer the learner had already been told did not go through.
       */
      this.abandonTurn()
      throw error
    } finally {
      // Also on success: the timer used to keep running for the full forty seconds after
      // every turn that completed normally.
      if (timer !== null) {
        window.clearTimeout(timer)
      }
    }
  }

  /** Writes off the turn in flight so nothing arriving late can close it. */
  private abandonTurn() {
    this.turnSettled = true
    this.turnCompletePromise = null
    this.resolveTurnComplete = null
    this.rejectTurnComplete = null

    if (this.playbackDrainTimer !== null) {
      window.clearTimeout(this.playbackDrainTimer)
      this.playbackDrainTimer = null
    }

    this.stopPlayback()
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
    this.noSpeechReported = false
    this.turnStartedAt = Date.now()
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
    document.removeEventListener('visibilitychange', this.resumeAudio)
    this.teardownCapture()
    this.stopPlayback()
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
                    // The learner's choice, decided on the server. It used to be one name
                    // written here, which no setting could ever have changed.
                    voiceName: this.ticket.voiceName,
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
            this.connected = true
            this.callbacks.onConnected()
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
            /*
             * The provider cut its own turn short — usually because it decided the learner
             * had started talking. Whatever is queued here is the rest of a sentence that is
             * no longer being said, and playing it out is the tutor talking over the learner.
             */
            if (serverContent.interrupted) {
              this.stopPlayback()
            }

            if (serverContent.generationComplete) {
              this.finishTurnAfterPlaybackDrain()
            }

            if (serverContent.turnComplete) {
              this.finishTurn()
            }
          }
        } catch (error) {
          rejectOnce(reject, error)
          this.callbacks.onError('unreadable_response')
        }
      }

      ws.onerror = () => {
        rejectOnce(reject, new VoiceError('connect_failed'))
        this.rejectTurnComplete?.(new VoiceError('connect_failed'))
        this.callbacks.onError('connect_failed')
      }

      ws.onclose = (event) => {
        if (this.closed || event.code === 1000) {
          return
        }

        /*
         * The provider's own reason is kept for the log and never shown: it arrives in
         * English, unlocalised, and usually as a status code. It is logged rather than
         * swallowed because without it a dropped session is unanswerable — the code and the
         * reason are the only things that say whether it was the token, the setup or the
         * network, and they are gone the moment the socket closes.
         */
        console.error(
          `[voice] socket closed: code=${event.code} reason=${event.reason || '(none)'} ` +
            `connected=${this.connected}`,
        )
        const closed = new VoiceError('connection_closed', event.reason || `code ${event.code}`)
        rejectOnce(reject, closed)
        this.rejectTurnComplete?.(closed)

        /*
         * A drop after the session was working is recoverable and is reported as such. A
         * close before setup completed is a failure to connect, and `start()` is still
         * waiting on the promise that was just rejected — reporting both would show the
         * learner an error and then try to reconnect underneath it.
         */
        if (this.connected) {
          this.recording = false
          this.callbacks.onDropped()
        } else {
          this.callbacks.onError('connect_failed')
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
    /*
     * ScriptProcessorNode is deprecated in favour of AudioWorklet, and deliberately kept.
     * A worklet delivers 128 samples per call against this node's 4096, so the swap is not
     * a swap: it needs its own buffering layer between the worklet thread and the socket,
     * inside the one code path where a mistake means the learner's speech is silently
     * mangled. It works in every browser the product targets; this is a planned change with
     * its own testing, not a line to slip into a bug-fixing pass.
     */
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

      /*
       * The noise floor tracks the room: it drops to any quieter frame at once and rises
       * only slowly, so a passing bus does not raise the bar for the rest of the lesson
       * while a genuinely noisier room still moves it within about twenty seconds.
       */
      this.noiseFloor = rms < this.noiseFloor ? rms : this.noiseFloor * 0.995 + rms * 0.005
      const speaking = rms >= Math.max(MIN_SPEECH_RMS, this.noiseFloor * SPEECH_OVER_NOISE)

      if (speaking) {
        this.heardSpeechThisTurn = true
        this.lastSpeechAt = now
      } else if (
        this.heardSpeechThisTurn &&
        !this.autoStopRequested &&
        now - this.lastSpeechAt >= AUTO_STOP_SILENCE_MS
      ) {
        this.autoStopRequested = true
        window.setTimeout(() => this.callbacks.onSilenceTimeout(), 0)
      } else if (
        !this.heardSpeechThisTurn &&
        !this.noSpeechReported &&
        now - this.turnStartedAt >= NO_SPEECH_TIMEOUT_MS
      ) {
        // Silence with nothing before it is not the end of a turn — there is nothing to send.
        // It usually means a muted or wrong microphone, which is worth saying out loud.
        this.noSpeechReported = true
        window.setTimeout(() => this.callbacks.onNoSpeech(), 0)
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
    source.onended = () => {
      this.playbackSources = this.playbackSources.filter((queued) => queued !== source)
    }
    this.playbackSources.push(source)

    const startAt = Math.max(this.playbackContext.currentTime, this.nextPlaybackTime)
    source.start(startAt)
    this.nextPlaybackTime = startAt + audioBuffer.duration
  }

  /**
   * Hands the turn back to the learner mid-reply. The tutor can be long-winded at A0, where
   * every sentence is repeated slowly, and waiting it out was the only option.
   */
  async interruptTutor() {
    if (this.closed || this.recording) {
      return
    }

    this.stopPlayback()
    // Nothing the learner said is being closed here, so this turn is not reported.
    this.suppressTurnReport = true
    this.finishTurn()
    await this.beginNextTurn()
  }

  /** Drops everything scheduled. Sources that already finished throw, which is not a problem. */
  private stopPlayback() {
    for (const source of this.playbackSources) {
      try {
        source.stop()
      } catch {
        // Already ended.
      }
    }

    this.playbackSources = []
    this.nextPlaybackTime = 0
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
    if (this.suppressTurnReport) {
      this.suppressTurnReport = false
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
    throw new VoiceError('mic_insecure')
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new VoiceError('mic_unsupported')
  }

  try {
    return await requestPreferredMicrophoneStream()
  } catch (error) {
    throw new VoiceError(await classifyMicrophoneError(error))
  }
}

async function requestPreferredMicrophoneStream() {
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
    if (!shouldRetryMicrophoneWithPlainAudio(error)) {
      throw error
    }

    /*
     * Cheap Android browsers are the most fragile exactly where this product lives: some of
     * them reject the richer constraint set even though a plain microphone stream works.
     * Voice is better with echo cancellation than without it, but better without it than not
     * at all.
     */
    return await navigator.mediaDevices.getUserMedia({ audio: true })
  }
}

function shouldRetryMicrophoneWithPlainAudio(error: unknown) {
  if (!(error instanceof DOMException)) {
    return false
  }

  return (
    error.name === 'OverconstrainedError'
    || error.name === 'ConstraintNotSatisfiedError'
    || error.name === 'NotReadableError'
  )
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
    // Control characters are exactly what this strips — the rule is about accidents.
    // eslint-disable-next-line no-control-regex
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

/**
 * Which microphone failure this is. The distinction that matters to a learner is between
 * "the browser asked and you said no" and "the browser has it blocked and will not ask
 * again" — the second needs a trip to the address bar, and only the permission state can
 * tell them apart.
 */
async function classifyMicrophoneError(error: unknown): Promise<VoiceErrorCode> {
  if (!(error instanceof DOMException)) {
    return 'mic_failed'
  }

  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return (await readMicrophonePermission()) === 'denied' ? 'mic_blocked' : 'mic_denied'
  }

  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'mic_not_found'
  }

  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'mic_busy'
  }

  if (error.name === 'SecurityError') {
    return 'mic_security'
  }

  return 'mic_failed'
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
    interrupted?: boolean
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

import { api, RequestError } from '../../../lib/api'
import { VoiceError } from '../../../lib/liveVoice'
import type { VoiceSessionTicket } from '../../../lib/types'
import { deadline } from './dialogue'
import type { SawCharacter } from './model'

/*
  The live round: the hero talks and listens over the voice provider, so it answers within a
  second, speaks with its own voice and needs no speech recognition from the browser — which
  is what in-app browsers (Telegram, Instagram) do not have.
*/

export function startSawVoice(character: SawCharacter, level: string, topic: string) {
  return deadline(api.post<VoiceSessionTicket>('/arra/voice', { character, level, topic }), 12000)
}

/** Closes the round on the server so only the seconds actually used count. Safe on page exit. */
export function endSawVoice(sessionId: string) {
  api.postOnExit(`/arra/voice/${sessionId}/end`, {})
}

const UNAVAILABLE_CODES = new Set([
  'voice_daily_limit', 'live_trials_used', 'ai_budget_reached',
  'provider_disabled', 'provider_unavailable', 'provider_not_configured',
])

/**
 * True when a live round cannot be had right now — the voice provider is down, today's live
 * allowance is used, or the server does not offer it yet — and the written game should run.
 */
export function sawVoiceUnavailable(error: unknown): boolean {
  if (error instanceof VoiceError) return !error.code.startsWith('mic_')
  if (!(error instanceof RequestError)) return true
  return error.status === 404 || error.status === 405 || error.status === 409 || error.status >= 500 || UNAVAILABLE_CODES.has(error.code)
}

export function sawMicrophoneError(error: unknown): boolean {
  return error instanceof VoiceError && error.code.startsWith('mic_')
    || error instanceof DOMException && ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError'].includes(error.name)
}

// Private cues for the hero. The server-side brief says what each one means; the wording here
// only has to name the cue and repeat that it is not something the learner said.
const NOT_SPEECH = 'This is a private app signal, not learner speech. Do not read it aloud.'
export const SAW_SIGNALS = {
  silent: `[learner_silent] The learner has gone quiet. ${NOT_SPEECH}`,
  near: `[saw_near] The saw has come close to you. ${NOT_SPEECH}`,
  critical: `[saw_critical] The saw is almost touching you. ${NOT_SPEECH}`,
  won: `[game_result] outcome=won. ${NOT_SPEECH}`,
  lost: `[game_result] outcome=lost. ${NOT_SPEECH}`,
}

/**
 * Sits between the hero's voice and the speakers and reports how loud that voice is, so the
 * mouth on screen opens with the sound instead of flapping at random.
 */
export class SawVoiceMeter {
  readonly input: AnalyserNode
  private gain: GainNode
  private samples: Float32Array<ArrayBuffer>

  constructor(context: AudioContext) {
    this.input = context.createAnalyser()
    this.input.fftSize = 256
    this.input.smoothingTimeConstant = 0
    this.samples = new Float32Array(this.input.fftSize)
    this.gain = context.createGain()
    this.input.connect(this.gain).connect(context.destination)
  }

  setEnabled(enabled: boolean) {
    this.gain.gain.value = enabled ? 1 : 0
  }

  level = () => {
    this.input.getFloatTimeDomainData(this.samples)
    let sum = 0
    for (const sample of this.samples) sum += sample * sample
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 4.5)
  }
}

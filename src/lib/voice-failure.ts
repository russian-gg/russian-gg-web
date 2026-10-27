import { RequestError } from './api'
import type { Dictionary } from './i18n'
import { VoiceError, type VoiceErrorCode } from './liveVoice'

export type MicrophonePermissionCode = Extract<
  VoiceErrorCode,
  'mic_denied' | 'mic_blocked' | 'mic_security'
>

/**
 * Turns whatever was thrown into something in the learner's language. A VoiceError carries a
 * code the dictionary knows; a RequestError already carries a server message in the right
 * language; anything else is ours and gets the caller's fallback rather than a stack message.
 */
export function describeVoiceFailure(caught: unknown, t: Dictionary, fallback: string) {
  if (caught instanceof VoiceError) return t.voiceErrors[caught.code]
  if (caught instanceof RequestError) return caught.message

  return fallback
}

export function isMicrophonePermissionCode(code: VoiceErrorCode): code is MicrophonePermissionCode {
  return code === 'mic_denied' || code === 'mic_blocked' || code === 'mic_security'
}

export function microphonePermissionFailureCode(caught: unknown): MicrophonePermissionCode | null {
  if (!(caught instanceof VoiceError) || !isMicrophonePermissionCode(caught.code)) return null
  return caught.code
}

export interface AudioPreferences {
  muted: boolean
}

const MUTED_KEY = 'rgg.audio-muted'
/**
 * The playback-speed setting this module used to keep. Speed is gone — slowing the tutor's live
 * voice also dropped its pitch — so a value left in a learner's browser is cleared, not obeyed.
 */
const RETIRED_SPEED_KEY = 'rgg.playback-speed'

export function readAudioPreferences(): AudioPreferences {
  try {
    return { muted: localStorage.getItem(MUTED_KEY) === 'true' }
  } catch {
    return { muted: false }
  }
}

export function storeAudioPreferences(preferences: AudioPreferences) {
  try {
    localStorage.setItem(MUTED_KEY, String(preferences.muted))
    localStorage.removeItem(RETIRED_SPEED_KEY)
  } catch {
    // The toggle still works for this render when storage is unavailable.
  }
}

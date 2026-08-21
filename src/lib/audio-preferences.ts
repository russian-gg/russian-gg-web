export const PLAYBACK_SPEEDS = [0.75, 1, 1.25] as const

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export interface AudioPreferences {
  speed: PlaybackSpeed
  muted: boolean
}

const SPEED_KEY = 'rgg.playback-speed'
const MUTED_KEY = 'rgg.audio-muted'

export function readAudioPreferences(): AudioPreferences {
  try {
    const storedSpeed = Number(localStorage.getItem(SPEED_KEY))
    const speed = PLAYBACK_SPEEDS.includes(storedSpeed as PlaybackSpeed)
      ? (storedSpeed as PlaybackSpeed)
      : 1

    return {
      speed,
      muted: localStorage.getItem(MUTED_KEY) === 'true',
    }
  } catch {
    return { speed: 1, muted: false }
  }
}

export function storeAudioPreferences(preferences: AudioPreferences) {
  try {
    localStorage.setItem(SPEED_KEY, String(preferences.speed))
    localStorage.setItem(MUTED_KEY, String(preferences.muted))
  } catch {
    // The controls still work for this render when storage is unavailable.
  }
}

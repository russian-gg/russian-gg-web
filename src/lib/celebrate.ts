import { playUiSound, type UiSound } from './ui-sounds'

/**
 * The feel half of a right answer: a short vibration where the device has one, and a sound.
 * The vibration is skipped under reduced motion. `navigator.vibrate` exists on Android browsers
 * only — iOS Safari has no vibration API, so there the sound is the whole of it.
 */
export function celebrate(pattern: number | number[] = 35, sound: UiSound = 'correct') {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(pattern)
  playUiSound(sound)
}

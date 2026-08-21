import { readAudioPreferences } from './audio-preferences'

export type UiSound = 'click' | 'select' | 'correct' | 'coin' | 'jump' | 'wrong' | 'whoosh' | 'win'

let audioContext: AudioContext | null = null

function context() {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  audioContext ??= new AudioContextClass()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

function tone(
  ctx: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  duration: number,
  volume: number,
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.01, start + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

export function playUiSound(sound: UiSound) {
  if (readAudioPreferences().muted) return
  const ctx = context()
  if (!ctx) return
  const now = ctx.currentTime

  if (sound === 'click') tone(ctx, 'sine', 600, 300, now, 0.05, 0.15)
  if (sound === 'select') tone(ctx, 'triangle', 440, 880, now, 0.08, 0.12)
  if (sound === 'coin') {
    tone(ctx, 'sine', 987.77, 1318.51, now, 0.28, 0.2)
    tone(ctx, 'triangle', 987.77, 1318.51, now, 0.28, 0.08)
  }
  if (sound === 'jump') tone(ctx, 'sine', 220, 600, now, 0.15, 0.2)
  if (sound === 'wrong') tone(ctx, 'sawtooth', 220, 110, now, 0.2, 0.18)
  if (sound === 'whoosh') tone(ctx, 'sine', 300, 600, now, 0.08, 0.1)
  if (sound === 'correct') {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      tone(ctx, 'sine', frequency, frequency, now + index * 0.07, 0.15, 0.15)
    })
  }
  if (sound === 'win') {
    ;[440, 554.37, 659.25, 880].forEach((frequency, index) => {
      tone(ctx, 'triangle', frequency, frequency, now + index * 0.1, 0.3, 0.2)
    })
  }
}


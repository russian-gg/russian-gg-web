export type LifeEmotion = 'idle' | 'speaking' | 'waiting' | 'cold' | 'frozen' | 'won'

export class LifeMeter {
  speechMs = 0
  silenceMs = 0
  elapsedMs = 0
  tutorMs = 0
  private lastAt: number
  constructor(now: number) { this.lastAt = now }

  advance(now: number, speaking: boolean, tutor: boolean) {
    const delta = Math.max(0, Math.min(now - this.lastAt, 120_000 - this.elapsedMs))
    this.lastAt = now
    this.elapsedMs += delta
    const protectedMs = tutor ? Math.min(delta, Math.max(0, 8_000 - this.tutorMs)) : 0
    this.tutorMs = tutor ? this.tutorMs + delta : 0
    if (speaking && !tutor) {
      this.speechMs += delta
      this.silenceMs = 0
    } else {
      this.silenceMs += delta - protectedMs
    }
    return this.silenceMs >= 10_000 ? 'silence' : this.elapsedMs >= 120_000 ? 'won' : null
  }

  emotion(speaking: boolean): LifeEmotion {
    if (this.silenceMs >= 10_000) return 'frozen'
    if (speaking) return 'speaking'
    if (this.silenceMs >= 8_000) return 'cold'
    if (this.silenceMs >= 4_000) return 'waiting'
    return 'idle'
  }
}

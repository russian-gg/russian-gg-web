/**
 * The sound a new customer message makes.
 *
 * Synthesised rather than loaded, because it has to be quiet in a way a file rarely is: two
 * sine tones, a rounded attack and a long decay, at a tenth of full volume. No click, no
 * transient, nothing above 900Hz — the frequencies that make a notification piercing are the
 * ones a person hears fifty times a day and starts to dread.
 *
 * Sine waves specifically: a square or saw carries harmonics far above the note, and those are
 * what make a beep sound like an alarm.
 */
const MUTED_KEY = 'rgg.admin.sales.muted'

let context: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext()

    /*
     * Browsers start this suspended until the page has been interacted with. An operator
     * reading an inbox has clicked something, so this usually resumes on the first attempt —
     * and when it does not, the sound is simply skipped rather than throwing.
     */
    if (context.state === 'suspended') void context.resume()

    return context
  } catch {
    return null
  }
}

export const soundMuted = {
  get: () => localStorage.getItem(MUTED_KEY) === 'true',
  set: (muted: boolean) => localStorage.setItem(MUTED_KEY, String(muted)),
}

/** One note of the chime. Gain is shaped rather than switched, which is what removes the click. */
function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number, peak: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency

  gain.gain.setValueAtTime(0.0001, startAt)
  // Rounded, not instant: a 20ms ramp is inaudible as a ramp and audible as the absence of a
  // click. The decay is exponential because that is how physical things stop sounding.
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

/**
 * Two notes a fourth apart, the second landing while the first is still fading. It reads as
 * one sound rather than two beeps, and a rising pair says "something arrived" where a falling
 * pair says "something went wrong".
 */
export function playIncomingChime() {
  if (soundMuted.get()) return

  const ctx = audio()
  if (!ctx) return

  const now = ctx.currentTime

  tone(ctx, 587.33, now, 0.28, 0.06)
  tone(ctx, 783.99, now + 0.11, 0.34, 0.05)
}

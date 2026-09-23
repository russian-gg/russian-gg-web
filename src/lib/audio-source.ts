/**
 * Picks the smallest recording the browser in front of us can actually decode.
 *
 * The onboarding brief is 22 seconds of speech that used to ship as a 1 MB WAV — on mobile
 * data, a megabyte spent before the learner has said a word. It is now encoded twice by
 * `scripts/optimize-assets.mjs`: Opus at 24 kbps (68 KB) for everything built on Chromium,
 * Firefox or Android, and MP3 at 64 kbps (178 KB) for Safari, which still does not decode
 * Opus in an Ogg container reliably.
 *
 * `canPlayType` answers `''`, `'maybe'` or `'probably'`. Only an outright `''` is treated as
 * a no: a `'maybe'` from a browser that is being careful is still far likelier to play than
 * the fallback is to be needed.
 */
export function pickAudioSource(stem: string): string {
  if (typeof document === 'undefined') return `${stem}.mp3`

  try {
    const probe = document.createElement('audio')
    if (probe.canPlayType('audio/ogg; codecs=opus') !== '') return `${stem}.opus`
  } catch {
    // An environment without a real audio element. MP3 is the safe answer.
  }

  return `${stem}.mp3`
}

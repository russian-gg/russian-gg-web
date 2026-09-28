/**
 * Google's mark, drawn.
 *
 * Its own module because two screens need it — the sign-in button and the linked-account row
 * in settings — and it was a private copy inside one of them.
 *
 * Drawn rather than taken from the icon set: Lucide carries no brand icons, and Google's
 * brand terms require the four colours rather than `currentColor`, so a monochrome glyph is
 * not a substitute. The project's `assets/google-g-dark.svg` is that monochrome version, and
 * `assets/google-g-official.svg` is not usable either — despite the name its palette is
 * #E94FFF magenta and #FF5B8B pink where the real mark is green and yellow.
 *
 * Sized by the caller. `aria-hidden` throughout: every place this appears has "Google" written
 * beside it, so announcing the mark would say the name twice.
 */
export function GoogleMark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.1h12c-.2 1.8-1.5 4.6-4.4 6.4l6.7 5.2C42.2 35.1 45 30 45 24Z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 41.1 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.5 28.4A13.6 13.6 0 0 1 10.8 24c0-1.5.3-3 .7-4.4l-7.1-5.6A22 22 0 0 0 2 24c0 3.6.9 6.9 2.4 9.9l7.1-5.5Z" />
      <path fill="#EA4335" d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.4 29.9 2 24 2 15.4 2 8 6.9 4.4 14l7.1 5.6C13.3 14.3 18.2 10.5 24 10.5Z" />
    </svg>
  )
}

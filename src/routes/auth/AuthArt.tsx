import authArt from '../../assets/images/auth_art.webp'

/**
 * The brand mark and the illustration on the auth screens.
 *
 * The mark is the product's real icon — the blue "gg" tile that ships as the favicon and the
 * PWA icon — rebuilt as type rather than referenced as a PNG, so it stays crisp at any size
 * and picks up the app's own font. The illustration is the supplied render, optimised.
 */

/** The product's icon: a rounded blue tile with the wordmark's own two letters. */
export function BrandMark({ className = 'size-9' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[28%] bg-signal-ink text-white ${className}`}
    >
      {/* Sized from the tile rather than fixed, so one `className` scales the whole mark. */}
      <span className="text-[0.62em] leading-none font-extrabold tracking-[-0.04em]">gg</span>
    </span>
  )
}

/**
 * The welcome illustration: a profile card with the things an account protects around it — a
 * shield, a lock, a verified tick.
 *
 * The supplied render, trimmed to its ink and re-encoded: 1425 KB of PNG became 69 KB of WebP
 * at 800px, which is twice the width it is ever drawn at and therefore sharp on a 2x screen.
 * Trimming matters as much as the encoding here — the source carried a wide band of empty
 * transparency, and without cutting it the picture would have been laid out by its padding
 * rather than by the artwork, sitting small and off-centre in the panel.
 *
 * Decorative: the heading beside it already says what the screen is, so the illustration is
 * marked `alt=""` and hidden from the accessibility tree rather than described.
 *
 * Not lazy. It is the largest thing on the first screen a signed-out learner sees, and the
 * panel it fills is laid out at a fixed size, so deferring it only guarantees the space is
 * empty on arrival.
 */
export function WelcomeArt({ className }: { className?: string }) {
  return (
    <img
      src={authArt}
      alt=""
      aria-hidden="true"
      decoding="async"
      fetchPriority="high"
      className={className}
    />
  )
}

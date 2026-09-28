/**
 * The two emblems at the head of the comparison cards.
 *
 * Drawn rather than taken from Lucide, and the reason is worth stating because reaching for
 * the icon set is the right instinct everywhere else in this product. Lucide's glyphs are
 * outlines: their paths describe a stroked line, not a body. Filling one gives a shape that
 * was never designed to be solid — the crown comes out thin and lopsided, and the gift, whose
 * ribbon and bow are drawn *over* the box rather than cut out of it, collapses into a plain
 * lozenge with a line across it. No amount of stroke tuning fixes that; the outlines are the
 * wrong source material.
 *
 * These two are built as solids from the start. Each takes the colour of the tile it sits on
 * so the ribbon and the crown's band can be knocked back out of the body, which is what gives
 * a filled emblem its detail.
 */

/** A solid crown with its band below it. */
export function CrownGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      {/*
        Five points and a flat foot. The stroke is the same colour as the fill and exists only
        to round the corners — a crown mitred to sharp points reads as a bar chart at 28px.
      */}
      <path
        d="M2.9 7.6 8.3 11.9 12 5.6 15.7 11.9 21.1 7.6 19.6 16.4 4.4 16.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <rect x="4.6" y="18.5" width="14.8" height="2.9" rx="1.45" />
    </svg>
  )
}

/**
 * A solid gift: a bow, a lid and a body, with the ribbon cut out of all three.
 *
 * `knockout` is the tile's own background. The ribbon is not drawn on top of the box — it is
 * the absence of box, which is why the emblem still reads as a wrapped parcel rather than as a
 * box with a stripe painted on it.
 */
export function GiftGlyph({ className, knockout }: { className?: string; knockout: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      {/* The bow, as two loops leaning away from the centre. */}
      <ellipse cx="8.9" cy="4.7" rx="3.1" ry="2.1" transform="rotate(-22 8.9 4.7)" />
      <ellipse cx="15.1" cy="4.7" rx="3.1" ry="2.1" transform="rotate(22 15.1 4.7)" />

      {/* The lid overhangs the body on both sides — that overhang is most of what says
          "parcel" rather than "crate" once the whole thing is one colour. */}
      <rect x="2.4" y="7.3" width="19.2" height="4.5" rx="1.4" />
      <rect x="4.3" y="11.2" width="15.4" height="9.5" rx="1.7" />

      {/*
        Two cuts, and the emblem is nothing without them. The seam separates the lid from the
        body, which would otherwise fuse into one tall slab, and the ribbon runs from between
        the bow's loops to the floor. Both are the tile's own colour: the detail in a solid
        emblem is what has been taken away, not what has been drawn on top.
      */}
      <rect x="2.4" y="11.5" width="19.2" height="1.15" fill={knockout} />
      <rect x="10.85" y="1.6" width="2.3" height="19.4" fill={knockout} />
    </svg>
  )
}

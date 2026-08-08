/**
 * The sidebar's glyphs.
 *
 * Drawn rather than borrowed, in the same register as the learner product's own: a 24-unit
 * box, no fill, the stroke inherited from the text so an active item's icon turns with its
 * label, and shapes built from circles, arcs and lines. No emoji and no icon font — the rule
 * is the product's (PRD §7), and it is what keeps a panel from looking like seven different
 * websites stacked on top of each other.
 *
 * Each one is meant to be told apart at 18px in peripheral vision, which is the only size and
 * the only attention this navigation ever gets. That rules out detail: the difference between
 * these is silhouette, not decoration.
 */
const glyph = 'size-[18px] shrink-0 fill-none stroke-current stroke-[1.7]'

const props = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  className: glyph,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Bars on a baseline: the panel of figures the dashboard is. */
export function DashboardGlyph() {
  return (
    <svg {...props}>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V6M17 20v-9" />
    </svg>
  )
}

/** A head and shoulders, reduced to a circle and an arc. */
export function UsersGlyph() {
  return (
    <svg {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

/** A press, and the ring it sends out. */
export function ClicksGlyph() {
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2" />
      <path d="M6.7 6.7 8.1 8.1M15.9 15.9l1.4 1.4M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4" />
    </svg>
  )
}

/** Rings around a centre: aim, which is what a week of this is. */
export function MarketingGlyph() {
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="0.6" className="fill-current" />
    </svg>
  )
}

/** Two bubbles: a conversation, which is what this inbox is. */
export function SalesGlyph() {
  return (
    <svg {...props}>
      <path d="M15.5 13.5a5.5 5.5 0 0 1-8 4.9L4 19.5l1.1-3.3a5.5 5.5 0 1 1 10.4-2.7Z" />
      <path d="M9.4 8.2A5.5 5.5 0 0 1 20 9.9a5.4 5.4 0 0 1-.6 2.5l.6 2-2-.6" />
    </svg>
  )
}

/** Two lines going opposite ways: money moving. */
export function TransactionsGlyph() {
  return (
    <svg {...props}>
      {/* Both barbs on each head: one alone reads as an unfinished line. */}
      <path d="M4 9h13m0 0-3-3m3 3-3 3" />
      <path d="M20 15H7m0 0 3-3m-3 3 3 3" />
    </svg>
  )
}

/** A node and what it reaches: a model being called. */
export function AiGlyph() {
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="5" cy="6" r="1.6" />
      <circle cx="19" cy="6" r="1.6" />
      <circle cx="12" cy="20" r="1.6" />
      <path d="m6.3 7.1 3.6 3.2M17.7 7.1l-3.6 3.2M12 14.6v3.8" />
    </svg>
  )
}

/** Somebody saying something. */
export function FeedbackGlyph() {
  return (
    <svg {...props}>
      <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4.5 20l1.4-4.4A7.5 7.5 0 1 1 20 12Z" />
    </svg>
  )
}

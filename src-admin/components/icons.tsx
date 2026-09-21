import {
  CreditCard,
  Gamepad2,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  MousePointerClick,
  Pin,
  PinOff,
  SlidersHorizontal,
  Sparkles,
  Star,
  Ticket,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { cx } from '../../src/lib/cx'

/**
 * The panel's glyphs, drawn from Lucide.
 *
 * They were hand-drawn before, in the same register as the learner product's. Lucide is that
 * same register — a 24-unit box, no fill, `currentColor` for the stroke, shapes built from
 * circles, arcs and lines — with a far larger vocabulary and one consistent hand behind it,
 * which is what keeps twelve sidebar entries from looking like twelve different websites.
 *
 * The named wrappers stay. Every call site already says what the icon *means* in this product
 * rather than what it depicts, so swapping the drawing behind `SalesGlyph` never touches a
 * screen — and the next swap will not either.
 *
 * Each one still has to be told apart at 18px in peripheral vision, which is the only size and
 * the only attention this navigation ever gets. That is why the stroke stays at 1.7 rather
 * than Lucide's default 2: at this size the default fills the counters in.
 */
const glyph = 'size-[18px] shrink-0'
const STROKE = 1.7

const props = { 'aria-hidden': true, className: glyph, strokeWidth: STROKE } as const

/** The panel of figures the dashboard is. */
export function DashboardGlyph() {
  return <LayoutDashboard {...props} />
}

export function UsersGlyph() {
  return <Users {...props} />
}

/** What the marketing screens count: a press, not a visit. */
export function ClicksGlyph() {
  return <MousePointerClick {...props} />
}

export function MarketingGlyph() {
  return <Megaphone {...props} />
}

/** The sales agent's screen is a stack of conversations, which is what this says. */
export function SalesGlyph() {
  return <MessagesSquare {...props} />
}

export function TransactionsGlyph() {
  return <CreditCard {...props} />
}

export function AiGlyph() {
  return <Sparkles {...props} />
}

export function FeedbackGlyph() {
  return <MessageSquare {...props} />
}

export function StarGlyph() {
  return <Star {...props} />
}

/*
 * Two sections used to share an icon each with another — games borrowed the clicks glyph and
 * promo codes borrowed transactions — because drawing a distinct one cost an evening. It does
 * not any more, and a sidebar where two rows look the same is a sidebar people misread.
 */
export function GamesGlyph() {
  return <Gamepad2 {...props} />
}

export function PromoGlyph() {
  return <Ticket {...props} />
}

/**
 * Pinned or not. Two different icons rather than one restyled, because the distinction has to
 * survive a greyscale screenshot and a colour-vision difference — a filled pin and an outline
 * pin at 18px do not.
 */
export function PinGlyph({ filled = false }: { filled?: boolean }) {
  const Icon = filled ? Pin : PinOff
  return <Icon {...props} className={cx(glyph, filled && 'fill-current')} />
}

export function SoundGlyph({ on }: { on: boolean }) {
  const Icon = on ? Volume2 : VolumeX
  return <Icon {...props} />
}

export function InboxGlyph() {
  return <Inbox {...props} />
}

export function SlidersGlyph() {
  return <SlidersHorizontal {...props} />
}

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gamepad2,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  MousePointerClick,
  Paperclip,
  Pause,
  Pin,
  PinOff,
  Play,
  Reply,
  SendHorizontal,
  SlidersHorizontal,
  Sparkles,
  Star,
  Ticket,
  Users,
  Volume2,
  VolumeX,
  X,
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

export function TestsGlyph() {
  return <ClipboardCheck {...props} />
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

/** Attach a file to the next message. */
export function AttachGlyph() {
  return <Paperclip {...props} />
}

/** Quote a message in the answer, as a Telegram reply does. */
export function ReplyGlyph() {
  return <Reply {...props} />
}

/**
 * Telegram accepted it. One tick, never two: a bot is never told whether a message was read,
 * and a second tick would claim something nobody knows.
 */
export function SentGlyph() {
  return <Check {...props} className="size-3.5 shrink-0" />
}

export function CloseGlyph() {
  return <X {...props} />
}

/** Back down to the newest message. */
export function LatestGlyph() {
  return <ChevronDown {...props} />
}

export function FileGlyph() {
  return <FileText {...props} />
}

/** Send the payment page to this customer. */
export function PaymentGlyph() {
  return <CreditCard {...props} />
}

export function ArchiveGlyph({ restore = false }: { restore?: boolean }) {
  const Icon = restore ? ArchiveRestore : Archive
  return <Icon {...props} />
}

/** Back to the chat list, on a screen too narrow to show both. */
export function BackGlyph() {
  return <ArrowLeft {...props} />
}

export function SendGlyph() {
  return <SendHorizontal {...props} />
}

export function PlayGlyph({ playing }: { playing: boolean }) {
  const Icon = playing ? Pause : Play
  return <Icon {...props} className={cx(glyph, 'fill-current')} />
}

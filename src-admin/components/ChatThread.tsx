import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { adminFetchBlob, formatDate, formatNumber } from '../lib/api'
import type { ChatMediaKind, ChatSender, SalesMessage } from '../lib/types'
import { cx } from '../../src/lib/cx'
import { AttachGlyph, CloseGlyph, FileGlyph, LatestGlyph, PlayGlyph, ReplyGlyph, SendGlyph, SentGlyph } from './icons'

/*
 * The sales conversation as a messenger draws it: bubbles left and right, files shown rather
 * than described, replies that quote, a line where the unread part begins, and a composer that
 * takes a photo as readily as a sentence. Kept apart from the inbox screen because it is the
 * part an operator actually looks at, and it is long enough to deserve its own file.
 */

/** What Telegram allows a bot to upload. The server says so too; this saves the round trip. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** Close enough to the bottom to count as reading the newest message. */
const STICK_DISTANCE = 80

/** How often the customer is told the operator is typing. Telegram clears it after ~5s. */
const TYPING_EVERY_MS = 4000

const senderName: Record<ChatSender, string> = {
  User: 'Mijoz',
  Ai: 'AI agent',
  Admin: 'Operator',
}

const mediaLabel: Record<ChatMediaKind, string> = {
  None: '',
  Photo: '📷 Rasm',
  Voice: '🎤 Ovozli xabar',
  Audio: '🎵 Audio',
  Video: '🎬 Video',
  VideoNote: '⭕ Video xabar',
  Document: '📎 Fayl',
  Sticker: 'Stiker',
  Animation: 'GIF',
}

const mediaOf = (message: SalesMessage): ChatMediaKind => message.mediaKind ?? 'None'

/** One line that stands for a message in a quote or the reply bar. */
function previewOf(message: SalesMessage) {
  const kind = mediaOf(message)
  if (kind === 'None' || (kind === 'Sticker' && message.text)) return message.text
  return message.text ? `${mediaLabel[kind]} · ${message.text}` : mediaLabel[kind]
}

const time = (value: string) =>
  new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

const dayKey = (value: string) => new Date(value).toDateString()

/** "Bugun" and "Kecha" for the two days anybody refers to that way; a date for the rest. */
function dayLabel(value: string) {
  const day = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (day.toDateString() === today.toDateString()) return 'Bugun'
  if (day.toDateString() === yesterday.toDateString()) return 'Kecha'
  return formatDate(value)
}

const duration = (seconds?: number | null) =>
  seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : ''

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${formatNumber(Math.ceil(bytes / 1024))} KB`

/*
 * Files are fetched once per panel session and shown from blob URLs: an `<img src>` cannot send
 * the session token, and refetching a photo every four seconds because the thread re-polled
 * would be a download per poll. Capped, oldest out, so a long day does not hold every photo
 * anybody sent in memory.
 */
const MEDIA_CACHE_LIMIT = 150
const mediaCache = new Map<string, Promise<string>>()

function loadMedia(messageId: string) {
  const cached = mediaCache.get(messageId)
  if (cached) return cached

  const loading = adminFetchBlob(`/api/admin-portal/sales/messages/${messageId}/media`).then((blob) =>
    URL.createObjectURL(blob),
  )
  // A failure is not remembered, so the retry button actually retries.
  loading.catch(() => mediaCache.delete(messageId))
  mediaCache.set(messageId, loading)

  if (mediaCache.size > MEDIA_CACHE_LIMIT) {
    const [oldest] = mediaCache.keys()
    const evicted = mediaCache.get(oldest)
    mediaCache.delete(oldest)
    void evicted?.then((url) => URL.revokeObjectURL(url)).catch(() => undefined)
  }

  return loading
}

/** Loads a message's file once it scrolls near the screen, not all two hundred at once. */
function useMedia(messageId: string, eager = false) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [visible, setVisible] = useState(eager)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (visible || !node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
      },
      { rootMargin: '300px' },
    )
    observer.observe(node)

    return () => observer.disconnect()
  }, [node, visible])

  useEffect(() => {
    if (!visible) return

    let cancelled = false
    setFailed(false)
    loadMedia(messageId)
      .then((next) => {
        if (!cancelled) setUrl(next)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [messageId, visible, attempt])

  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  return { ref: setNode, url, failed, retry }
}

export function ChatThread({
  messages,
  previousReadAt,
  onReply,
  className,
}: {
  messages: SalesMessage[]
  /** Where reading had got to when this chat was opened; the "new messages" line goes there. */
  previousReadAt?: string | null
  onReply: (message: SalesMessage) => void
  className?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const divider = useRef<HTMLDivElement>(null)
  const stuck = useRef(true)
  const seen = useRef(messages.length)
  const positioned = useRef(false)
  const [atBottom, setAtBottom] = useState(true)
  const [arrived, setArrived] = useState(0)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  /*
   * Fixed for as long as the chat is open. The value comes back with every poll, and after the
   * first one it is "now" — the line would vanish four seconds after the operator saw it.
   */
  const [unreadFrom] = useState(() => {
    const firstUnread = messages.findIndex(
      (message) =>
        message.sender === 'User' && (!previousReadAt || new Date(message.occurredAt) > new Date(previousReadAt)),
    )
    // A line above the very first message marks nothing: everything is new.
    return firstUnread > 0 ? messages[firstUnread].id : null
  })

  const byTelegramId = useMemo(() => {
    const map = new Map<number, SalesMessage>()
    for (const message of messages) {
      if (message.telegramMessageId) map.set(message.telegramMessageId, message)
    }
    return map
  }, [messages])

  const scrollToBottom = useCallback((smooth = false) => {
    const node = scroller.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    stuck.current = true
    setAtBottom(true)
    setArrived(0)
  }, [])

  // Opened at the first unread message, the way a messenger does; at the bottom otherwise.
  useLayoutEffect(() => {
    if (positioned.current || messages.length === 0) return
    positioned.current = true

    if (divider.current && scroller.current) {
      scroller.current.scrollTop = divider.current.offsetTop - 12
      stuck.current = false
      setAtBottom(false)
    } else {
      scrollToBottom()
    }
  }, [messages.length, scrollToBottom])

  /*
   * New messages follow the operator down only if they were already at the bottom, or wrote
   * the message themselves. Somebody reading back through the history is not dragged away
   * from it every time the customer writes; they get a count on the button instead.
   */
  useLayoutEffect(() => {
    const added = messages.length - seen.current
    seen.current = messages.length
    if (added <= 0) return

    const ours = messages[messages.length - 1]?.sender !== 'User'
    if (stuck.current || ours) scrollToBottom()
    else setArrived((current) => current + added)
  }, [messages, scrollToBottom])

  // Photos arrive after the text around them; whoever was at the bottom stays there as they do.
  useEffect(() => {
    const node = content.current
    if (!node) return

    const observer = new ResizeObserver(() => {
      if (stuck.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
    })
    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  function onScroll() {
    const node = scroller.current
    if (!node) return

    const near = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_DISTANCE
    stuck.current = near
    setAtBottom(near)
    if (near) setArrived(0)
  }

  function jumpTo(message: SalesMessage) {
    const node = scroller.current?.querySelector<HTMLElement>(`[data-message="${message.id}"]`)
    if (!node) return

    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(message.id)
    window.setTimeout(() => setFlash((current) => (current === message.id ? null : current)), 1200)
  }

  return (
    /*
      The thread sits on its own tinted ground, as Telegram's wallpaper does, so incoming
      bubbles can be the plain raised surface and still stand off it.
    */
    <div className={cx('relative flex min-h-0 flex-col bg-ground-sunken', className)}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 [scrollbar-width:thin] md:px-6"
      >
        <div ref={content} className="mx-auto max-w-3xl space-y-0.5 py-3">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-faint">Xabar yo'q</p>
          )}

          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const next = messages[index + 1]
            const newDay = !previous || dayKey(previous.occurredAt) !== dayKey(message.occurredAt)
            // The name is said once per run, as a messenger does, not over every bubble.
            const firstOfRun = newDay || previous.sender !== message.sender || message.id === unreadFrom
            // The last of a run gets the tail corner; the rest stack flush, as in Telegram.
            const lastOfRun =
              !next ||
              next.sender !== message.sender ||
              dayKey(next.occurredAt) !== dayKey(message.occurredAt) ||
              next.id === unreadFrom
            const quoted = message.replyToTelegramMessageId
              ? byTelegramId.get(message.replyToTelegramMessageId)
              : undefined

            return (
              <div key={message.id}>
                {newDay && (
                  <div className="sticky top-1 z-1 flex justify-center py-2">
                    <span className="rounded-full bg-ground-raised/90 px-3 py-1 text-xs font-bold text-ink-muted shadow-sm backdrop-blur">
                      {dayLabel(message.occurredAt)}
                    </span>
                  </div>
                )}

                {message.id === unreadFrom && (
                  <div
                    ref={divider}
                    className="-mx-3 my-2 bg-ground-raised/70 py-1 text-center text-xs font-extrabold text-signal-ink md:-mx-6"
                  >
                    Yangi xabarlar
                  </div>
                )}

                <Bubble
                  message={message}
                  showName={firstOfRun}
                  tail={lastOfRun}
                  quoted={quoted}
                  quotedMissing={Boolean(message.replyToTelegramMessageId) && !quoted}
                  flashing={flash === message.id}
                  onReply={() => onReply(message)}
                  onQuoteClick={quoted ? () => jumpTo(quoted) : undefined}
                  onOpenPhoto={setLightbox}
                />
              </div>
            )
          })}
        </div>
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="Eng oxirgi xabarga"
          title="Eng oxirgi xabarga"
          className="absolute right-4 bottom-4 grid size-11 place-items-center rounded-full bg-ground-raised text-ink-muted shadow-lg transition-colors hover:text-ink"
        >
          <LatestGlyph />
          {arrived > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-signal px-1.5 py-0.5 text-center text-[11px] leading-none font-extrabold text-on-signal">
              {arrived > 99 ? '99+' : arrived}
            </span>
          )}
        </button>
      )}

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}

/** Media that fills the bubble edge to edge, with the time laid over it, as Telegram does. */
const VISUAL: ChatMediaKind[] = ['Photo', 'Video', 'Animation']

function Bubble({
  message,
  showName,
  tail,
  quoted,
  quotedMissing,
  flashing,
  onReply,
  onQuoteClick,
  onOpenPhoto,
}: {
  message: SalesMessage
  showName: boolean
  tail: boolean
  quoted?: SalesMessage
  quotedMissing: boolean
  flashing: boolean
  onReply: () => void
  onQuoteClick?: () => void
  onOpenPhoto: (url: string) => void
}) {
  const fromUs = message.sender !== 'User'
  const kind = mediaOf(message)
  // A sticker or a round video is drawn bare, as Telegram draws it — a bubble around it looks
  // like a mistake.
  const bare = kind === 'Sticker' || kind === 'VideoNote'
  const visual = VISUAL.includes(kind)
  const caption = kind === 'Sticker' ? '' : message.text
  const hasQuote = Boolean(quoted || quotedMissing)
  const nameShown = showName && fromUs && !bare

  const stamp = <Stamp message={message} fromUs={fromUs} />

  return (
    <div
      data-message={message.id}
      className={cx(
        'group flex items-end gap-1',
        fromUs ? 'justify-end' : 'justify-start',
        // A gap between runs, none inside one: a run reads as one turn of the conversation.
        showName && 'pt-2',
      )}
    >
      {fromUs && <ReplyButton onReply={onReply} />}

      <div
        className={cx(
          'relative max-w-[min(32rem,85%)] min-w-0 transition-shadow duration-300',
          !bare && 'rounded-2xl shadow-sm',
          !bare && tail && (fromUs ? 'rounded-br-md' : 'rounded-bl-md'),
          !bare &&
            // The agent and a human are both "us" to the customer, and are told apart here
            // because an operator reading back needs to know which one made a promise.
            (message.sender === 'User'
              ? 'bg-ground-raised text-ink'
              : message.sender === 'Ai'
                ? 'bg-signal-soft text-ink'
                : 'bg-milestone-soft text-ink'),
          !bare && (visual && !caption && !nameShown && !hasQuote ? 'p-1' : 'px-3 pt-1.5 pb-2'),
          flashing && 'ring-2 ring-signal',
        )}
      >
        {nameShown && (
          <div
            className={cx(
              'mb-0.5 text-xs font-extrabold',
              message.sender === 'Ai' ? 'text-signal-ink' : 'text-ink-muted',
            )}
          >
            {senderName[message.sender]}
          </div>
        )}

        {hasQuote && (
          <button
            type="button"
            onClick={onQuoteClick}
            disabled={!onQuoteClick}
            className={cx(
              'mb-1 block w-full min-w-0 rounded-lg border-l-[3px] border-signal px-2 py-1 text-left transition-colors disabled:cursor-default',
              fromUs ? 'bg-ground-raised/55 hover:bg-ground-raised/80' : 'bg-signal-soft/60 hover:bg-signal-soft',
            )}
          >
            <span className="block text-xs font-extrabold text-signal-ink">
              {quoted ? senderName[quoted.sender] : 'Xabar'}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              {quoted ? previewOf(quoted) || '—' : 'Avvalgi xabar'}
            </span>
          </button>
        )}

        {kind !== 'None' && (
          <div className={cx('relative', visual && caption && '-mx-2 mb-1')}>
            <MessageMedia message={message} kind={kind} onOpenPhoto={onOpenPhoto} />
            {/* On a photo with nothing under it, the time sits on the picture. */}
            {(visual && !caption) || bare ? (
              <span className="pointer-events-none absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[11px] text-white">
                {time(message.occurredAt)}
                {fromUs && message.telegramMessageId ? <SentGlyph /> : null}
              </span>
            ) : null}
          </div>
        )}

        {caption ? (
          /*
            The time sits inside the last line, as in Telegram: an invisible spacer the width of
            the stamp keeps the text from running under it, and the stamp itself is pinned to
            the corner. A short message stays one line instead of two.
          */
          <p className="text-[15px] leading-snug whitespace-pre-wrap wrap-break-word">
            <Linkified text={caption} />
            <span aria-hidden="true" className={cx('inline-block', fromUs ? 'w-16' : 'w-11')} />
          </p>
        ) : null}

        {caption || (kind !== 'None' && !visual && !bare) ? (
          <span className="absolute right-2.5 bottom-1.5">{stamp}</span>
        ) : null}

        {/* A file with no caption still needs room under it for the stamp. */}
        {!caption && kind !== 'None' && !visual && !bare ? <div className="h-3.5" /> : null}
      </div>

      {!fromUs && <ReplyButton onReply={onReply} />}
    </div>
  )
}

/** The time, and for our messages the tick that says Telegram has it. */
function Stamp({ message, fromUs }: { message: SalesMessage; fromUs: boolean }) {
  return (
    <span
      className="flex items-center gap-0.5 text-[11px] text-ink-faint select-none"
      title={new Date(message.occurredAt).toLocaleString('ru-RU')}
    >
      {time(message.occurredAt)}
      {fromUs && message.telegramMessageId ? (
        <span aria-label="Yetkazildi" className="text-signal-ink">
          <SentGlyph />
        </span>
      ) : null}
    </span>
  )
}

function ReplyButton({ onReply }: { onReply: () => void }) {
  return (
    <button
      type="button"
      onClick={onReply}
      title="Javob berish"
      aria-label="Javob berish"
      className="mb-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ground-sunken hover:text-ink focus-visible:opacity-100"
    >
      <ReplyGlyph />
    </button>
  )
}

function MessageMedia({
  message,
  kind,
  onOpenPhoto,
}: {
  message: SalesMessage
  kind: ChatMediaKind
  onOpenPhoto: (url: string) => void
}) {
  const mime = message.mediaMimeType ?? ''

  // An animated sticker is a Lottie file no browser plays. Its emoji is what it meant.
  if (kind === 'Sticker' && mime === 'application/x-tgsticker') {
    return <span className="block text-6xl leading-none">{message.text || '🙂'}</span>
  }

  // Documents are downloaded on demand: they can be large, and nobody reads a PDF in a bubble.
  if (kind === 'Document') return <DocumentMedia message={message} />

  return <InlineMedia message={message} kind={kind} mime={mime} onOpenPhoto={onOpenPhoto} />
}

function InlineMedia({
  message,
  kind,
  mime,
  onOpenPhoto,
}: {
  message: SalesMessage
  kind: ChatMediaKind
  mime: string
  onOpenPhoto: (url: string) => void
}) {
  const { ref, url, failed, retry } = useMedia(message.id)

  const placeholder = cx(
    'grid place-items-center rounded-xl bg-ground-sunken text-xs text-ink-faint',
    kind === 'VideoNote' ? 'size-48 rounded-full' : kind === 'Sticker' ? 'size-32' : kind === 'Voice' || kind === 'Audio' ? 'h-12 w-64' : 'h-48 w-64',
  )

  if (failed) {
    return (
      <div ref={ref} className={placeholder}>
        <span className="px-3 text-center">
          Faylni ochib bo'lmadi.{' '}
          <button type="button" onClick={retry} className="font-bold text-signal-ink underline">
            Qayta
          </button>
        </span>
      </div>
    )
  }

  if (!url) {
    return (
      <div ref={ref} className={cx(placeholder, 'animate-pulse')}>
        {mediaLabel[kind]}
      </div>
    )
  }

  switch (kind) {
    case 'Photo':
      return (
        <button type="button" onClick={() => onOpenPhoto(url)} className="block" aria-label="Rasmni kattalashtirish">
          <img
            src={url}
            alt=""
            className="max-h-80 max-w-full rounded-xl object-contain"
          />
        </button>
      )

    case 'Sticker':
      return mime.startsWith('video/') ? (
        <video src={url} autoPlay loop muted playsInline className="size-32 object-contain" />
      ) : (
        <img src={url} alt={message.text || 'Stiker'} className="size-32 object-contain" />
      )

    case 'Animation':
      return (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          className="max-h-80 max-w-full rounded-xl"
        />
      )

    case 'VideoNote':
      return <VideoNote url={url} seconds={message.mediaDurationSeconds} />

    case 'Video':
      return (
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          className="max-h-80 max-w-full rounded-xl bg-ground-sunken"
        />
      )

    case 'Voice':
    case 'Audio':
      return (
        <VoicePlayer
          url={url}
          seed={message.id}
          title={kind === 'Audio' ? message.mediaFileName : null}
          seconds={message.mediaDurationSeconds}
        />
      )

    default:
      return null
  }
}

/** How many bars the voice waveform is drawn with. */
const WAVE_BARS = 36

/**
 * A waveform for a voice note. Telegram draws the real one from data the Bot API does not
 * give a bot, so this one is made up — but from the message id, so a note looks the same
 * every time it is opened, and the bars still fill as it plays, which is what they are for.
 */
function waveform(seed: string) {
  let state = 0
  for (const char of seed) state = (state * 31 + char.charCodeAt(0)) >>> 0

  return Array.from({ length: WAVE_BARS }, (_, index) => {
    state = (state * 1103515245 + 12345) >>> 0
    // A soft envelope, so it rises and falls like speech rather than looking like noise.
    const envelope = 0.45 + 0.55 * Math.sin((index / (WAVE_BARS - 1)) * Math.PI)
    return Math.max(0.18, ((state >>> 16) / 65535) * envelope)
  })
}

/**
 * The Telegram voice note: a round play button, a waveform that fills as it plays and can be
 * clicked to seek, and the time. The browser's own player was a toolbar dropped into a speech
 * bubble.
 */
function VoicePlayer({
  url,
  seed,
  title,
  seconds,
}: {
  url: string
  seed: string
  title?: string | null
  seconds?: number | null
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [length, setLength] = useState(seconds ?? 0)
  const bars = useMemo(() => waveform(seed), [seed])
  const progress = length > 0 ? position / length : 0

  function toggle() {
    const node = audio.current
    if (!node) return
    if (node.paused) void node.play()
    else node.pause()
  }

  function seek(event: MouseEvent<HTMLDivElement>) {
    const node = audio.current
    if (!node || !length) return
    const box = event.currentTarget.getBoundingClientRect()
    node.currentTime = ((event.clientX - box.left) / box.width) * length
  }

  return (
    <div className="flex w-72 max-w-full items-center gap-3 py-1">
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setPosition(0)
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        // The file knows its length better than the message did, so it wins once it loads.
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setLength(event.currentTarget.duration)
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "To'xtatish" : 'Tinglash'}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-signal text-on-signal transition-colors hover:bg-signal-hover"
      >
        <PlayGlyph playing={playing} />
      </button>

      <div className="min-w-0 flex-1">
        {title && <div className="mb-0.5 truncate text-sm font-bold text-ink">{title}</div>}
        <div
          role="slider"
          aria-label="Ijro joyi"
          aria-valuemin={0}
          aria-valuemax={Math.round(length)}
          aria-valuenow={Math.round(position)}
          tabIndex={-1}
          onClick={seek}
          className="flex h-6 cursor-pointer items-center gap-[2px]"
        >
          {bars.map((height, index) => (
            <span
              key={index}
              style={{ height: `${Math.round(height * 100)}%` }}
              className={cx(
                'w-[3px] shrink-0 rounded-full transition-colors',
                index / WAVE_BARS < progress ? 'bg-signal' : 'bg-signal/30',
              )}
            />
          ))}
        </div>
        <div className="mt-0.5 text-xs tabular-nums text-ink-faint">
          {duration(Math.round(playing || position > 0 ? position : length))}
        </div>
      </div>
    </div>
  )
}

/** The round video message: plays on a press, as it does in Telegram, with sound. */
function VideoNote({ url, seconds }: { url: string; seconds?: number | null }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  function toggle() {
    const node = video.current
    if (!node) return
    if (node.paused) void node.play()
    else node.pause()
  }

  return (
    <button type="button" onClick={toggle} className="relative block size-48" aria-label={playing ? "To'xtatish" : "Ijro etish"}>
      <video
        ref={video}
        src={url}
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="size-48 rounded-full object-cover"
      />
      {!playing && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ground-raised/90 px-2 py-0.5 text-xs font-bold text-ink">
          ▶ {duration(seconds)}
        </span>
      )}
    </button>
  )
}

function DocumentMedia({ message }: { message: SalesMessage }) {
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const name = message.mediaFileName || 'fayl'

  async function download() {
    setState('loading')
    try {
      const url = await loadMedia(message.id)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      setState('idle')
    } catch {
      setState('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={state === 'loading'}
      className="flex w-64 max-w-full items-center gap-2.5 rounded-xl bg-ground-raised/70 px-2.5 py-2 text-left transition-colors hover:bg-ground-raised disabled:opacity-60"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-signal text-on-signal">
        <FileGlyph />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-ink">{name}</span>
        <span className="block text-xs text-ink-faint">
          {state === 'loading' ? 'Yuklanmoqda…' : state === 'failed' ? "Ochib bo'lmadi — qayta bosing" : 'Yuklab olish'}
        </span>
      </span>
    </button>
  )
}

/** Links in a message are links, as they are in Telegram. Nothing else is interpreted. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)

  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-signal-ink underline underline-offset-2 wrap-anywhere"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rasm"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6"
    >
      <img src={url} alt="" className="max-h-full max-w-full rounded-[var(--radius-card)] object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Yopish"
        className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-ground-raised text-ink"
      >
        <CloseGlyph />
      </button>
    </div>
  )
}

/**
 * Where the operator writes. Text, or a file with the text as its caption; a quoted message
 * above it when replying. Enter sends, Shift+Enter is a new line, and a pasted or dropped
 * screenshot becomes the attachment — the three things anybody used to Telegram will try.
 */
export function Composer({
  busy,
  replyTo,
  onCancelReply,
  onSendText,
  onSendFile,
  onTyping,
  placeholder,
}: {
  busy: boolean
  replyTo: SalesMessage | null
  onCancelReply: () => void
  onSendText: (text: string) => Promise<boolean>
  onSendFile: (file: File, caption: string) => Promise<boolean>
  onTyping: () => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [problem, setProblem] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const lastTyping = useRef(0)

  // A thumbnail for a picked image, released when it is replaced or sent.
  const thumbnail = useMemo(
    () => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file],
  )
  useEffect(() => () => {
    if (thumbnail) URL.revokeObjectURL(thumbnail)
  }, [thumbnail])

  // Replying is a decision to write, so the cursor goes where the writing happens.
  useEffect(() => {
    if (replyTo) textarea.current?.focus()
  }, [replyTo])

  function pick(next: File | null | undefined) {
    if (!next) return
    if (next.size > MAX_UPLOAD_BYTES) {
      setProblem("Fayl 50 MB dan katta — Telegram uni qabul qilmaydi.")
      return
    }
    setProblem('')
    setFile(next)
    textarea.current?.focus()
  }

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(event.target.value)

    const now = Date.now()
    if (event.target.value.trim() && now - lastTyping.current > TYPING_EVERY_MS) {
      lastTyping.current = now
      onTyping()
    }
  }

  async function send() {
    if (busy) return
    const text = draft.trim()

    if (file) {
      if (await onSendFile(file, text)) {
        setFile(null)
        setDraft('')
      }
      return
    }

    if (!text) return
    // Cleared first, as a messenger does; put back if it did not go, so nothing typed is lost.
    setDraft('')
    if (!(await onSendText(text))) setDraft(text)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }

    if (event.key === 'Escape' && replyTo) onCancelReply()
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(event.clipboardData.files)[0]
    if (pasted) {
      event.preventDefault()
      pick(pasted)
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files[0])
  }

  const canSend = !busy && (Boolean(file) || Boolean(draft.trim()))

  // Grows with what is written, one line to six, as Telegram's input does; then it scrolls.
  useLayoutEffect(() => {
    const node = textarea.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }, [draft])

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cx(
        'border-t-2 bg-ground-raised transition-colors',
        dragging ? 'border-signal bg-signal-soft/40' : 'border-hairline',
      )}
    >
      {replyTo && (
        <Strip onClose={onCancelReply} closeLabel="Javobni bekor qilish">
          <ReplyGlyph />
          <span className="min-w-0">
            <span className="block text-xs font-extrabold text-signal-ink">{senderName[replyTo.sender]}ga javob</span>
            <span className="block truncate text-xs text-ink-muted">{previewOf(replyTo) || '—'}</span>
          </span>
        </Strip>
      )}

      {file && (
        <Strip onClose={() => setFile(null)} closeLabel="Faylni olib tashlash">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ground-sunken text-ink-muted">
              <FileGlyph />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-ink">{file.name}</span>
            <span className="block text-xs text-ink-faint">{fileSize(file.size)} · izoh yozish mumkin</span>
          </span>
        </Strip>
      )}

      <div className="flex items-end gap-1 px-2 py-1.5">
        <input
          ref={input}
          type="file"
          className="hidden"
          onChange={(event) => {
            pick(event.target.files?.[0])
            // Cleared so picking the same file again after removing it still fires.
            event.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          title="Fayl biriktirish"
          aria-label="Fayl biriktirish"
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ground-sunken hover:text-ink disabled:opacity-45"
        >
          <AttachGlyph />
        </button>

        <textarea
          ref={textarea}
          value={draft}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder={file ? 'Izoh (ixtiyoriy)' : placeholder}
          className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-snug text-ink [scrollbar-width:thin] placeholder:text-ink-faint focus:outline-none"
        />

        <button
          type="button"
          onClick={() => void send()}
          disabled={!canSend}
          title="Yuborish (Enter)"
          aria-label="Yuborish"
          className={cx(
            'grid size-10 shrink-0 place-items-center rounded-full transition-colors',
            canSend ? 'bg-signal text-on-signal hover:bg-signal-hover' : 'text-ink-faint',
            busy && 'animate-pulse',
          )}
        >
          <SendGlyph />
        </button>
      </div>

      {problem && <p className="px-3 pb-2 text-xs font-bold text-danger">{problem}</p>}
    </div>
  )
}

function Strip({
  children,
  onClose,
  closeLabel,
}: {
  children: ReactNode
  onClose: () => void
  closeLabel: string
}) {
  return (
    <div className="mx-2 mt-2 flex items-center gap-2.5 rounded-lg border-l-[3px] border-signal bg-signal-soft/50 px-3 py-1.5 text-signal-ink">
      {children}
      <button
        type="button"
        onClick={onClose}
        title={closeLabel}
        aria-label={closeLabel}
        className="ml-auto grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-ground-sunken hover:text-ink"
      >
        <CloseGlyph />
      </button>
    </div>
  )
}

/*
 * Telegram's seven avatar colours. Fixed hues rather than theme tokens on purpose: they are
 * how a person is recognised at a glance, so one customer has to be the same colour in the
 * list, in the header and tomorrow — and white initials read on all seven in either theme.
 */
const AVATAR_COLOURS = ['#e17076', '#faa774', '#a695e7', '#7bc862', '#6ec9cb', '#65aadd', '#ee7aae']

/** A round avatar with the person's initials, coloured by their chat so it never changes. */
export function Avatar({ name, seed, size = 'md' }: { name: string; seed: number; size?: 'sm' | 'md' }) {
  const initials =
    name
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '#'

  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: AVATAR_COLOURS[Math.abs(seed) % AVATAR_COLOURS.length] }}
      className={cx(
        'grid shrink-0 place-items-center rounded-full font-extrabold text-white select-none',
        size === 'sm' ? 'size-10 text-sm' : 'size-12 text-base',
      )}
    >
      {initials}
    </span>
  )
}

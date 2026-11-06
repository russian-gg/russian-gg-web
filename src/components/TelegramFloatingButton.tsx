import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Flag, MessageCircle, Send, X } from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { useReportProblem } from '../lib/report-problem'
import { SUPPORT_TELEGRAM_URL, linkedTelegramUrl } from '../lib/support'
import { useT } from '../lib/i18n'
import { PopoverSurface } from './motion'

/*
  Lifted while the install sheet is open. The sheet sets `--install-lift` and nothing else
  does, so the two share a corner without either knowing about the other.
*/
const FAB_POSITION =
  'telegram-fab fixed right-4 bottom-[calc(6rem+var(--install-lift,0px))] z-40 transition-[bottom] duration-300 md:right-6 md:bottom-[calc(1.5rem+var(--install-lift,0px))]'

/**
 * The corner button opens a small Help menu, because Telegram answers a quick question but
 * keeps nothing — a bug report sent there never came back to the app, and the admin's list of
 * requests never saw it. A visitor who is not signed in gets the same menu: the plain bot link,
 * and the feedback sheet, which asks them for a contact instead of an account.
 */
export function TelegramFloatingButton() {
  const { user } = useAuth()
  return <HelpMenuButton guest={!user} />
}

function TelegramFace() {
  return (
    <>
      <span className="telegram-fab__glow" aria-hidden="true" />
      <span className="telegram-fab__surface">
        <img src="/telegram-official-logo.svg" alt="" aria-hidden="true" className="telegram-fab__icon size-full" />
      </span>
    </>
  )
}

function HelpMenuButton({ guest }: { guest: boolean }) {
  const t = useT()
  const copy = t.help
  const report = useReportProblem()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  /*
    The link is minted on press rather than on render: it is single-use and rate limited, and
    most visits never press this. The tab is opened before the request, inside the click,
    because a window opened after an await is one the browser treats as a popup and blocks.
  */
  function openLinkedTelegram(event: MouseEvent<HTMLAnchorElement>) {
    // Linking needs an account; a guest just opens the bot.
    if (guest) {
      setOpen(false)
      return
    }
    event.preventDefault()
    setOpen(false)
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    void linkedTelegramUrl().then((url) => {
      if (tab) tab.location.href = url
      else window.location.assign(url)
    })
  }

  return (
    <div ref={rootRef} className={FAB_POSITION}>
      <PopoverSurface
        open={open}
        className="absolute right-0 bottom-[calc(100%+12px)] w-[min(340px,calc(100vw-2rem))] origin-bottom-right"
      >
        <div
          id={menuId}
          role="dialog"
          aria-label={copy.menuTitle}
          className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-3 shadow-2xl"
        >
          <p className="px-1 pt-1 pb-1 text-base font-extrabold text-ink">{copy.menuTitle}</p>
          <a
            href={SUPPORT_TELEGRAM_URL}
            onClick={openLinkedTelegram}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-hairline p-3 transition-colors hover:border-signal"
          >
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
              <Send className="size-5" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold text-ink">{copy.menuTelegram}</span>
              <span className="block text-xs text-ink-muted">{copy.menuTelegramBody}</span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              report.open()
            }}
            className="flex items-center gap-3 rounded-xl border border-hairline p-3 text-left transition-colors hover:border-signal"
          >
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ground-sunken text-ink">
              {guest ? <MessageCircle className="size-5" strokeWidth={2} /> : <Flag className="size-5" strokeWidth={2} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold text-ink">{guest ? copy.guestTitle : copy.menuReport}</span>
              <span className="block text-xs text-ink-muted">{guest ? copy.guestMenuBody : copy.menuReportBody}</span>
            </span>
          </button>
          {!guest && (
            <Link
              to="/feedback"
              onClick={() => setOpen(false)}
              className="px-1 pt-1 pb-0.5 text-center text-sm font-extrabold text-signal-ink hover:underline"
            >
              {copy.menuMine}
            </Link>
          )}
        </div>
      </PopoverSurface>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? t.common.close : copy.menuOpen}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="relative block"
      >
        {open ? (
          <span className="flex size-14 items-center justify-center rounded-full bg-signal text-on-signal shadow-lg">
            <X aria-hidden="true" className="size-6" strokeWidth={2.4} />
          </span>
        ) : (
          <TelegramFace />
        )}
      </button>
    </div>
  )
}

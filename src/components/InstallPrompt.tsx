import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { useInstallOffer } from '../lib/pwa'

/**
 * Screens the offer stays off.
 *
 * A mission is a live voice conversation and onboarding is the placement test; both are the
 * one thing the learner is doing, and a sheet sliding up over either of them interrupts
 * something that cannot simply be resumed. The timer keeps running — the offer appears on the
 * next ordinary screen instead of being lost.
 */
const BUSY = ['/missions/', '/onboarding']

/**
 * The offer to put Russian.gg on the phone's home screen.
 *
 * A sheet at the bottom rather than a banner at the top: it is a thumb away on a phone, and on
 * iOS it sits directly above the Share button the instructions point at. It arrives a while
 * after the page does — an install prompt over a product somebody has not seen yet is asking
 * for a commitment before showing anything worth committing to.
 *
 * It never appears twice by accident: dismissing it is remembered, installing it hides it for
 * good, and an app already running from the home screen never sees it at all.
 */
export function InstallPrompt() {
  const t = useT()
  const { pathname } = useLocation()
  const { offered: ready, manual, install, dismiss } = useInstallOffer()

  const offered = ready && !BUSY.some((path) => pathname.startsWith(path))

  const sheet = useRef<HTMLDivElement>(null)

  /*
   * The Telegram button sits in the same corner. Rather than have the two overlap, the sheet
   * lifts it while it is open — one variable, read by the button's own class, so neither
   * component has to know about the other's state.
   *
   * Measured rather than guessed: the text wraps to a different number of lines on every
   * screen width and in all three languages, and a fixed offset was wrong on both of the two
   * layouts it had to work in.
   */
  useEffect(() => {
    const element = sheet.current

    const clear = () => document.documentElement.style.removeProperty('--install-lift')

    if (!offered || !element) {
      clear()

      return
    }

    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--install-lift',
        `${Math.round(entry.contentRect.height) + 12}px`,
      )
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
      clear()
    }
  }, [offered])

  if (!offered) return null

  return (
    <div
      role="dialog"
      aria-label={t.install.title}
      /*
       * Above the tab bar on a phone and out of the way of it on a desktop. Pinned to the
       * bottom edge on both, because that is where the thumb is and where Safari's Share
       * button is.
       */
      className="animate-rise fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 md:inset-x-auto md:right-6 md:bottom-6 md:w-96"
      ref={sheet}
    >
      <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-4 shadow-[0_12px_40px_rgb(16_24_40/0.16)]">
        <div className="flex items-start gap-3">
          <img
            src="/icons/icon-192.png"
            alt=""
            aria-hidden="true"
            className="size-11 shrink-0 rounded-[14px]"
          />

          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold text-ink">{t.install.title}</p>
            <p className="text-support mt-0.5">{manual ? t.install.iosBody : t.install.body}</p>
          </div>

          {/* A way out that is not a decision, for somebody who just wants the sheet gone. */}
          <button
            type="button"
            onClick={dismiss}
            aria-label={t.install.close}
            className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-ink-faint transition-colors hover:bg-ground-sunken hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[2.2]">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {manual ? (
            /*
             * No install button on iOS. Safari installs from its own Share menu and from
             * nowhere else, so a button here would do nothing — the sheet says where to tap
             * and gets out of the way.
             */
            <>
              <span className="flex items-center gap-1.5 text-sm font-bold text-signal-ink">
                <ShareGlyph />
                {t.install.iosAction}
              </span>
              <button
                type="button"
                onClick={dismiss}
                className="ml-auto h-10 rounded-[var(--radius-control)] px-4 text-sm font-bold text-ink-muted transition-colors hover:bg-ground-sunken hover:text-ink"
              >
                {t.install.later}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void install()}
                className="h-10 flex-1 rounded-[var(--radius-control)] bg-signal px-5 text-sm font-extrabold text-on-signal transition-colors hover:bg-signal-hover"
              >
                {t.install.action}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="h-10 rounded-[var(--radius-control)] px-4 text-sm font-bold text-ink-muted transition-colors hover:bg-ground-sunken hover:text-ink"
              >
                {t.install.later}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** iOS's own share mark, so the instruction points at something recognisable. */
function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.8]">
      <path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
    </svg>
  )
}

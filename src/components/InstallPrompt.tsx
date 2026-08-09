import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { cx } from '../lib/cx'
import { useT } from '../lib/i18n'
import { useInstallOffer } from '../lib/pwa'

/**
 * Screens the offer stays off.
 *
 * A mission is a live voice conversation, onboarding is the placement test, and the demo is
 * sixty seconds somebody was handed to decide with. Each is the one thing the person is doing,
 * and a sheet sliding up over any of them interrupts something that cannot simply be resumed.
 * The clock keeps running — the offer appears on the next ordinary screen instead of being
 * lost.
 */
const BUSY = ['/missions/', '/onboarding', '/demo/']

/**
 * The offer to put Russian.gg on the phone's home screen.
 *
 * A sheet at the bottom, where a thumb is. It shows on the landing page as readily as inside
 * the app — somebody who has not signed up yet is exactly the person worth having it installed.
 *
 * Pressing the button always does something. Where the browser gives us its install dialog we
 * open it; where it does not — every browser on iOS, and several on Android — the same button
 * opens the two steps for that phone. A button that appears to do nothing reads as broken, and
 * that is what the first version of this did on iOS.
 */
export function InstallPrompt() {
  const t = useT()
  const { pathname } = useLocation()
  const { offered: ready, how, install, dismiss, never, setNever } = useInstallOffer()
  const [showingSteps, setShowingSteps] = useState(false)

  const offered = ready && !BUSY.some((path) => pathname.startsWith(path))
  const sheet = useRef<HTMLDivElement>(null)

  /*
   * The Telegram button sits in the same corner. Rather than have the two overlap, the sheet
   * lifts it while it is open — one variable, read by the button's own class, so neither
   * component has to know about the other's state.
   *
   * Measured rather than guessed: the sheet grows when the steps open, and the text wraps to a
   * different number of lines on every width and in all three languages.
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

  // Closed and reopened a minute later starts from the top, not half-expanded.
  useEffect(() => {
    if (!offered) setShowingSteps(false)
  }, [offered])

  if (!offered) return null

  const steps =
    how === 'ios'
      ? [t.install.iosStep1, t.install.iosStep2]
      : [t.install.androidStep1, t.install.androidStep2]

  async function download() {
    // Where Chrome gave us its dialog, this is a real install. Where it did not, or where the
    // learner turned that dialog down, the steps are the only honest next thing to show.
    const installed = await install()
    if (!installed) setShowingSteps(true)
  }

  return (
    <div
      role="dialog"
      aria-label={t.install.title}
      // Above the tab bar, clear of the home indicator, and clear of the browser's own bar.
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
            <p className="text-support mt-0.5">{t.install.body}</p>
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

        {/*
          Opened by the button rather than shown up front. Two steps under a sheet nobody has
          agreed to yet is a wall of instructions for something they have not said yes to.
        */}
        {showingSteps && (
          <ol className="mt-3 space-y-2 rounded-[var(--radius-card)] bg-ground-sunken p-3">
            <li className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
              {t.install.howTitle}
            </li>
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-2.5 text-sm text-ink">
                <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-signal text-[11px] font-extrabold text-on-signal">
                  {index + 1}
                </span>
                <span className="flex-1">{step}</span>
                {/*
                  The button is named by what it looks like, never by where it is. Safari can
                  put its bar at the top or the bottom, Chrome and Firefox each put theirs
                  somewhere else again, and every Android browser disagrees about the menu —
                  so the drawing is the instruction and the words describe the same shape.
                */}
                {index === 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-lg bg-signal-soft px-1.5 py-1">
                    {how === 'ios' ? (
                      <ShareGlyph />
                    ) : (
                      <>
                        <DotsGlyph />
                        <LinesGlyph />
                      </>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        {/*
          The way out of being asked at all. Every minute is a reasonable cadence for somebody
          who has not decided; for somebody who has decided no, it is nagging, and an offer
          with no off switch is the kind people close the tab over.

          Ticking it is the answer on its own — nothing else has to be pressed.
        */}
        <label className="mt-3 flex cursor-pointer items-center gap-2.5 py-1 select-none">
          <input
            type="checkbox"
            checked={never}
            onChange={(event) => setNever(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={cx(
              'flex size-5 shrink-0 items-center justify-center rounded-[7px] border-2 transition-colors',
              // The real input is off-screen, so the box has to wear its focus ring.
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal',
              never ? 'border-signal bg-signal' : 'border-hairline bg-ground-raised',
            )}
          >
            {never && (
              <svg viewBox="0 0 24 24" className="size-3 fill-none stroke-on-signal stroke-[3.5]">
                <path d="m5 13 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="text-sm text-ink-muted">{t.install.neverShow}</span>
        </label>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void download()}
            className="h-11 flex-1 rounded-[var(--radius-control)] bg-signal px-5 text-sm font-extrabold text-on-signal transition-colors hover:bg-signal-hover"
          >
            {t.install.action}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="h-11 rounded-[var(--radius-control)] px-4 text-sm font-bold text-ink-muted transition-colors hover:bg-ground-sunken hover:text-ink"
          >
            {t.install.later}
          </button>
        </div>
      </div>
    </div>
  )
}

/** iOS's share mark: the shape is the instruction, so it is drawn rather than described. */
function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-signal-ink stroke-[1.8]">
      <path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
    </svg>
  )
}

/** Chrome and Firefox on Android. */
function DotsGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-signal-ink">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

/** Samsung Internet, which is most of the other half of Uzbekistan's Android phones. */
function LinesGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-signal-ink stroke-[2]">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}

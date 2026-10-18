import type { MouseEvent } from 'react'
import { useAuth } from '../lib/auth-context'
import { SUPPORT_TELEGRAM_URL, linkedTelegramUrl } from '../lib/support'
import { useT } from '../lib/i18n'

export function TelegramFloatingButton() {
  const t = useT().dayPreview
  const { user } = useAuth()

  /*
    Signed in, the link is minted on press rather than on render: it is single-use and rate
    limited, and most visits never press this. The tab is opened before the request, inside the
    click, because a window opened after an await is one the browser treats as a popup and
    blocks. Signed out, the plain link in `href` does the work on its own.
  */
  function openLinked(event: MouseEvent<HTMLAnchorElement>) {
    if (!user) return
    event.preventDefault()

    const tab = window.open('', '_blank')
    if (tab) tab.opener = null

    void linkedTelegramUrl().then((url) => {
      if (tab) tab.location.href = url
      else window.location.assign(url)
    })
  }

  return (
    <a
      href={SUPPORT_TELEGRAM_URL}
      onClick={openLinked}
      target="_blank"
      rel="noreferrer"
      aria-label={t.telegram}
      /*
        Lifted while the install sheet is open. The sheet sets `--install-lift` and nothing
        else does, so the two share a corner without either knowing about the other.
      */
      className="telegram-fab fixed right-4 bottom-[calc(6rem+var(--install-lift,0px))] z-40 transition-[bottom] duration-300 md:right-6 md:bottom-[calc(1.5rem+var(--install-lift,0px))]"
    >
      <span className="telegram-fab__glow" aria-hidden="true" />
      <span className="telegram-fab__surface">
        <img
          src="/telegram-official-logo.svg"
          alt=""
          aria-hidden="true"
          className="telegram-fab__icon size-full"
        />
      </span>
    </a>
  )
}

import { SUPPORT_TELEGRAM_URL } from '../lib/support'
import { useT } from '../lib/i18n'

export function TelegramFloatingButton() {
  const t = useT().dayPreview
  return (
    <a
      href={SUPPORT_TELEGRAM_URL}
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

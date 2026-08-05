const TELEGRAM_URL = 'https://t.me/russian_gg'

export function TelegramFloatingButton() {
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Telegram orqali bog'lanish"
      className="telegram-fab fixed right-4 bottom-24 z-40 md:right-6 md:bottom-6"
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

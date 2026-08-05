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
        <TelegramGlyph />
      </span>
    </a>
  )
}

function TelegramGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-7 md:size-8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M21.152 4.554a1.5 1.5 0 0 0-1.582-.229L3.34 11.169a1.5 1.5 0 0 0 .087 2.801l4.118 1.498 1.498 4.118a1.5 1.5 0 0 0 2.801.087l6.844-16.23a1.5 1.5 0 0 0-.229-1.582 1.5 1.5 0 0 0-1.307-.44Z"
        fill="currentColor"
      />
      <path
        d="m9.102 15.004 1.117 3.068 2.515-5.954 5.954-2.515-9.586 5.4Z"
        fill="#D7ECFF"
      />
    </svg>
  )
}

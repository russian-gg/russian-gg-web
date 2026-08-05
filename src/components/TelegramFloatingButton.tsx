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
      viewBox="0 0 240 240"
      className="size-7 md:size-8"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="translate(10 8) scale(1.13)">
        <path
          d="M180.53 74.11 69.42 116.95c-7.58 3.05-7.54 7.28-1.39 9.16l28.51 8.9 10.98 34.24c1.34 3.72.68 5.2 4.6 5.2 3.02 0 4.35-1.38 6.03-3.02 1.05-1.02 7.25-7.05 13.78-13.4l28.66 21.17c5.29 2.92 9.11 1.42 10.42-4.9l18.93-89.2c1.92-7.73-2.95-11.24-9.39-8.31ZM103.4 132.96l62.65-39.53c3.12-1.9 5.98-.88 3.64 1.2l-51.73 46.71-2.01 21.4-12.55-29.78Z"
          fill="#FFF"
        />
      </g>
    </svg>
  )
}

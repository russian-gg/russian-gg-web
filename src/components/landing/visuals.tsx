import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { PlayGlyph } from '../ui'
import { VoiceSignal } from '../VoiceSignal'

/**
 * The landing page's illustrations. Everything here obeys the same rule the rest of the
 * product does (PRD §7): abstract line, circle, signal and wave motifs — no emoji, no
 * mascots, no glossy 3D. The one photograph allowed anywhere is the tutor's portrait, and
 * it appears once, inside the product mock, exactly as it does in the real mission player.
 *
 * These are decorative, so they are `aria-hidden`; the surrounding copy carries the meaning.
 */

/** A phone silhouette drawn from tokens. Wraps a real slice of the app so the mock cannot
 *  drift from the product. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'relative mx-auto w-full max-w-[19rem] rounded-[2.75rem] border border-hairline',
        'bg-ground p-3 shadow-[0_30px_60px_-24px_rgb(45_118_221/0.35)]',
        className,
      )}
    >
      {/* The pill speaker, the one nod to a device. */}
      <div className="absolute inset-x-0 top-3 z-10 flex justify-center">
        <span className="h-1.5 w-16 rounded-full bg-ground-sunken" />
      </div>
      <div className="overflow-hidden rounded-[2rem] border border-hairline bg-ground-raised">
        {children}
      </div>
    </div>
  )
}

/**
 * The hero's product preview: a single mission turn, drawn from the same pieces the mission
 * player uses — day badge, tutor prompt in Russian, Uzbek support beneath it, the listening
 * signal, and one high-emphasis action.
 */
export function ProductPreview({
  day,
  objective,
  hint,
  action,
}: {
  day: string
  objective: string
  hint: string
  action: string
}) {
  return (
    <PhoneFrame>
      <div className="flex flex-col gap-5 px-5 pt-9 pb-6">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center rounded-[var(--radius-control)] bg-signal-soft px-3 py-1 text-xs font-extrabold tracking-[0.08em] text-signal-ink uppercase">
            {day}
          </span>
          <span className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
            {objective}
          </span>
        </div>

        {/* The tutor turn. The Cyrillic here is the content being learned, not chrome. */}
        <div className="flex items-start gap-3">
          <img
            src="/tutor-avatar.jpg"
            alt=""
            aria-hidden="true"
            className="size-9 shrink-0 rounded-full object-cover"
          />
          <div className="rounded-2xl rounded-tl-sm border border-hairline bg-ground-sunken px-4 py-3">
            <p lang="ru" className="text-[15px] leading-snug font-bold text-ink">
              Здравствуйте! Как вас зовут?
            </p>
          </div>
        </div>

        <p className="text-support -mt-1 pl-12">{hint}</p>

        <div className="mt-1 flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-ground px-4 py-6">
          <VoiceSignal state="listening" size="sm" labelled={false} />
          <span className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-signal px-6 text-sm font-extrabold text-on-signal shadow-[0_4px_0_0_var(--color-signal-depth)]">
            <MicGlyph />
            {action}
          </span>
        </div>

        {/* Step progress, the way the real player shows it — no competing metric. */}
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-8 rounded-full bg-signal" />
          <span className="h-1.5 w-8 rounded-full bg-signal" />
          <span className="h-1.5 w-8 rounded-full bg-ground-sunken" />
          <span className="h-1.5 w-8 rounded-full bg-ground-sunken" />
        </div>
      </div>
    </PhoneFrame>
  )
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M6 11a1 1 0 0 1 2 0 4 4 0 0 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.917V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.083A6 6 0 0 1 6 11Z" />
    </svg>
  )
}

/** The home-screen tile, for the mobile section: the app already installs to the phone. */
export function HomeScreenMock({ installedLabel }: { installedLabel: string }) {
  const tiles = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <PhoneFrame className="max-w-[16rem]">
      <div className="bg-gradient-to-b from-signal-soft to-ground-raised px-6 pt-11 pb-8">
        <div className="grid grid-cols-4 gap-x-4 gap-y-6">
          {tiles.map((tile) =>
            tile === 1 ? (
              <div key={tile} className="flex flex-col items-center gap-1.5">
                <img
                  src="/icons/apple-touch-icon.png"
                  alt=""
                  aria-hidden="true"
                  className="size-11 rounded-[0.9rem] shadow-[0_6px_14px_-4px_rgb(45_118_221/0.5)]"
                />
                <span className="text-[9px] leading-none font-bold text-ink">russian.gg</span>
              </div>
            ) : (
              <div key={tile} className="flex flex-col items-center gap-1.5">
                <span className="size-11 rounded-[0.9rem] bg-ground-sunken/80" />
                <span className="h-1.5 w-8 rounded-full bg-ground-sunken/70" />
              </div>
            ),
          )}
        </div>
        <div className="mt-8 rounded-2xl border border-hairline bg-ground-raised px-4 py-3 text-center shadow-[0_10px_24px_-16px_rgb(45_118_221/0.5)]">
          <span className="text-xs font-bold text-ink-muted">{installedLabel}</span>
        </div>
      </div>
    </PhoneFrame>
  )
}

/**
 * Rod-runner. A road rushing into the distance, a word to sort, and three gender gates —
 * М / Ж / С — with the right one lit. The centre line streams and the runner bobs, so the
 * still frame already reads as a game in motion. Fills the whole card header.
 */
export function RunnerArt() {
  return (
    <svg
      viewBox="0 0 440 150"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="rr-road" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0.13" />
          <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="rr-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rr-runner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      {/* A horizon line at the vanishing point. */}
      <line x1="152" y1="40" x2="288" y2="40" stroke="var(--color-signal)" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />

      {/* The road and its rushing centre line. */}
      <polygon points="120,150 320,150 231,42 209,42" fill="url(#rr-road)" />
      <path
        d="M120 150 L209 42 M320 150 L231 42"
        stroke="var(--color-signal)"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <line
        x1="220"
        y1="150"
        x2="220"
        y2="44"
        stroke="var(--color-signal)"
        strokeOpacity="0.5"
        strokeWidth="3"
        strokeDasharray="9 13"
        strokeLinecap="round"
        style={{ animation: 'gameDash 1.1s linear infinite' }}
      />

      {/* Coins to collect. */}
      <g fill="#fbbf24" stroke="#f59e0b" strokeWidth="1">
        <circle cx="194" cy="118" r="3.6" />
        <circle cx="252" cy="96" r="3.1" />
        <circle cx="236" cy="56" r="2.4" />
      </g>

      {/* Gender gates, each its own vivid colour: masculine blue, feminine rose, neuter green. */}
      <g fontFamily="var(--font-sans)" fontWeight="800" fontSize="15" textAnchor="middle">
        <circle cx="220" cy="73" r="26" fill="#f43f5e" opacity="0.18" />
        <circle cx="168" cy="76" r="16" fill="#3b82f6" />
        <text x="168" y="81" fill="#ffffff">М</text>
        <circle cx="272" cy="76" r="16" fill="#10b981" />
        <text x="272" y="81" fill="#ffffff">С</text>
        <circle cx="220" cy="72" r="18.5" fill="#f43f5e" />
        <text x="220" y="78" fill="#ffffff">Ж</text>
      </g>

      {/* The word to sort, floating. */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gameBob 2.6s ease-in-out infinite' }}>
        <rect x="192" y="90" width="56" height="22" rx="11" fill="var(--color-ground-raised)" stroke="var(--color-hairline)" strokeWidth="1.5" />
        <text x="220" y="105" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="800" fontSize="12" fill="var(--color-ink)">
          стол
        </text>
      </g>

      {/* The runner, an abstract forward marker with speed streaks. */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gameBob 2s ease-in-out infinite' }}>
        <g stroke="var(--color-signal)" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round">
          <path d="M202 142 h-16" />
          <path d="M238 142 h16" />
          <path d="M206 147 h-10" />
        </g>
        <path d="M220 116 l18 24 a3.2 3.2 0 0 1 -2.8 4.8 h-30.4 a3.2 3.2 0 0 1 -2.8 -4.8 z" fill="url(#rr-runner)" />
        <path d="M220 125 l7.5 11 h-15 z" fill="#ffffff" />
      </g>
    </svg>
  )
}

/**
 * Arra — the saw. A toothed blade spins in, sparks flying, while pulsing sound waves and a
 * voice meter push it back. The spin and the pulse run on a loop; both stop under reduced
 * motion. Fills the whole card header.
 */
export function SawArt() {
  const teeth = Array.from({ length: 18 }, (_, i) => i)
  return (
    <svg
      viewBox="0 0 440 150"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="saw-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="saw-blade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      {/* Ground and the blade's shadow. */}
      <line x1="24" y1="126" x2="330" y2="126" stroke="var(--color-hairline)" strokeWidth="2" />
      <ellipse cx="150" cy="129" rx="50" ry="6" fill="var(--color-ink)" opacity="0.06" />

      {/* Rolling-in streaks. */}
      <g stroke="var(--color-signal)" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round">
        <path d="M40 66 h34" />
        <path d="M28 86 h30" />
        <path d="M44 106 h28" />
      </g>

      <circle cx="150" cy="80" r="52" fill="url(#saw-glow)" />

      {/* The spinning blade. */}
      <g transform="translate(150 80)">
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gameSpin 8s linear infinite' }}>
          {teeth.map((i) => {
            const a = (i / teeth.length) * Math.PI * 2
            return (
              <line
                key={i}
                x1={Math.cos(a) * 34}
                y1={Math.sin(a) * 34}
                x2={Math.cos(a) * 46}
                y2={Math.sin(a) * 46}
                stroke="#fb923c"
                strokeWidth="5"
                strokeLinecap="round"
              />
            )
          })}
          <circle r="34" fill="url(#saw-blade)" />
          <circle r="26" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="6 10" />
          <circle r="10" fill="var(--color-ground-raised)" />
          <circle r="3.5" fill="#fb923c" />
        </g>
      </g>

      {/* Sparks where the voice meets the blade. */}
      <g stroke="#f97316" strokeWidth="0.8">
        <circle cx="208" cy="66" r="2.8" fill="#fbbf24" />
        <circle cx="216" cy="90" r="2.1" fill="#fb923c" />
        <circle cx="200" cy="102" r="1.8" fill="#fbbf24" />
      </g>

      {/* The voice pushing back — pulsing waves and a meter, in a vivid green. */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gamePulse 2s ease-in-out infinite' }}>
        <g fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round">
          <path d="M250 58 a32 32 0 0 0 0 44" />
          <path d="M270 48 a46 46 0 0 0 0 64" />
          <path d="M290 40 a58 58 0 0 0 0 80" />
        </g>
      </g>
      <g stroke="#10b981" strokeWidth="4" strokeLinecap="round">
        <path d="M330 70 v20" />
        <path d="M342 58 v44" />
        <path d="M354 74 v12" />
      </g>
    </svg>
  )
}

/**
 * A reel thumbnail. With a `cover` it shows the real reel poster (the Instagram cover already
 * carries its own play glyph, so we do not add a second one) under a bottom scrim for the
 * label. Without one it falls back to a soft signal field with a drawn play glyph. Overlays
 * over the photo use fixed black, not theme ink, because the image is the same in both themes.
 */
export function ReelThumb({ seed, watch, cover }: { seed: number; watch: string; cover?: string }) {
  const angles = [135, 160, 115, 145]
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[9/13] w-full overflow-hidden rounded-2xl border border-hairline bg-ground-sunken"
      style={
        cover
          ? undefined
          : {
              background: `linear-gradient(${angles[seed % angles.length]}deg, var(--color-signal-soft), var(--color-ground-sunken))`,
            }
      }
    >
      {cover ? (
        <>
          <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-signal pl-0.5 text-on-signal shadow-[0_6px_16px_-6px_rgb(45_118_221/0.7)]">
            <PlayGlyph />
          </span>
        </div>
      )}
      <span className="absolute right-2 bottom-2 rounded-[var(--radius-control)] bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
        {watch}
      </span>
    </div>
  )
}

/** Abstract step markers for the method section — a circle carrying its number, in signal. */
export function StepMark({ n }: { n: number }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-signal-soft text-lg font-extrabold text-signal-ink">
      {n}
    </span>
  )
}

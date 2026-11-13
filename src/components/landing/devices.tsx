import type { ReactNode } from 'react'
import { BatteryFull, SignalHigh, Wifi } from 'lucide-react'
import { cx } from '../../lib/cx'

/**
 * Device frames for the landing page's product shots.
 *
 * The iPhone is drawn to the real body's proportions (71.6 × 146.6 mm, the 6.1" model): a
 * titanium rim, a black bezel, the screen's own corner radius, the Dynamic Island, the side
 * buttons and the home indicator. Every measurement is a percentage or a container unit, so one
 * frame holds at any width the layout gives it — the hero, a game card, the mobile section —
 * without a second set of numbers.
 *
 * Decorative: the screen's content is a picture of the product, and the copy beside each frame
 * says what it shows.
 */

/**
 * What the screen behind the status bar and home indicator is:
 * - `theme` follows the page — the screen is drawn from the product's tokens and flips with it;
 * - `light` / `dark` are fixed — the screen is a screenshot and does not change with the theme.
 */
type ScreenTone = 'theme' | 'light' | 'dark'

const INK: Record<ScreenTone, string> = { theme: 'text-ink', light: 'text-[#111]', dark: 'text-white' }
const BAR: Record<ScreenTone, string> = { theme: 'bg-ink/75', light: 'bg-black/75', dark: 'bg-white/80' }

/** A 9:41 status bar, as Apple's own marketing renders it. */
function StatusBar({ tone }: { tone: ScreenTone }) {
  return (
    <div
      className={cx(
        'absolute inset-x-0 top-0 z-20 flex h-[12cqw] items-center justify-between px-[8cqw] pt-[1.2cqw] text-[3.9cqw] font-bold',
        INK[tone],
      )}
    >
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-[1.2cqw]">
        <SignalHigh aria-hidden="true" strokeWidth={2.6} className="size-[4.4cqw]" />
        <Wifi aria-hidden="true" strokeWidth={2.6} className="size-[4.2cqw]" />
        <BatteryFull aria-hidden="true" strokeWidth={2} className="size-[5.6cqw]" />
      </span>
    </div>
  )
}

export function IPhoneFrame({
  children,
  className,
  screenClassName,
  tone = 'theme',
  bare = false,
}: {
  children: ReactNode
  className?: string
  /** The screen's own background, behind the content. */
  screenClassName?: string
  /** What the screen is, for the colour of the status bar and home indicator. */
  tone?: ScreenTone
  /** The content is a full screenshot that already carries a status bar and island. */
  bare?: boolean
}) {
  return (
    <div aria-hidden="true" className={cx('@container relative aspect-[71.6/146.6] w-full', className)}>
      {/* Side buttons sit just proud of the rim: action and volume on the left, power on the right. */}
      <span className="iphone-button top-[16.5%] -left-[1.4%] h-[4%]" />
      <span className="iphone-button top-[23.5%] -left-[1.4%] h-[7.5%]" />
      <span className="iphone-button top-[33%] -left-[1.4%] h-[7.5%]" />
      <span className="iphone-button top-[26%] -right-[1.4%] h-[11%]" />

      {/* Titanium rim → black bezel → screen. Radii are given as width%/height% pairs so each
          corner is a true circle on a body that is twice as tall as it is wide. */}
      <div className="iphone-rim absolute inset-0 rounded-[16%/7.8%] p-[1.4%]">
        <div className="size-full rounded-[15%/7.3%] bg-[#0b0c0e] p-[3%] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
          <div className={cx('relative size-full overflow-hidden rounded-[12.5%/6%]', screenClassName ?? 'bg-ground')}>
            {!bare && <StatusBar tone={tone} />}
            {!bare && (
              <span className="absolute top-[2.4cqw] left-1/2 z-30 h-[8.4cqw] w-[30%] -translate-x-1/2 rounded-full bg-black" />
            )}
            {children}
            <span
              className={cx(
                'absolute bottom-[2.2cqw] left-1/2 z-30 h-[1.3cqw] w-[36%] -translate-x-1/2 rounded-full',
                BAR[tone],
              )}
            />
            {/* The glass: one soft diagonal highlight across the whole screen. */}
            <span className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(115deg,rgb(255_255_255/0.16)_0%,rgb(255_255_255/0)_38%)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** A browser window — traffic lights and an address pill — for a landscape product shot. */
export function BrowserFrame({ children, url, className }: { children: ReactNode; url: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'overflow-hidden rounded-[1.1rem] border border-black/10 bg-[#f4f5f7] shadow-[0_30px_60px_-30px_rgb(22_40_90/0.55)]',
        className,
      )}
    >
      <div className="flex h-9 items-center gap-3 border-b border-black/5 bg-[#eceef1] px-3.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto max-w-[60%] truncate rounded-md bg-white/80 px-3 py-0.5 text-[11px] font-semibold text-[#6b7280]">
          {url}
        </span>
        <span className="w-[42px]" />
      </div>
      {children}
    </div>
  )
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Compass,
  Gamepad2,
  Gauge,
  Globe,
  LogOut,
  MessageCircle,
  Moon,
  Settings,
  Target,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import {
  PLAYBACK_SPEEDS,
  readAudioPreferences,
  storeAudioPreferences,
  type AudioPreferences,
} from '../lib/audio-preferences'
import { planLabel } from '../lib/format'
import { useOpenGames } from '../lib/games'
import { useRouteChange } from '../lib/route-change'
import { useTheme } from '../lib/theme'
import { LOCALES, LOCALE_NAMES, fill, useLocale, useT } from '../lib/i18n'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { EntitlementView, ProgressView, WelcomeGiftStatus } from '../lib/types'
import { PhoneNumberPrompt } from './PhoneNumberPrompt'
import { Badge, Switch } from './ui'

const NAV = [
  { to: '/home', key: 'today', icon: TodayGlyph },
  { to: '/path', key: 'path', icon: PathGlyph },
  { to: '/practice', key: 'practice', icon: TasksGlyph },
  // No route: the chip says it is not built yet, so the row must not lead anywhere.
  { to: null, key: 'tests', icon: TestsGlyph, comingSoon: true },
  { to: '/progress', key: 'progress', icon: ProgressGlyph },
] as const

export function AppShell() {
  const t = useT()
  const mainRef = useRef<HTMLElement>(null)
  useRouteChange(mainRef)
  /*
   * The games row exists only when the panel has opened at least one. Everything is off by
   * default, so the ordinary state is no row at all — and a menu item leading to an empty
   * shelf is worse than no menu item.
   */
  const openGames = useOpenGames()
  const nav = useMemo(
    () =>
      openGames && openGames.length > 0
        ? [...NAV, { to: '/games', key: 'games' as const, icon: GamesGlyph }]
        : NAV,
    [openGames],
  )
  const { data: progress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  const completedDays = Math.max(0, (progress?.currentDay ?? 1) - 1)

  return (
    <div className="app-shell min-h-dvh overflow-x-clip bg-ground-sunken md:flex">
      {/*
        The first tab stop on every screen. Hidden until it has focus, then it sits over the
        header — without it, reaching the content by keyboard means tabbing past the whole
        rail and the account menu on every single navigation.
      */}
      <a
        href="#main"
        onClick={(event) => {
          // A same-page hash does not move focus on its own in several browsers, and the
          // router would treat the href as a route besides.
          event.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-on-signal"
      >
        {t.nav.skipToContent}
      </a>

      {/* Phone: identity at the top, navigation at the bottom where the thumb is. */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <Wordmark />
          <div className="flex items-center gap-2">
            <WelcomeDiscountCountdown />
            <ProfileMenu compact />
          </div>
        </div>
      </header>

      <aside className="hidden w-[15.5rem] shrink-0 flex-col border-r border-hairline bg-ground-raised px-5 py-6 md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto">
        <Wordmark />

        <nav className="mt-10 flex flex-col gap-1" aria-label={t.nav.main}>
          {nav.map((item) => (
            <RailLink
              key={item.key}
              to={item.to}
              icon={item.icon}
              trailing={item.to === '/path' ? `${completedDays}/90` : undefined}
              trailingHint={fill(t.nav.daysDone, { count: completedDays })}
              comingSoon={'comingSoon' in item && item.comingSoon}
              comingSoonLabel={t.nav.comingSoon}
            >
              {t.nav[item.key]}
            </RailLink>
          ))}
        </nav>

        {/* Sign-out lives inside the menu, not beside it: one account surface, not two. */}
        <div className="mt-auto pt-8">
          <SidebarAudioControls />
          <div className="mt-3">
          <ProfileMenu />
          </div>
        </div>
      </aside>

      {/* Desktop only: on phones the timer sits in the header, in flow beside the avatar. */}
      <div className="fixed right-6 top-6 z-30 hidden md:block">
        <WelcomeDiscountCountdown />
      </div>

      {/*
        The bottom padding clears the tab bar plus the home indicator; without it the last
        card on every screen sits under the bar and cannot be reached.

        `tabIndex={-1}` makes this focusable without putting it in the tab order, which is what
        both the skip link and the route-change announcement need to move focus here.
      */}
      <main
        ref={mainRef}
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[96rem] px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none sm:px-5 sm:pt-6 md:px-8 md:py-10 md:pb-12 lg:px-10 2xl:px-12"
      >
        <Outlet />
      </main>

      <PhoneNumberPrompt />

      <nav
        aria-label={t.nav.main}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-ground/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="flex items-stretch">
          {nav.map((item) => (
            <TabLink
              key={item.key}
              to={item.to}
              label={t.nav[item.key]}
              short={t.nav[`${item.key}Short`]}
              icon={item.icon}
              count={
                item.to === '/path'
                  ? fill(t.nav.daysDone, { count: completedDays })
                  : undefined
              }
              comingSoon={'comingSoon' in item && item.comingSoon}
              comingSoonHint={t.nav.comingSoon}
            />
          ))}
        </div>
      </nav>
    </div>
  )
}

function WelcomeDiscountCountdown() {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  const { data: welcomeGift } = useQuery({
    queryKey: ['welcome-gift'],
    queryFn: () => api.get<WelcomeGiftStatus>('/billing/welcome-gift'),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  })

  const secondsRemaining = welcomeGift?.expiresAt
    ? Math.max(0, Math.ceil((new Date(welcomeGift.expiresAt).getTime() - now) / 1000))
    : 0
  const isActive = Boolean(
    welcomeGift?.isDiscountActive && welcomeGift.discountPercent > 0 && secondsRemaining > 0,
  )

  useEffect(() => {
    if (!isActive) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isActive])

  if (!isActive) return null

  const urgent = secondsRemaining <= 180
  const time = formatCountdown(secondsRemaining)

  // The timer is only worth watching because of the discount, so it leads to the plans.
  return (
    <Link
      to="/paywall"
      aria-label={fill(t.welcomeGift.expiresIn, { time })}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[13px] font-extrabold tabular-nums shadow-sm transition-colors ${
        urgent
          ? 'border-danger/25 bg-danger-soft text-danger'
          : 'border-signal/20 bg-signal-soft text-signal-ink hover:border-signal/45'
      }`}
    >
      <span
        className={`rounded-full px-1.5 py-1 text-[11px] font-black leading-none text-on-signal ${
          urgent ? 'bg-danger' : 'bg-signal'
        }`}
      >
        -{welcomeGift?.discountPercent}%
      </span>
      <ClockGlyph pulsing={urgent} />
      {time}
    </Link>
  )
}

function ClockGlyph({ pulsing }: { pulsing: boolean }) {
  return (
    <Clock
      aria-hidden="true"
      strokeWidth={2.2}
      className={`size-3.5 shrink-0 ${pulsing ? 'animate-pulse' : ''}`}
    />
  )
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function Wordmark() {
  return (
    <NavLink to="/home" className="text-xl font-semibold tracking-tight text-ink">
      russian<span className="text-signal">.gg</span>
    </NavLink>
  )
}

function SidebarAudioControls() {
  const t = useT()
  const [preferences, setPreferences] = useState<AudioPreferences>(readAudioPreferences)

  function update(next: AudioPreferences) {
    setPreferences(next)
    storeAudioPreferences(next)
  }

  function cycleSpeed() {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(preferences.speed)
    const speed = PLAYBACK_SPEEDS[(currentIndex + 1) % PLAYBACK_SPEEDS.length]
    update({ ...preferences, speed })
  }

  return (
    <div className="rounded-2xl border border-hairline bg-ground-sunken/70 p-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={cycleSpeed}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl bg-ground-raised px-3 py-2 text-sm font-bold text-ink transition-colors hover:text-signal-ink"
          aria-label={`${t.account.speed}: ${preferences.speed}x`}
        >
          <span className="flex items-center gap-2 text-ink-muted">
            <SpeedGlyph />
            {t.account.speed}
          </span>
          <span className="rounded-lg bg-signal-soft px-2 py-0.5 text-xs font-extrabold tabular-nums text-signal-ink">
            {preferences.speed}x
          </span>
        </button>

        <button
          type="button"
          onClick={() => update({ ...preferences, muted: !preferences.muted })}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ground-raised text-ink-muted transition-colors hover:text-signal-ink"
          aria-label={preferences.muted ? t.account.soundOff : t.account.soundOn}
          aria-pressed={preferences.muted}
        >
          <SoundGlyph muted={preferences.muted} />
        </button>
      </div>
    </div>
  )
}

function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const t = useT()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
  })

  const name =
    user?.displayName?.trim() || user?.email?.split('@')[0] || user?.phoneNumber || t.account.learner
  // The plan, not the level: this row is the account, and the level already has a home on
  // the profile and progress screens.
  const subtitle = planLabel(entitlement, t)
  const initials = name.trim().slice(0, 2).toUpperCase()

  function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  async function logout() {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-3 rounded-2xl border border-hairline bg-ground-raised text-left transition hover:border-signal ${
          compact ? 'max-w-[10.5rem] px-2.5 py-2' : 'w-full px-3 py-2'
        }`}
      >
        {compact ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
            {initials}
          </span>
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ground-sunken text-ink-muted">
            <GearGlyph />
          </span>
        )}
        {!compact && <span className="min-w-0 flex-1 text-sm font-bold text-ink">{t.account.settings}</span>}
        <ChevronGlyph direction={open ? 'up' : 'down'} />
      </button>

      {open && (
        <ProfilePopover
          anchor={triggerRef}
          compact={compact}
          label={t.account.menu}
          onDismiss={() => setOpen(false)}
        >
          {/* Account row first, exactly like the trigger it grew out of, so the menu reads
              as an expansion of the button rather than an unrelated list. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => go('/settings')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-ground-sunken"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-5 text-ink">{name}</span>
              {subtitle && <span className="block truncate text-sm text-ink-muted">{subtitle}</span>}
            </span>
            <ChevronGlyph direction="right" />
          </button>

          <div className="my-2 border-t border-hairline" />

          {/*
            Billing and profile used to sit here as their own destinations. They are tabs of
            Settings now: three menu rows that led to three pages covering the same account
            was three places to look for one thing.
          */}
          <MenuItem label={t.account.settings} icon={<GearGlyph />} onClick={() => go('/settings')} />
          <ThemeToggleItem />
          <LanguageItem />

          <div className="my-2 border-t border-hairline" />

          <MenuItem label={t.account.feedback} icon={<ChatGlyph />} onClick={() => go('/feedbacks')} />
          <MenuItem label={t.account.signOut} icon={<ExitGlyph />} onClick={() => void logout()} danger />
        </ProfilePopover>
      )}
    </>
  )
}

/**
 * The menu is portalled to the body. Rendering it inside the rail would clip it: the rail is
 * a scroll container (`overflow-y-auto`), and a scroll container cannot be escaped by
 * `position: absolute`. Coordinates are measured from the trigger and re-measured on scroll
 * and resize.
 */
function ProfilePopover({
  anchor,
  compact,
  label,
  onDismiss,
  children,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>
  compact: boolean
  label: string
  onDismiss: () => void
  children: ReactNode
}) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null)

  useLayoutEffect(() => {
    function place() {
      const trigger = anchor.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const gap = 8
      const width = Math.min(272, window.innerWidth - 24)

      setStyle(
        compact
          ? // Mobile: hangs below the avatar in the header, pinned to the right edge.
            { top: rect.bottom + gap, right: Math.max(12, window.innerWidth - rect.right), width }
          : // Desktop: opens upwards from the rail's footer.
            { bottom: window.innerHeight - rect.top + gap, left: rect.left, width },
      )
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, compact])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onDismiss} aria-hidden="true" />
      <div
        role="menu"
        aria-label={label}
        style={style ?? { visibility: 'hidden' }}
        className="fixed z-50 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-2 shadow-2xl"
      >
        {children}
      </div>
    </>,
    document.body,
  )
}

function ThemeToggleItem() {
  const t = useT()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={isDark}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-ink transition-colors hover:bg-ground-sunken"
    >
      <span className="shrink-0" aria-hidden="true">
        <MoonGlyph />
      </span>
      <span className="flex-1">{t.account.darkMode}</span>
      <Switch checked={isDark} />
    </button>
  )
}

/**
 * Cycles through the three languages in place. A submenu would mean a second popover inside
 * a popover for a three-item list, and the current language is always visible on the row.
 */
function LanguageItem() {
  const t = useT()
  const { locale, setLocale } = useLocale()

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => setLocale(LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length])}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-ink transition-colors hover:bg-ground-sunken"
    >
      <span className="shrink-0" aria-hidden="true">
        <GlobeGlyph />
      </span>
      <span className="flex-1">{t.account.language}</span>
      <span className="text-sm font-medium text-ink-muted">{LOCALE_NAMES[locale]}</span>
    </button>
  )
}

function MenuItem({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-ground-sunken ${
        danger ? 'text-danger' : 'text-ink'
      }`}
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  )
}

/*
  The menu glyphs, from Lucide.

  They were hand-drawn in a circle-line-and-wave register, and Lucide is that same register
  with one consistent hand across four hundred shapes — so a glyph this product has not needed
  yet no longer has to be invented before it can be used. The named wrappers stay: every call
  site says what the icon *means* here, not what it depicts.

  1.6 rather than Lucide's default 2. At 18px the default closes up the counters, and these sit
  beside 15px text where a heavier icon reads as the louder thing in the row.
*/

const glyph = 'size-[18px] shrink-0'
const STROKE = 1.6

function ChevronGlyph({ direction }: { direction: 'up' | 'down' | 'right' }) {
  const Icon = { up: ChevronUp, down: ChevronDown, right: ChevronRight }[direction]

  return <Icon aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0 text-ink-faint" />
}

function GearGlyph() {
  return <Settings aria-hidden="true" strokeWidth={STROKE} className={glyph} />
}

function ChatGlyph() {
  return <MessageCircle aria-hidden="true" strokeWidth={STROKE} className={glyph} />
}

function MoonGlyph() {
  return <Moon aria-hidden="true" strokeWidth={STROKE} className={glyph} />
}

function GlobeGlyph() {
  return <Globe aria-hidden="true" strokeWidth={STROKE} className={glyph} />
}

function ExitGlyph() {
  return <LogOut aria-hidden="true" strokeWidth={STROKE} className={glyph} />
}

function SpeedGlyph() {
  return <Gauge aria-hidden="true" strokeWidth={STROKE} className={glyph} />
}

function SoundGlyph({ muted }: { muted: boolean }) {
  const Icon = muted ? VolumeX : Volume2
  return <Icon aria-hidden="true" strokeWidth={STROKE} className={glyph} />
}


/**
 * The phone tab bar. Icon-only by request, so every item carries an `aria-label` and
 * `NavLink` marks the active one with `aria-current` — the meaning must survive for anyone
 * not reading the glyph. Targets are a full 56px tall so they clear the 44px touch minimum.
 */
function TabLink({
  to,
  label,
  short,
  icon: Icon,
  count,
  comingSoon,
  comingSoonHint,
}: {
  to: string | null
  /** The full name, used for the accessible label. */
  label: string
  /** What fits under a 24px glyph on a phone. */
  short: string
  icon: () => ReactNode
  /** Announced to screen readers only: a pill over a 24px glyph hides the glyph. */
  count?: string
  comingSoon?: boolean
  comingSoonHint?: string
}) {
  const description = [label, count, comingSoon && comingSoonHint].filter(Boolean).join(', ')

  // Nothing to navigate to yet: rendered as plain, quiet text rather than a dead link.
  if (!to) {
    return (
      <span
        aria-label={description}
        className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 text-ink-faint opacity-60"
      >
        <span className="flex h-6 items-center" aria-hidden="true">
          <Icon />
        </span>
        <span aria-hidden="true" className="text-[11px] leading-none">
          {short}
        </span>
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      aria-label={description}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 transition-colors ${
          isActive ? 'font-extrabold text-signal-ink' : 'font-bold text-ink-faint'
        }`
      }
    >
      <span className="flex h-6 items-center" aria-hidden="true">
        <Icon />
      </span>
      <span aria-hidden="true" className="text-[11px] leading-none">
        {short}
      </span>
    </NavLink>
  )
}

/*
  The tab bar and rail glyphs.

  Each has to be told apart at 24px in peripheral vision, which is all the attention a tab bar
  ever gets, so the difference between them is silhouette rather than detail. 1.7 for the same
  reason the menu uses 1.6: Lucide's default weight is drawn for larger sizes than these.
*/

const navGlyph = 'size-6 shrink-0'
const NAV_STROKE = 1.7

function TodayGlyph() {
  return <CalendarDays aria-hidden="true" strokeWidth={NAV_STROKE} className={navGlyph} />
}

function PathGlyph() {
  return <Compass aria-hidden="true" strokeWidth={NAV_STROKE} className={navGlyph} />
}

function TasksGlyph() {
  return <Target aria-hidden="true" strokeWidth={NAV_STROKE} className={navGlyph} />
}

function GamesGlyph() {
  return <Gamepad2 aria-hidden="true" strokeWidth={NAV_STROKE} className={navGlyph} />
}

function TestsGlyph() {
  return <ClipboardCheck aria-hidden="true" strokeWidth={NAV_STROKE} className={navGlyph} />
}

function ProgressGlyph() {
  return <BarChart3 aria-hidden="true" strokeWidth={NAV_STROKE} className={navGlyph} />
}


function RailLink({
  to,
  icon: Icon,
  children,
  trailing,
  trailingHint,
  comingSoon,
  comingSoonLabel,
}: {
  to: string | null
  icon: () => ReactNode
  children: ReactNode
  trailing?: string
  trailingHint?: string
  comingSoon?: boolean
  comingSoonLabel?: string
}) {
  if (!to) {
    return (
      <span className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-base font-bold text-ink-faint">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
            <Icon />
          </span>
          <span>{children}</span>
        </span>
        {comingSoon && comingSoonLabel && (
          <Badge tone="primary" size="sm">
            {comingSoonLabel}
          </Badge>
        )}
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `-mx-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-base transition-colors ${
          isActive
            ? 'bg-signal-soft font-extrabold text-signal-ink'
            : 'font-bold text-ink-muted hover:bg-ground-sunken hover:text-ink'
        }`
      }
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
          <Icon />
        </span>
        <span>{children}</span>
      </span>
      {trailing && (
        <Badge tone="neutral" size="sm">
          {trailing}
          {trailingHint && <span className="sr-only"> · {trailingHint}</span>}
        </Badge>
      )}
    </NavLink>
  )
}

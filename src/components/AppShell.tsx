import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { levelDescriptionUz } from '../lib/format'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ProgressView } from '../lib/types'
import { Badge } from './ui'

const NAV = [
  { to: '/home', label: 'Bugungi dars' },
  { to: '/path', label: "90 kunlik yo'l" },
  { to: '/practice', label: 'Topshiriqlar' },
  { to: '/progress', label: 'Progress' },
] as const

export function AppShell() {
  const { data: progress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  const completedDays = Math.max(0, (progress?.currentDay ?? 1) - 1)

  return (
    <div className="min-h-dvh overflow-x-clip md:flex">
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Wordmark />
          <ProfileMenu compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Asosiy">
          {NAV.map((item) => (
            <TabLink
              key={item.to}
              to={item.to}
              trailing={item.to === '/path' ? `${completedDays}/90` : undefined}
            >
              {item.label}
            </TabLink>
          ))}
        </nav>
      </header>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline px-6 py-8 md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto">
        <Wordmark />

        <nav className="mt-12 flex flex-col gap-1" aria-label="Asosiy">
          {NAV.map((item) => (
            <RailLink
              key={item.to}
              to={item.to}
              trailing={item.to === '/path' ? `${completedDays}/90` : undefined}
            >
              {item.label}
            </RailLink>
          ))}
        </nav>

        {/* Sign-out lives inside the menu, not beside it: one account surface, not two. */}
        <div className="mt-auto pt-8">
          <ProfileMenu />
        </div>
      </aside>

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-12 md:py-12">
        <Outlet />
      </main>
    </div>
  )
}

function Wordmark() {
  return (
    <NavLink to="/home" className="text-xl font-semibold tracking-tight text-ink">
      russian<span className="text-signal">.gg</span>
    </NavLink>
  )
}

function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const { data } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Talaba'
  const subtitle = data ? `${data.speakingLevel} · ${levelDescriptionUz[data.speakingLevel]}` : 'Profil'
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
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
          {initials}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-5 text-ink">{name}</span>
            <span className="block text-sm text-ink-muted">{subtitle}</span>
          </span>
        )}
        <ChevronGlyph direction={open ? 'up' : 'down'} />
      </button>

      {open && (
        <ProfilePopover anchor={triggerRef} compact={compact} onDismiss={() => setOpen(false)}>
          {/* Account row first, exactly like the trigger it grew out of, so the menu reads
              as an expansion of the button rather than an unrelated list. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => go('/profile')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-ground-sunken"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-5 text-ink">{name}</span>
              <span className="block truncate text-sm text-ink-muted">{subtitle}</span>
            </span>
            <ChevronGlyph direction="right" />
          </button>

          <div className="my-2 border-t border-hairline" />

          <MenuItem label="Obuna va to'lovlar" icon={<SparkGlyph />} onClick={() => go('/paywall')} />
          <MenuItem label="Profil" icon={<PersonGlyph />} onClick={() => go('/profile')} />
          <MenuItem label="Sozlamalar" icon={<GearGlyph />} onClick={() => go('/settings')} />

          <div className="my-2 border-t border-hairline" />

          <MenuItem label="Fikr bildirish" icon={<ChatGlyph />} onClick={() => go('/feedbacks')} />
          <MenuItem label="Chiqish" icon={<ExitGlyph />} onClick={() => void logout()} danger />
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
  onDismiss,
  children,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>
  compact: boolean
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
        aria-label="Hisob"
        style={style ?? { visibility: 'hidden' }}
        className="fixed z-50 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-2 shadow-2xl"
      >
        {children}
      </div>
    </>,
    document.body,
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

/* Abstract line glyphs — circle, line and wave motifs only (PRD §7). No emoji, no icon font. */

const glyph = 'size-[18px] fill-none stroke-current stroke-[1.6]'

function ChevronGlyph({ direction }: { direction: 'up' | 'down' | 'right' }) {
  const rotation = { up: 'rotate-180', down: '', right: '-rotate-90' }[direction]

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-4 shrink-0 fill-none stroke-current stroke-[1.8] text-ink-faint ${rotation}`}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SparkGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9Z" strokeLinejoin="round" />
    </svg>
  )
}

function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <circle cx="12" cy="9" r="3.2" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
    </svg>
  )
}

function GearGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2.6 3.1" />
    </svg>
  )
}

function ChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4.5 20l1.4-4.4A7.5 7.5 0 1 1 20 12Z" strokeLinejoin="round" />
    </svg>
  )
}

function ExitGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path d="M14 5.5H6.5v13H14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 12h6m0 0-2.6-2.6M19.5 12l-2.6 2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TabLink({
  to,
  children,
  trailing,
}: {
  to: string
  children: ReactNode
  trailing?: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `shrink-0 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold transition-colors ${
          isActive ? 'bg-signal-soft text-signal-ink' : 'text-ink-muted'
        }`
      }
    >
      <span className="flex items-center gap-2">
        <span>{children}</span>
        {trailing && (
          <Badge tone="neutral" size="sm">
            {trailing}
            <span className="sr-only"> kun bajarildi</span>
          </Badge>
        )}
      </span>
    </NavLink>
  )
}

function RailLink({
  to,
  children,
  trailing,
}: {
  to: string
  children: ReactNode
  trailing?: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-base transition-colors ${
          isActive ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
        }`
      }
    >
      <span>{children}</span>
      {trailing && (
        <Badge tone="neutral" size="sm">
          {trailing}
          <span className="sr-only"> kun bajarildi</span>
        </Badge>
      )}
    </NavLink>
  )
}

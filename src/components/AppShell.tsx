import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { levelDescriptionUz } from '../lib/format'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ProgressView } from '../lib/types'

const NAV = [
  { to: '/home', label: 'Bugungi dars' },
  { to: '/path', label: "90 kunlik yo'l" },
  { to: '/practice', label: 'Topshiriqlar' },
  { to: '/progress', label: 'Progress' },
] as const

export function AppShell() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-dvh md:flex">
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Wordmark />
          <ProfileMenu compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Asosiy">
          {NAV.map((item) => (
            <TabLink key={item.to} to={item.to}>
              {item.label}
            </TabLink>
          ))}
        </nav>
      </header>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline px-6 py-8 md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto">
        <Wordmark />

        <nav className="mt-12 flex flex-col gap-1" aria-label="Asosiy">
          {NAV.map((item) => (
            <RailLink key={item.to} to={item.to}>
              {item.label}
            </RailLink>
          ))}
        </nav>

        <div className="mt-auto pt-8">
          <ProfileMenu />
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 rounded-lg text-sm font-medium text-ink-faint transition-colors hover:text-ink"
          >
            Chiqish
          </button>
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

  const { data } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Talaba'
  const subtitle = data ? `${data.speakingLevel} · ${levelDescriptionUz[data.speakingLevel]}` : 'Profil'
  const initials = name.trim().slice(0, 2).toUpperCase()

  async function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  async function logout() {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-3 rounded-2xl border border-hairline bg-ground-raised px-3 py-3 text-left transition hover:border-signal ${
          compact ? 'w-auto px-3 py-2' : ''
        }`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
          {initials}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-ink">{name}</span>
            <span className="block text-sm text-ink-muted">{subtitle}</span>
          </span>
        )}
        <span className="text-ink-muted">{open ? '˄' : '˅'}</span>
      </button>

      {open && (
        <div className={`absolute z-30 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-3 shadow-2xl ${
          compact ? 'right-0 mt-2 w-72' : 'bottom-full left-0 mb-3 w-72'
        }`}>
          <button
            type="button"
            onClick={() => void go('/settings')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-ground-sunken"
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-ink-muted/60" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-ground-raised" />
            </span>
            <span>
              <span className="block text-base font-semibold text-ink">Profile</span>
              <span className="block text-sm text-ink-muted">{user?.email}</span>
            </span>
          </button>
          <div className="my-2 border-t border-hairline" />
          <MenuItem label="Sozlamalar" onClick={() => void go('/settings')} />
          <MenuItem label="To'lovlar" onClick={() => void go('/paywall')} />
          <MenuItem label="Feedback" onClick={() => void go('/feedbacks')} />
          <div className="my-2 border-t border-hairline" />
          <MenuItem label="Chiqish" onClick={() => void logout()} danger />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  danger = false,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center rounded-xl px-3 py-3 text-left text-base transition hover:bg-ground-sunken ${
        danger ? 'text-danger' : 'text-ink'
      }`}
    >
      {label}
    </button>
  )
}

function TabLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `shrink-0 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold transition-colors ${
          isActive ? 'bg-signal-soft text-signal-ink' : 'text-ink-muted'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function RailLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `-mx-2 rounded-lg px-2 py-2 text-base transition-colors ${
          isActive ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

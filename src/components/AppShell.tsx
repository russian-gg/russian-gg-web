import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { levelDescriptionUz } from '../lib/format'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ProgressView } from '../lib/types'

const NAV = [
  { to: '/home', label: 'Bugungi dars' },
  { to: '/path', label: '90 kunlik yo’l' },
  { to: '/practice', label: 'Missionlar' },
  { to: '/progress', label: 'Progress' },
] as const

/**
 * Left-side navigation on desktop, compact top navigation on mobile (PRD §6). Four
 * destinations only: the home screen carries the next action, so navigation does not
 * need to.
 */
export function AppShell() {
  const { user, signOut } = useAuth()
  const isStaff = user?.role === 'ContentEditor' || user?.role === 'Administrator'

  return (
    <div className="min-h-dvh md:flex">
      {/* Mobile: compact top bar. */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Wordmark />
          <NavLink to="/settings" className="text-sm font-medium text-ink-muted">
            Sozlamalar
          </NavLink>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Asosiy">
          {NAV.map((item) => (
            <TabLink key={item.to} to={item.to}>
              {item.label}
            </TabLink>
          ))}
          {isStaff && <TabLink to="/admin">Kontent</TabLink>}
          <TabLink to="/feedbacks">Feedback</TabLink>
        </nav>
      </header>

      {/*
        Desktop: left rail with the learner anchored at the bottom. It is pinned to the
        viewport (sticky + h-dvh) so "Chiqish" sits at the bottom of the screen, not the
        bottom of a tall page — otherwise a long mission scrolls it below the fold. Scrolls
        internally on a short viewport.
      */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline px-6 py-8 md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto">
        <Wordmark />

        <nav className="mt-12 flex flex-col gap-1" aria-label="Asosiy">
          {NAV.map((item) => (
            <RailLink key={item.to} to={item.to}>
              {item.label}
            </RailLink>
          ))}
          {isStaff && <RailLink to="/admin">Kontent</RailLink>}
          <RailLink to="/feedbacks">Feedback</RailLink>
        </nav>

        <div className="mt-auto pt-8">
          <LearnerBlock />
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 rounded-lg text-sm font-medium text-ink-faint transition-colors hover:text-ink"
          >
            Chiqish
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-12 md:py-12">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * ".gg" carries the brand blue itself, not the darker text variant — a brand mark is
 * exempt from the text-contrast rule, and the lighter blue is the identity.
 */
function Wordmark() {
  return (
    <NavLink to="/home" className="text-xl font-semibold tracking-tight text-ink">
      russian<span className="text-signal">.gg</span>
    </NavLink>
  )
}

/** Name and current level — the learner's own state, not a marketing badge. */
function LearnerBlock() {
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Talaba'

  return (
    <NavLink to="/settings" className="block">
      <p className="text-base font-semibold text-ink">{name}</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {data ? `${data.speakingLevel} · ${levelDescriptionUz[data.speakingLevel]}` : 'Sozlamalar'}
      </p>
    </NavLink>
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

/**
 * The rail marks the active item with weight and ink colour rather than a filled pill —
 * closer to the approved direction, and it keeps the signal colour reserved for actions.
 */
function RailLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `-mx-2 rounded-lg px-2 py-2 text-base transition-colors ${
          isActive
            ? 'font-semibold text-ink'
            : 'font-medium text-ink-muted hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

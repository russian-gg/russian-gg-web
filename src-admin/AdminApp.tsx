import { useEffect, useState } from 'react'
import { adminApiPath, adminSectionKey, session, useSession } from './lib/api'
import type { PortalRole } from './lib/types'
import { Button, Card, ErrorNote } from './components/ui'
import { cx } from '../src/lib/cx'
import { useTheme } from '../src/lib/theme'
import {
  AiGlyph,
  ClicksGlyph,
  DashboardGlyph,
  FeedbackGlyph,
  MarketingGlyph,
  SalesGlyph,
  TransactionsGlyph,
  UsersGlyph,
} from './components/icons'
import { Dashboard } from './screens/Dashboard'
import { Users } from './screens/Users'
import { Transactions } from './screens/Transactions'
import { Clicks } from './screens/Clicks'
import { AiUsage } from './screens/AiUsage'
import { Feedbacks } from './screens/Feedbacks'
import { PromoCodes } from './screens/PromoCodes'
import { Marketing } from './screens/Marketing'
import { Sales } from './screens/Sales'
import { PortalUsers } from './screens/PortalUsers'

type Section =
  | 'dashboard'
  | 'users'
  | 'clicks'
  | 'marketing'
  | 'sales'
  | 'transactions'
  | 'ai-usage'
  | 'promo-codes'
  | 'feedbacks'
  | 'portal-users'

/**
 * `sales` marks the sections a sotuv account may open. It mirrors what the server allows —
 * the roles on the controllers are the rule, this is only what gets drawn.
 */
const sections: Array<{ id: Section; label: string; group: string; sales?: true }> = [
  { id: 'dashboard', label: 'Boshqaruv paneli', group: 'Sharh' },
  { id: 'users', label: 'Foydalanuvchilar', group: 'Sharh' },
  { id: 'clicks', label: 'Tugma bosishlari', group: 'Sharh' },
  /*
   * The two agents live together. They were split across "Sharh" and "Pul va AI" because one
   * writes plans and the other writes to customers — but what an operator looks for is "the
   * thing the AI is doing", and that was in two places.
   */
  { id: 'marketing', label: 'Marketing agenti (CMO)', group: 'Agents' },
  { id: 'sales', label: 'Sotuv agenti (Telegram)', group: 'Agents', sales: true },
  { id: 'transactions', label: 'Tranzaksiyalar', group: 'Pul va AI' },
  { id: 'ai-usage', label: 'AI ishlatilishi', group: 'Pul va AI' },
  { id: 'promo-codes', label: 'Promo kodlar', group: 'Pul va AI' },
  { id: 'feedbacks', label: 'Murojaatlar', group: 'Murojaat' },
  { id: 'portal-users', label: 'Xodimlar', group: 'Tizim' },
]

/** Paired here rather than in the icon module, because the section ids are this file's. */
const sectionGlyphs: Record<Section, () => React.ReactElement> = {
  dashboard: DashboardGlyph,
  users: UsersGlyph,
  clicks: ClicksGlyph,
  marketing: MarketingGlyph,
  sales: SalesGlyph,
  transactions: TransactionsGlyph,
  'ai-usage': AiGlyph,
  'promo-codes': TransactionsGlyph,
  feedbacks: FeedbackGlyph,
  'portal-users': UsersGlyph,
}

function visibleSections(role: PortalRole) {
  return role === 'Sales' ? sections.filter((item) => item.sales) : sections
}

function readStoredSection(role: PortalRole): Section {
  const allowed = visibleSections(role)
  const stored = localStorage.getItem(adminSectionKey)

  if (allowed.some((item) => item.id === stored)) return stored as Section

  return allowed[0]?.id ?? 'sales'
}

const COLLAPSED_KEY = 'rgg.admin.sidebar.collapsed'

export function AdminApp() {
  const { token, name, role } = useSession()
  const [section, setSection] = useState<Section>(() => readStoredSection(session.role()))
  // Remembered, because a sidebar that reopens on every reload is one nobody bothers closing.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true')

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  }, [collapsed])

  useEffect(() => {
    localStorage.setItem(adminSectionKey, section)
  }, [section])

  /*
   * The token is the only thing that decides which screen is up. Every request goes through
   * one fetch wrapper that drops the session on a 401, so an expired token puts the login
   * form back by itself — it used to leave the panel sitting there with an error box over
   * numbers nobody was authorised to see any more.
   */
  if (!token) return <LoginScreen />

  const allowed = visibleSections(role)
  const groups = [...new Set(allowed.map((item) => item.group))]
  /*
   * Signing out and back in as somebody else does not remount this component, so the section
   * chosen by the previous account is still in state. Derived rather than corrected in an
   * effect: a sales account must never get one render of the money screen.
   */
  const active = allowed.some((item) => item.id === section) ? section : (allowed[0]?.id ?? 'sales')

  return (
    <div
      className={cx(
        'grid min-h-screen grid-cols-1 bg-ground-sunken',
        // Only the wide layout collapses. On a phone the sections are already a scrolling row,
        // where there is nothing to collapse and no room to put a control for it.
        collapsed ? 'lg:grid-cols-[76px_1fr]' : 'lg:grid-cols-[264px_1fr]',
      )}
    >
      {/*
        One element, two shapes. On a phone it is a compact bar: the brand and the way out on
        one line, then the sections as a row that scrolls sideways. Stacked vertically — which
        is what the desktop sidebar does — those six buttons and their three headings pushed
        every screen a full page down, so the panel opened on its own menu.
      */}
      {/*
        Pinned from `lg`, where it is a column beside the content rather than a bar above it.
        Exactly viewport-tall and scrollable inside itself, so a long section list never pushes
        the sign-out button off the bottom with no way to reach it.

        Left alone on a phone: there it is a row that scrolls sideways at the top of the page,
        and pinning that would spend vertical space the content needs more.
      */}
      <aside className="flex flex-col gap-3 border-b-2 border-hairline bg-ground-raised px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:gap-6 lg:self-start lg:overflow-y-auto lg:border-r-2 lg:border-b-0 lg:p-5">
        <div className="flex items-center justify-between gap-4 lg:block">
          <div className={cx(collapsed && 'lg:hidden')}>
            <div className="text-xl font-extrabold tracking-tight text-ink">
              russian<span className="text-signal-ink">.gg</span>
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
              {role === 'Sales' ? 'Sotuv paneli' : 'Admin panel'}
            </div>
          </div>

          {/* The collapsed rail keeps a mark where the wordmark was, so the column still reads
              as this product rather than as a strip of icons. */}
          {collapsed && (
            <div className="hidden text-xl font-extrabold tracking-tight text-signal-ink lg:block">.gg</div>
          )}

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={() => session.signOut()}>
              Chiqish
            </Button>
          </div>
        </div>

        {/*
          `contents` collapses the group wrappers on small screens so their buttons become
          direct children of this row and scroll as one; from `lg` the wrappers come back and
          the groups stack with their headings.
        */}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Menyuni yoyish' : "Menyuni yig'ish"}
          className="hidden items-center justify-center rounded-[var(--radius-control)] border-2 border-hairline py-1.5 text-ink-muted transition-colors hover:border-ink-faint hover:text-ink lg:flex"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.8]">
            <path
              d={collapsed ? 'm10 6 6 6-6 6' : 'm14 6-6 6 6 6'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-5 lg:overflow-visible lg:px-0">
          {groups.map((group) => (
            <div key={group} className="contents lg:block">
              <div
                className={cx(
                  'mb-1.5 hidden px-3 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint',
                  collapsed ? 'lg:hidden' : 'lg:block',
                )}
              >
                {group}
              </div>
              <div className="contents lg:flex lg:flex-col lg:gap-1">
                {allowed
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Glyph = sectionGlyphs[item.id]

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSection(item.id)}
                        aria-current={active === item.id ? 'page' : undefined}
                        // The label is the tooltip when it is not on screen: an icon rail
                        // nobody can read is a guessing game.
                        title={collapsed ? item.label : undefined}
                        className={cx(
                          'flex shrink-0 items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2',
                          'text-left text-sm font-bold transition-colors',
                          collapsed && 'lg:justify-center lg:px-2',
                          /*
                           * Nowrap is for the phone, where these sit in a row that scrolls
                           * sideways and a wrapped pill would break the line. In the sidebar
                           * they are stacked, so a long label wraps rather than running out
                           * past the column — which is what "(CMO)" did.
                           */
                          'whitespace-nowrap lg:whitespace-normal lg:leading-snug',
                          active === item.id
                            ? 'bg-signal-soft text-signal-ink'
                            : 'text-ink-muted hover:bg-ground-sunken hover:text-ink',
                        )}
                      >
                        {/* Inherits the label's colour, so the active item turns as one thing. */}
                        <Glyph />
                        <span className={cx(collapsed && 'lg:hidden')}>{item.label}</span>
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto hidden flex-col gap-2 pt-4 lg:flex">
          <div className={cx('text-sm text-ink-muted', collapsed && 'lg:hidden')}>{name}</div>
          <ThemeToggle collapsed={collapsed} />
          <Button variant="secondary" size="sm" onClick={() => session.signOut()} title="Chiqish">
            <span className={cx(collapsed && 'lg:hidden')}>Chiqish</span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={cx('size-4 fill-none stroke-current stroke-[1.8]', !collapsed && 'lg:hidden')}
            >
              <path d="M15 17v1.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2V7M10 12h10m0 0-3-3m3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        {active === 'dashboard' && <Dashboard />}
        {active === 'users' && <Users />}
        {active === 'clicks' && <Clicks />}
        {active === 'marketing' && <Marketing />}
        {active === 'sales' && <Sales />}
        {active === 'transactions' && <Transactions />}
        {active === 'ai-usage' && <AiUsage />}
        {active === 'promo-codes' && <PromoCodes />}
        {active === 'feedbacks' && <Feedbacks />}
        {active === 'portal-users' && <PortalUsers />}
      </main>
    </div>
  )
}

/**
 * Light or dark, for a screen somebody has open all day.
 *
 * A button rather than a pair of radios: there are two states, and the label names the one it
 * would switch to. It re-points the same tokens the learner app uses, so the panel and the
 * product are never two different products in the dark.
 */
function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'dark' ? "Qorong'i rejim" : "Yorug' rejim"

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setTheme(next)}
      title={label}
      aria-label={label}
    >
      <span className={cx('flex items-center justify-center gap-2', collapsed && 'lg:gap-0')}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.8]">
          {next === 'dark' ? (
            // A moon means "go dark", a sun means "go light" — the icon is the destination,
            // which is what the word beside it says too.
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
        <span className={cx(collapsed && 'lg:hidden')}>{label}</span>
      </span>
    </Button>
  )
}

function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(adminApiPath('/login'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) throw new Error('Login failed')

      const data = await response.json()
      session.signIn(data.token, data.name, data.role)
    } catch {
      setError("Login yoki parol noto'g'ri. Qayta urinib ko'ring.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ground-sunken p-4 sm:p-6">
      <Card as="div" className="w-full max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-2xl font-extrabold tracking-tight text-ink">
              russian<span className="text-signal-ink">.gg</span>
            </div>
            <span className="rounded-[var(--radius-control)] bg-signal-soft px-3 py-1.5 text-xs font-bold text-signal-ink">
              Admin panel
            </span>
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-ink">Boshqaruv paneliga kirish</h1>
            <p className="mt-1 text-sm text-ink-muted">Alohida subdomainda ishlaydigan yopiq panel.</p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Login</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Loginni kiriting"
              className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Parol</span>
            <div className="relative">
              <input
                value={password}
                type={showPassword ? 'text' : 'password'}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Parolni kiriting"
                className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 pr-24 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[var(--radius-control)] px-3 py-1.5 text-xs font-bold text-ink-muted hover:bg-ground-sunken hover:text-ink"
              >
                {showPassword ? 'Yashirish' : "Ko'rsatish"}
              </button>
            </div>
          </label>

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" block disabled={loading}>
            {loading ? 'Kirilmoqda…' : 'Kirish'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

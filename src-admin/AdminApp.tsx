import { useEffect, useState } from 'react'
import { session, useSession } from './lib/api'
import { Button, Card, ErrorNote } from './components/ui'
import { cx } from '../src/lib/cx'
import { Dashboard } from './screens/Dashboard'
import { Users } from './screens/Users'
import { Transactions } from './screens/Transactions'
import { Clicks } from './screens/Clicks'
import { AiUsage } from './screens/AiUsage'
import { Feedbacks } from './screens/Feedbacks'
import { Marketing } from './screens/Marketing'

type Section = 'dashboard' | 'users' | 'clicks' | 'marketing' | 'transactions' | 'ai-usage' | 'feedbacks'

const sections: Array<{ id: Section; label: string; group: string }> = [
  { id: 'dashboard', label: 'Boshqaruv paneli', group: 'Sharh' },
  { id: 'users', label: 'Foydalanuvchilar', group: 'Sharh' },
  { id: 'clicks', label: 'Tugma bosishlari', group: 'Sharh' },
  { id: 'marketing', label: 'Marketing strategiya (CMO)', group: 'Sharh' },
  { id: 'transactions', label: 'Tranzaksiyalar', group: 'Pul va AI' },
  { id: 'ai-usage', label: 'AI ishlatilishi', group: 'Pul va AI' },
  { id: 'feedbacks', label: 'Murojaatlar', group: 'Murojaat' },
]

function readStoredSection(): Section {
  const stored = localStorage.getItem('rgg.admin.section')
  return sections.some((item) => item.id === stored) ? (stored as Section) : 'dashboard'
}

export function AdminApp() {
  const { token, name } = useSession()
  const [section, setSection] = useState<Section>(readStoredSection)

  useEffect(() => {
    localStorage.setItem('rgg.admin.section', section)
  }, [section])

  /*
   * The token is the only thing that decides which screen is up. Every request goes through
   * one fetch wrapper that drops the session on a 401, so an expired token puts the login
   * form back by itself — it used to leave the panel sitting there with an error box over
   * numbers nobody was authorised to see any more.
   */
  if (!token) return <LoginScreen />

  const groups = [...new Set(sections.map((item) => item.group))]

  return (
    <div className="grid min-h-screen grid-cols-1 bg-ground-sunken lg:grid-cols-[248px_1fr]">
      {/*
        One element, two shapes. On a phone it is a compact bar: the brand and the way out on
        one line, then the sections as a row that scrolls sideways. Stacked vertically — which
        is what the desktop sidebar does — those six buttons and their three headings pushed
        every screen a full page down, so the panel opened on its own menu.
      */}
      <aside className="flex flex-col gap-3 border-b-2 border-hairline bg-ground-raised px-4 py-3 lg:gap-6 lg:border-r-2 lg:border-b-0 lg:p-5">
        <div className="flex items-center justify-between gap-4 lg:block">
          <div>
            <div className="text-xl font-extrabold tracking-tight text-ink">
              russian<span className="text-signal-ink">.gg</span>
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">Admin panel</div>
          </div>

          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => session.signOut()}>
            Chiqish
          </Button>
        </div>

        {/*
          `contents` collapses the group wrappers on small screens so their buttons become
          direct children of this row and scroll as one; from `lg` the wrappers come back and
          the groups stack with their headings.
        */}
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-5 lg:overflow-visible lg:px-0">
          {groups.map((group) => (
            <div key={group} className="contents lg:block">
              <div className="mb-1.5 hidden px-3 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint lg:block">
                {group}
              </div>
              <div className="contents lg:flex lg:flex-col lg:gap-1">
                {sections
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      aria-current={section === item.id ? 'page' : undefined}
                      className={cx(
                        'shrink-0 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-bold whitespace-nowrap transition-colors',
                        section === item.id
                          ? 'bg-signal-soft text-signal-ink'
                          : 'text-ink-muted hover:bg-ground-sunken hover:text-ink',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto hidden flex-col gap-2 pt-4 lg:flex">
          <div className="text-sm text-ink-muted">{name}</div>
          <Button variant="secondary" size="sm" onClick={() => session.signOut()}>
            Chiqish
          </Button>
        </div>
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        {section === 'dashboard' && <Dashboard />}
        {section === 'users' && <Users />}
        {section === 'clicks' && <Clicks />}
        {section === 'marketing' && <Marketing />}
        {section === 'transactions' && <Transactions />}
        {section === 'ai-usage' && <AiUsage />}
        {section === 'feedbacks' && <Feedbacks />}
      </main>
    </div>
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
      const response = await fetch('/api/admin-portal/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) throw new Error('Login failed')

      const data = await response.json()
      session.signIn(data.token, data.name)
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

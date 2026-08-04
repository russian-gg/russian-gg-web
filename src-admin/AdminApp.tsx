import { useEffect, useMemo, useState } from 'react'

type Section = 'dashboard' | 'users' | 'transactions' | 'clicks' | 'content' | 'cms' | 'future' | 'notes' | 'feedbacks'

type Overview = {
  users: { totalUsers: number; newUsers30d: number; activeUsers30d: number; activeUsers7d: number }
  revenue: { totalRevenue: number; paidTransactions: number; currency: string; proUsers: number; freeUsers: number }
  topEvents: Array<{ label: string; value: number }>
  activitySeries: Array<{ date: string; value: number }>
  environment: string
}

type Paged<T> = { items: T[]; total: number }
type UserItem = { id: string; displayName?: string | null; email: string; uiLanguage: string; timeZoneId: string; plan: string; lastLoginAt?: string | null; createdAt: string; completedMissions: number }
type UserDetail = UserItem & { role: string; currentDay?: number | null; recommendedStartDay?: number | null; recentMissions: Array<{ id: string; missionId: string; status: string; overallScore?: number | null; createdAt: string; completedAt?: string | null }> }
type Transaction = { id: string; displayName?: string | null; email?: string | null; amount: number; currency: string; period: string; status: string; provider: string; createdAt: string; paidAt?: string | null }
type Cms = { systemPrompt: string; outfitPrompt: string; enhancePrompt: string }
type FeedbackItem = { id: string; userId: string; displayName?: string | null; email: string; source: string; issueType: string; title: string; message: string; attachmentName?: string | null; attachmentUrl?: string | null; createdAt: string }

const sections: Array<{ id: Section; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'clicks', label: 'Clicks' },
  { id: 'content', label: 'Content' },
  { id: 'cms', label: 'CMS' },
  { id: 'future', label: 'Future modules' },
  { id: 'notes', label: 'Izohlar' },
  { id: 'feedbacks', label: 'Feedbacks' },
]

function readStoredSection(): Section {
  const stored = localStorage.getItem('rgg.admin.section')
  return sections.some((item) => item.id === stored) ? (stored as Section) : 'dashboard'
}

export function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem('rgg.admin.token') ?? '')
  const [name, setName] = useState(() => localStorage.getItem('rgg.admin.name') ?? 'Russian.gg Admin')
  const [section, setSection] = useState<Section>(() => readStoredSection())

  useEffect(() => {
    if (token) localStorage.setItem('rgg.admin.token', token)
    else localStorage.removeItem('rgg.admin.token')
  }, [token])

  useEffect(() => {
    localStorage.setItem('rgg.admin.name', name)
  }, [name])

  useEffect(() => {
    localStorage.setItem('rgg.admin.section', section)
  }, [section])

  if (!token) {
    return <LoginScreen onLogin={(nextToken, nextName) => { setToken(nextToken); setName(nextName) }} />
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">Russian.gg</div>
          <div className="brand-sub">Admin portal</div>
        </div>
        <nav className="nav">
          {sections.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-name">{name}</div>
          <button className="ghost-button" onClick={() => setToken('')}>Logout</button>
        </div>
      </aside>
      <main className="content">
        {section === 'dashboard' && <Dashboard token={token} />}
        {section === 'users' && <Users token={token} />}
        {section === 'transactions' && <Transactions token={token} />}
        {section === 'clicks' && <Clicks token={token} />}
        {section === 'content' && <Content token={token} />}
        {section === 'cms' && <CmsEditor token={token} />}
        {section === 'future' && <FutureModules />}
        {section === 'notes' && <Comments token={token} />}
        {section === 'feedbacks' && <Feedbacks token={token} />}
      </main>
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (token: string, name: string) => void }) {
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
      onLogin(data.token, data.name)
    } catch {
      setError("Login yoki parol noto'g'ri. Qayta urinib ko'ring.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="login-wordmark">russian<span>.gg</span></div>
          <div className="login-badge">Admin panel</div>
        </div>
        <h1>Boshqaruv paneliga kirish</h1>
        <p>Asosiy russian.gg vizual ohangiga mos, alohida subdomainda ishlaydigan yopiq panel.</p>
        <label className="field">
          <span>Login</span>
          <input placeholder="Loginni kiriting" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span>Parol</span>
          <div className="password-field">
            <input
              placeholder="Parolni kiriting"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </label>
        {error && <div className="error-box">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Kirilmoqda...' : 'Kirish'}</button>
      </form>
    </div>
  )
}

function Dashboard({ token }: { token: string }) {
  const { data, error } = useAdminFetch<Overview>(token, '/api/admin-portal/overview')
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />

  return (
    <section>
      <Header title="Dashboard" subtitle={`Environment: ${data.environment}`} />
      <div className="grid stats-grid">
        <Stat title="Users" value={data.users.totalUsers} note={`+${data.users.newUsers30d} last 30d`} />
        <Stat title="Active 30d" value={data.users.activeUsers30d} note={`${data.users.activeUsers7d} last 7d`} />
        <Stat title="Revenue" value={`${formatMoney(data.revenue.totalRevenue)} ${data.revenue.currency}`} note={`${data.revenue.paidTransactions} paid`} />
        <Stat title="Plans" value={`${data.revenue.proUsers} Pro`} note={`${data.revenue.freeUsers} Free`} />
      </div>
      <div className="panel">
        <h3>Top product events</h3>
        <ul className="simple-list">
          {data.topEvents.map((item) => <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>)}
        </ul>
      </div>
      <div className="panel">
        <h3>Activity last 30 days</h3>
        <div className="mini-chart">
          {data.activitySeries.map((point) => (
            <div key={point.date} className="bar-wrap" title={`${point.date}: ${point.value}`}>
              <div className="bar" style={{ height: `${Math.min(180, Math.max(8, point.value * 6))}px` }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Users({ token }: { token: string }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [granting, setGranting] = useState(false)
  const [granted, setGranted] = useState<string | null>(null)

  /*
   * Opening Pro for one learner: a beta tester, a support gesture, a demo account. It is the
   * replacement for the preview flag that used to give Pro to everybody and switch payments
   * off for everybody while it did — this one has an owner, a reason and an end date.
   */
  async function grantPro(userId: string) {
    const days = Number(prompt('Grant Pro for how many days?', '30'))
    if (!Number.isFinite(days) || days < 1) return

    const reason = prompt('Why? This goes in the audit log.')?.trim()
    if (!reason) return

    setGranting(true)
    setGranted(null)
    try {
      const response = await fetch(`/api/admin-portal/users/${userId}/grant-pro`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ days, reason }),
      })

      setGranted(response.ok ? `Pro granted for ${days} days.` : 'Grant failed.')
    } catch {
      setGranted('Grant failed.')
    } finally {
      setGranting(false)
    }
  }
  const query = useMemo(() => `/api/admin-portal/users?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`, [page, search])
  const { data, error } = useAdminFetch<Paged<UserItem>>(token, query)
  const detail = useAdminFetch<UserDetail>(token, selected ? `/api/admin-portal/users/${selected}` : null)
  if (error) return <ErrorBox message={error} />

  return (
    <section>
      <Header title="Users" subtitle="Read-only learner list adapted to the current learning product." />
      <div className="toolbar">
        <input placeholder="Search by email or name" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} />
      </div>
      {!data ? <Loading /> : (
        <div className="panel">
          <table className="table">
            <thead><tr><th>User</th><th>Plan</th><th>Language</th><th>Missions</th><th>Last login</th></tr></thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} onClick={() => setSelected(item.id)}>
                  <td><strong>{item.displayName || 'No name'}</strong><div>{item.email}</div></td>
                  <td>{item.plan}</td>
                  <td>{item.uiLanguage}</td>
                  <td>{item.completedMissions}</td>
                  <td>{formatDate(item.lastLoginAt || item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={data.total} onPage={setPage} />
        </div>
      )}
      {selected && detail.data && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <h3>{detail.data.displayName || 'No name'}</h3>
            <p>{detail.data.email}</p>
            <div className="kv"><span>Plan</span><strong>{detail.data.plan}</strong></div>
            <div className="kv"><span>Current day</span><strong>{detail.data.currentDay ?? '-'}</strong></div>
            <div className="kv"><span>Recommended start</span><strong>{detail.data.recommendedStartDay ?? '-'}</strong></div>
            <div className="kv">
              <span>Access</span>
              <button type="button" disabled={granting} onClick={() => void grantPro(detail.data!.id)}>
                {granting ? 'Granting…' : 'Grant Pro'}
              </button>
            </div>
            {granted && <p>{granted}</p>}

            <h4>Recent missions</h4>
            <ul className="simple-list">
              {detail.data.recentMissions.map((mission) => <li key={mission.id}><span>{mission.status}</span><strong>{mission.overallScore ?? '-'}</strong></li>)}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

function Transactions({ token }: { token: string }) {
  const [page, setPage] = useState(1)
  const { data, error } = useAdminFetch<Paged<Transaction>>(token, `/api/admin-portal/transactions?page=${page}&pageSize=20`)
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  return (
    <section>
      <Header title="Transactions" subtitle="Payment invoices from the existing Click billing flow." />
      <div className="panel">
        <table className="table">
          <thead><tr><th>User</th><th>Amount</th><th>Status</th><th>Provider</th><th>Date</th></tr></thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.displayName || 'No name'}</strong><div>{item.email || '-'}</div></td>
                <td>{formatMoney(item.amount)} {item.currency}</td>
                <td>{item.status}</td>
                <td>{item.provider}</td>
                <td>{formatDate(item.paidAt || item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} total={data.total} onPage={setPage} />
      </div>
    </section>
  )
}

function Clicks({ token }: { token: string }) {
  const { data, error } = useAdminFetch<Array<{ label: string; value: number }>>(token, '/api/admin-portal/clicks')
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  return (
    <section>
      <Header title="Clicks" subtitle="Analytics event counts captured by the current learner frontend." />
      <div className="panel">
        <ul className="simple-list">
          {data.map((item) => <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>)}
        </ul>
      </div>
    </section>
  )
}

function Content({ token }: { token: string }) {
  const { data, error } = useAdminFetch<Array<{ id: string; title: string; slug: string; status: string; day?: number | null; updatedAt: string }>>(token, '/api/admin-portal/content')
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  return (
    <section>
      <Header title="Content" subtitle="Mission publishing overview pulled from existing content governance records." />
      <div className="panel">
        <table className="table">
          <thead><tr><th>Title</th><th>Status</th><th>Day</th><th>Updated</th></tr></thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong><div>{item.slug}</div></td>
                <td>{item.status}</td>
                <td>{item.day ?? '-'}</td>
                <td>{formatDate(item.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CmsEditor({ token }: { token: string }) {
  const { data, error, refresh } = useAdminFetch<Cms>(token, '/api/admin-portal/cms')
  const [draft, setDraft] = useState<Cms | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (data) setDraft(data) }, [data])
  if (error) return <ErrorBox message={error} />
  if (!draft) return <Loading />

  async function save() {
    setSaving(true)
    await fetch('/api/admin-portal/cms', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(draft),
    })
    setSaving(false)
    refresh()
  }

  return (
    <section>
      <Header title="CMS prompts" subtitle="File-backed admin prompts stored outside the learner bundle." />
      <div className="panel">
        <label>System prompt<textarea value={draft.systemPrompt} onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })} /></label>
        <label>Outfit prompt<textarea value={draft.outfitPrompt} onChange={(e) => setDraft({ ...draft, outfitPrompt: e.target.value })} /></label>
        <label>Enhance prompt<textarea value={draft.enhancePrompt} onChange={(e) => setDraft({ ...draft, enhancePrompt: e.target.value })} /></label>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save prompts'}</button>
      </div>
    </section>
  )
}

function FutureModules() {
  return (
    <section>
      <Header title="Future modules" subtitle="Specdagi qolgan bo'limlar shu loyiha domeniga mos data paydo bo'lganda kengaytiriladi." />
      <div className="panel">
        <p>Notifications, AI usage, support tickets va blog/CMSning boyroq CRUD versiyalari hozirgi backend domenida hali mavjud emas, shuning uchun bu admin portal asosiy tizimga zarar bermaydigan minimal adaptatsiya bilan chiqarildi.</p>
      </div>
    </section>
  )
}

function Comments({ token }: { token: string }) {
  const [page, setPage] = useState(1)
  const { data, error } = useAdminFetch<Paged<FeedbackItem>>(token, `/api/admin-portal/feedback?source=comment&page=${page}&pageSize=20`)
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />

  return (
    <section>
      <Header title="Izohlar" subtitle="Eski Fikr yuborish oynasidan kelgan qisqa izohlar va kommentlar." />
      <div className="panel">
        <table className="table">
          <thead><tr><th>User</th><th>Izoh</th><th>Vaqt</th></tr></thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.displayName || 'No name'}</strong><div>{item.email}</div></td>
                <td className="max-w-xl whitespace-pre-wrap break-words">{item.message}</td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} total={data.total} onPage={setPage} />
      </div>
    </section>
  )
}

function Feedbacks({ token }: { token: string }) {
  const [page, setPage] = useState(1)
  const [issueType, setIssueType] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const query = `/api/admin-portal/feedback?source=feedback_form&page=${page}&pageSize=20${issueType ? `&issueType=${encodeURIComponent(issueType)}` : ''}`
  const { data, error } = useAdminFetch<Paged<FeedbackItem>>(token, query)
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />

  const issueTypes = Array.from(new Set(data.items.map((item) => item.issueType).filter(Boolean)))

  async function downloadAttachment(item: FeedbackItem) {
    if (!item.attachmentUrl) return
    setDownloadingId(item.id)
    setDownloadError('')

    try {
      const response = await fetch(item.attachmentUrl, {
        headers: { authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Faylni yuklab olishda xatolik yuz berdi.')
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = item.attachmentName || 'feedback-attachment'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (next) {
      setDownloadError(next instanceof Error ? next.message : 'Faylni yuklab olib bo‘lmadi.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section>
      <Header title="Feedbacks" subtitle="Yangi feedback formasi orqali kelgan to'liq murojaatlar." />
      <div className="toolbar">
        <select value={issueType} onChange={(event) => { setPage(1); setIssueType(event.target.value) }}>
          <option value="">Barcha masalalar</option>
          {issueTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {downloadError && <ErrorBox message={downloadError} />}
      <div className="panel">
        <table className="table">
          <thead><tr><th>User</th><th>Turi</th><th>Sarlavha</th><th>Izoh</th><th>Fayl</th><th>Vaqt</th></tr></thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.displayName || 'No name'}</strong><div>{item.email}</div></td>
                <td>{item.issueType || '-'}</td>
                <td className="max-w-xs whitespace-pre-wrap break-words"><strong>{item.title || '-'}</strong></td>
                <td className="max-w-xl whitespace-pre-wrap break-words">{item.message}</td>
                <td>
                  {item.attachmentUrl ? (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={downloadingId === item.id}
                      onClick={() => void downloadAttachment(item)}
                    >
                      {downloadingId === item.id ? 'Yuklanmoqda...' : (item.attachmentName || 'Yuklab olish')}
                    </button>
                  ) : '-'}
                </td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} total={data.total} onPage={setPage} />
      </div>
    </section>
  )
}

function useAdminFetch<T>(token: string, path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    setError('')
    fetch(path, { headers: { authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Session expired.' : 'Request failed.')
        return response.json() as Promise<T>
      })
      .then((next) => { if (!cancelled) setData(next) })
      .catch((next) => { if (!cancelled) setError(next.message) })
    return () => { cancelled = true }
  }, [token, path, tick])

  return { data, error, refresh: () => setTick((x) => x + 1) }
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="page-header"><h1>{title}</h1><p>{subtitle}</p></div>
}
function Stat({ title, value, note }: { title: string; value: string | number; note: string }) {
  return <div className="panel"><h3>{title}</h3><div className="stat-value">{value}</div><p>{note}</p></div>
}
function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>
}
function Loading() {
  return <div className="panel">Loading...</div>
}
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 20))
  return <div className="pager"><button disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></div>
}
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : '-'
}
function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

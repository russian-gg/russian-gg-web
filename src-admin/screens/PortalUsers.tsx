import { useState } from 'react'
import { adminFetch, formatDateTime, useAdminQuery } from '../lib/api'
import type { AdminPortalUser, PortalRole } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Cell,
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  Row,
  Table,
} from '../components/ui'

type FormState = {
  username: string
  displayName: string
  password: string
  role: PortalRole
}

const initialForm = (): FormState => ({ username: '', displayName: '', password: '', role: 'Sales' })

/**
 * Six characters of alphabet and digits, no ambiguous pair in it. The account is handed over
 * in a Telegram message and typed back by somebody who did not choose it, so an l next to a 1
 * costs a support conversation.
 */
function suggestPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

const roleLabel: Record<PortalRole, string> = {
  Admin: 'Administrator',
  Sales: 'Sotuv',
}

export function PortalUsers() {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminPortalUser[]>('/api/admin-portal/portal-users')
  const [form, setForm] = useState<FormState>(initialForm)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  /*
   * Shown once, on this screen, right after the account is made. The server keeps a hash and
   * cannot tell anyone what the password was — so if it is not read now, the only way back is
   * a new account.
   */
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null)

  async function createUser(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')

    const password = form.password.trim() || suggestPassword()

    try {
      await adminFetch<AdminPortalUser>('/api/admin-portal/portal-users', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username.trim(),
          displayName: form.displayName.trim(),
          password,
          role: form.role,
        }),
      })

      setIssued({ username: form.username.trim(), password })
      setForm(initialForm())
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Hisob yaratib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  async function setActive(user: AdminPortalUser, active: boolean) {
    try {
      await adminFetch(`/api/admin-portal/portal-users/${user.id}/active?active=${active}`, { method: 'POST' })
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Holatni o'zgartirib bo'lmadi.")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Xodimlar" subtitle="Panelga kim kira oladi va qaysi huquq bilan" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <Card as="div">
          <form onSubmit={createUser} className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink">Yangi hisob</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Sotuv hisobi faqat “Sotuv agenti” bo'limini ko'radi. Pul, foydalanuvchilar va marketing
                yopiq turadi.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">Login</span>
              <input
                value={form.username}
                onChange={(event) =>
                  setForm((state) => ({ ...state, username: event.target.value.toLowerCase().replace(/\s+/g, '') }))
                }
                placeholder="masalan: aziza"
                autoComplete="off"
                className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">Ism</span>
              <input
                value={form.displayName}
                onChange={(event) => setForm((state) => ({ ...state, displayName: event.target.value }))}
                placeholder="Aziza Karimova"
                className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">Huquq</span>
              <select
                value={form.role}
                onChange={(event) => setForm((state) => ({ ...state, role: event.target.value as PortalRole }))}
                className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-3 text-sm font-semibold text-ink focus:border-signal focus:outline-none"
              >
                <option value="Sales">Sotuv — faqat Telegram suhbatlari</option>
                <option value="Admin">Administrator — hamma bo'lim</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">Parol</span>
              <div className="flex gap-2">
                <input
                  value={form.password}
                  onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
                  placeholder="Bo'sh qoldirsangiz — o'zi yaratiladi"
                  autoComplete="new-password"
                  className="h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => setForm((state) => ({ ...state, password: suggestPassword() }))}>
                  Yaratish
                </Button>
              </div>
              <span className="mt-1.5 block text-xs text-ink-faint">Kamida 8 ta belgi.</span>
            </label>

            {failure && <ErrorNote>{failure}</ErrorNote>}

            <Button type="submit" block disabled={busy}>
              {busy ? 'Yaratilmoqda...' : 'Hisob yaratish'}
            </Button>
          </form>

          {issued && (
            <div className="mt-4 rounded-[var(--radius-card)] border-2 border-signal/40 bg-signal/10 p-4">
              <div className="text-sm font-extrabold text-ink">Hisob tayyor. Parolni hozir ko'chirib oling.</div>
              <p className="mt-1 text-xs text-ink-muted">
                Bu parol boshqa ko'rsatilmaydi — serverda faqat shifrlangan nusxasi saqlanadi.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-sm text-ink">
                <span className="rounded-[var(--radius-control)] bg-ground-raised px-3 py-1.5">{issued.username}</span>
                <span className="rounded-[var(--radius-control)] bg-ground-raised px-3 py-1.5">{issued.password}</span>
                <Button
                  type="button"
                  variant="secondary" size="sm"
                  onClick={() => navigator.clipboard?.writeText(`${issued.username} / ${issued.password}`)}
                >
                  Nusxalash
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setIssued(null)}>
                  Yopish
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {error && <ErrorNote>{error}</ErrorNote>}
          {!data && isLoading && <Loading />}
          {data?.length === 0 && (
            <EmptyNote>Hozircha alohida hisob yo'q — panelga faqat asosiy login bilan kirilyapti.</EmptyNote>
          )}

          {data && data.length > 0 && (
            <Table head={['Login', 'Ism', 'Huquq', 'Holat', 'Oxirgi kirish', '']}>
              {data.map((user) => (
                <Row key={user.id}>
                  <Cell strong>{user.username}</Cell>
                  <Cell muted>{user.displayName}</Cell>
                  <Cell>
                    <Badge tone={user.role === 'Admin' ? 'signal' : 'neutral'}>{roleLabel[user.role] ?? user.role}</Badge>
                  </Cell>
                  <Cell>
                    <Badge tone={user.isActive ? 'milestone' : 'neutral'}>{user.isActive ? 'Faol' : "O'chirilgan"}</Badge>
                  </Cell>
                  <Cell muted>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Hali kirmagan'}</Cell>
                  <Cell>
                    <Button
                      type="button"
                      variant={user.isActive ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => setActive(user, !user.isActive)}
                    >
                      {user.isActive ? "O'chirish" : 'Yoqish'}
                    </Button>
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}

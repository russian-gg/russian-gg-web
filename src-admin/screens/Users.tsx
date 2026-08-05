import { useState } from 'react'
import { adminFetch, formatDate, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import type { Audience, Paged, UserDetail, UserItem } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Cell,
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  Pager,
  Row,
  SectionHeading,
  Table,
  Tabs,
  TextField,
} from '../components/ui'
import { BarList, Donut } from '../components/charts'

const PAGE_SIZE = 20

export function Users() {
  const [tab, setTab] = useState<'list' | 'audience'>('list')

  return (
    <div className="space-y-6">
      <PageHeader title="Foydalanuvchilar" subtitle="Foydalanuvchilar ro'yxati va auditoriya" />

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'list', label: 'Foydalanuvchilar' },
          { id: 'audience', label: 'Auditoriya' },
        ]}
      />

      {tab === 'list' ? <UserList /> : <AudienceTab />}
    </div>
  )
}

function UserList() {
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const { data, error, isLoading, refresh } = useAdminQuery<Paged<UserItem>>(
    `/api/admin-portal/users?page=${page}&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
  )

  function find() {
    setPage(1)
    setSearch(draft.trim())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <TextField
          value={draft}
          onChange={setDraft}
          onSubmit={find}
          placeholder="Ism yoki email bo'yicha qidirish"
          className="w-full sm:w-80"
        />
        <Button onClick={find}>Topish</Button>
        {data && <span className="text-sm text-ink-muted">Jami: {formatNumber(data.total)}</span>}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && isLoading && <Loading />}

      {data && (
        <>
          {/*
            Columns the product can fill. Every one of these has a value for every learner —
            an always-empty column looks like a broken query, not a fact about the data.
          */}
          <Table head={['Foydalanuvchi', 'Daraja', 'Reja', 'Kun', 'Mashqlar', 'Oxirgi kirish', "Ro'yxatdan o'tgan"]}>
            {data.items.map((user) => (
              <Row key={user.id} onClick={() => setSelected(user.id)}>
                <Cell>
                  <span className="block font-bold text-ink">{user.displayName ?? 'Ismsiz'}</span>
                  <span className="block text-xs text-ink-faint">{user.email}</span>
                </Cell>
                <Cell>
                  {/* A dash, not A0: an unmeasured learner has not been placed at the bottom. */}
                  {user.speakingLevel ? (
                    <Badge tone="milestone">{user.speakingLevel}</Badge>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </Cell>
                <Cell>
                  <Badge tone={user.plan === 'Free' ? 'neutral' : 'signal'}>{user.plan.toLowerCase()}</Badge>
                </Cell>
                <Cell muted>{user.currentDay ? `${user.currentDay}-kun` : '—'}</Cell>
                <Cell muted>{formatNumber(user.completedMissions)}</Cell>
                <Cell muted>{formatDate(user.lastLoginAt)}</Cell>
                <Cell muted>{formatDate(user.createdAt)}</Cell>
              </Row>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyNote>Hech kim topilmadi</EmptyNote>
                </td>
              </tr>
            )}
          </Table>

          <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}

      {selected && (
        <UserDrawer
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            refresh()
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function UserDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const { data, error } = useAdminQuery<UserDetail>(`/api/admin-portal/users/${id}`)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function grantPro() {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/users/${id}/grant-pro`, {
        method: 'POST',
        body: JSON.stringify({ days: 30, reason: 'Admin panel' }),
      })
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Bajarilmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/35" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-auto bg-ground p-4 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && !error && <Loading />}

        {data && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-ink">{data.displayName ?? 'Ismsiz'}</h2>
                <p className="text-sm text-ink-muted">{data.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Yopish
              </Button>
            </div>

            <Card className="space-y-2">
              <Line label="Gapirish darajasi" value={data.speakingLevel ?? '— (aniqlanmagan)'} />
              <Line label="Tushunish darajasi" value={data.comprehensionLevel ?? '— (aniqlanmagan)'} />
              <Line label="Reja" value={data.plan} />
              <Line label="Rol" value={data.role} />
              <Line label="Til" value={data.uiLanguage} />
              <Line label="Vaqt mintaqasi" value={data.timeZoneId} />
              <Line label="Kurs kuni" value={data.currentDay ? `${data.currentDay}-kun` : '—'} />
              <Line
                label="Tavsiya etilgan boshlanish"
                value={data.recommendedStartDay ? `${data.recommendedStartDay}-kun` : '—'}
              />
              <Line label="Oxirgi kirish" value={formatDateTime(data.lastLoginAt)} />
              <Line label="Ro'yxatdan o'tgan" value={formatDateTime(data.createdAt)} />
            </Card>

            <div>
              <SectionHeading>Oxirgi mashqlar</SectionHeading>
              {data.recentMissions.length === 0 ? (
                <EmptyNote>Hali mashq boshlanmagan</EmptyNote>
              ) : (
                <ul className="space-y-2">
                  {data.recentMissions.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border-2 border-hairline px-4 py-3"
                    >
                      <span className="text-sm text-ink">{formatDateTime(attempt.createdAt)}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={attempt.status === 'Completed' ? 'milestone' : 'neutral'}>
                          {attempt.status}
                        </Badge>
                        <span className="w-8 text-right text-sm tabular-nums text-ink-muted">
                          {attempt.overallScore ?? '—'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {failure && <ErrorNote>{failure}</ErrorNote>}

            <Button onClick={grantPro} disabled={busy} block>
              {busy ? 'Berilmoqda…' : "30 kunlik PRO berish"}
            </Button>
          </div>
        )}
      </aside>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-bold text-ink">{value}</span>
    </div>
  )
}

/**
 * The breakdowns Russian.gg can actually answer. The panel this follows splits its audience
 * by gender and region — neither of which this product asks for, and a column that can only
 * render a dash is worse than the honest question next to it.
 */
function AudienceTab() {
  const { data, error, isLoading } = useAdminQuery<Audience>('/api/admin-portal/audience')

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const languageNames: Record<string, string> = { uz: "O'zbek", ru: 'Rus', en: 'Ingliz' }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-4 text-base font-extrabold text-ink">Darajalar</h3>
        <BarList items={data.levels} labelWidth="w-24 sm:w-32" />
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-extrabold text-ink">Interfeys tili</h3>
        <Donut
          slices={data.languages.map((item) => ({
            label: languageNames[item.label] ?? item.label,
            value: item.value,
          }))}
        />
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-extrabold text-ink">Reja</h3>
        <Donut slices={data.plans} />
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-extrabold text-ink">Ro'yxatdan o'tish usuli</h3>
        <BarList items={data.signupMethods} labelWidth="w-20 sm:w-24" />
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-extrabold text-ink">Kurs bosqichi</h3>
        <BarList items={data.coursePhases} labelWidth="w-24 sm:w-28" />
      </Card>
    </div>
  )
}

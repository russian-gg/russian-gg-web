import { useState } from 'react'
import { useStickyTab } from '../lib/sticky-tab'
import { formatDate, formatNumber, useAdminQuery } from '../lib/api'
import type { Audience, Paged, UserItem } from '../lib/types'
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
  Table,
  Tabs,
  TextField,
} from '../components/ui'
import { BarList, Donut } from '../components/charts'
import { UserDrawer } from '../components/UserDrawer'

const PAGE_SIZE = 20

const USER_TABS = ['list', 'audience'] as const

export function Users() {
  const [tab, setTab] = useStickyTab('users', USER_TABS)

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
          {/* Columns the product can fill. Empty columns look like a broken query, not a fact. */}
          <Table
            head={[
              'Foydalanuvchi',
              'Qurilma',
              'Daraja',
              'Reja',
              'Kun',
              'Mashqlar',
              'Oxirgi kirish',
              "Ro'yxatdan o'tgan",
            ]}
          >
            {data.items.map((user) => (
              <Row key={user.id} onClick={() => setSelected(user.id)}>
                <Cell>
                  <span className="block font-bold text-ink">{user.displayName ?? 'Ismsiz'}</span>
                  <span className="block text-xs text-ink-faint">{user.email}</span>
                  {user.phoneNumber && (
                    <span className="block text-xs text-ink-faint">{user.phoneNumber}</span>
                  )}
                </Cell>
                <Cell muted>{user.device}</Cell>
                <Cell>
                  {user.speakingLevel ? (
                    <Badge tone="milestone">{user.speakingLevel}</Badge>
                  ) : (
                    <span className="text-ink-faint">-</span>
                  )}
                </Cell>
                <Cell>
                  <Badge tone={user.plan === 'Free' ? 'neutral' : 'signal'}>{user.plan.toLowerCase()}</Badge>
                </Cell>
                <Cell muted>{user.currentDay ? `${user.currentDay}-kun` : '-'}</Cell>
                <Cell muted>{formatNumber(user.completedMissions)}</Cell>
                <Cell muted>{formatDate(user.lastLoginAt)}</Cell>
                <Cell muted>{formatDate(user.createdAt)}</Cell>
              </Row>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={8}>
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
          userId={selected}
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

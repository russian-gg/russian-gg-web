import { useState } from 'react'
import { formatDate, formatMoney, formatNumber, useAdminQuery } from '../lib/api'
import type { Paged, Transaction } from '../lib/types'
import { Badge, Cell, EmptyNote, ErrorNote, Loading, PageHeader, Pager, Row, Table } from '../components/ui'

const PAGE_SIZE = 20

/** Paid, pending and cancelled are three different facts about money, so they read differently. */
const statusTone = {
  Paid: 'milestone',
  Pending: 'caution',
  Cancelled: 'danger',
} as const

const statusLabel = {
  Paid: "To'langan",
  Pending: 'Kutilmoqda',
  Cancelled: 'Bekor qilingan',
} as const

export function Transactions() {
  const [page, setPage] = useState(1)
  const { data, error, isLoading } = useAdminQuery<Paged<Transaction>>(
    `/api/admin-portal/transactions?page=${page}&pageSize=${PAGE_SIZE}`,
  )

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  return (
    <div className="space-y-6">
      <PageHeader title="Tranzaksiyalar" subtitle={`Jami: ${formatNumber(data.total)}`} />

      <Table head={['Foydalanuvchi', 'Summa', 'Promo', 'Davr', 'Provayder', 'Status', 'Sana']}>
        {data.items.map((item) => {
          const status = item.status as keyof typeof statusTone

          return (
            <Row key={item.id}>
              <Cell>
                <span className="block font-bold text-ink">{item.displayName ?? 'Ismsiz'}</span>
                <span className="block text-xs text-ink-faint">{item.email ?? '—'}</span>
              </Cell>
              <Cell>
                <div className="font-bold text-ink">{formatMoney(item.amount, item.currency)}</div>
                {item.discountAmount > 0 && (
                  <div className="text-xs text-ink-faint line-through">
                    {formatMoney(item.originalAmount, item.currency)}
                  </div>
                )}
              </Cell>
              <Cell muted>{item.promoCode ?? '—'}</Cell>
              <Cell muted>{item.period}</Cell>
              <Cell muted>{item.provider}</Cell>
              <Cell>
                <Badge tone={statusTone[status] ?? 'neutral'}>{statusLabel[status] ?? item.status}</Badge>
              </Cell>
              <Cell muted>{formatDate(item.paidAt ?? item.createdAt)}</Cell>
            </Row>
          )
        })}
        {data.items.length === 0 && (
          <tr>
                <td colSpan={7}>
                  <EmptyNote>Hali to'lov yo'q</EmptyNote>
                </td>
              </tr>
            )}
      </Table>

      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  )
}

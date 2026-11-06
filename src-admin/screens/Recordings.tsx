import { useState } from 'react'
import { formatDate, useAdminQuery } from '../lib/api'
import type { Paged, RecordingItem } from '../lib/types'
import { Cell, EmptyNote, ErrorNote, LoadingRows, PageHeader, Pager, Row, Screen, Table } from '../components/ui'

const PAGE_SIZE = 20

/**
 * Recorded answers to listen to for quality review.
 *
 * Only learners who switched on both "Ovoz yozuvlarini saqlash" and "Sifat nazorati uchun
 * tinglash" appear here, and the server checks it on every load: somebody who takes either
 * back disappears from this list the next time it is opened.
 */
export function Recordings() {
  const [page, setPage] = useState(1)
  const { data, error, isLoading } = useAdminQuery<Paged<RecordingItem>>(
    `/api/admin-portal/recordings?page=${page}&pageSize=${PAGE_SIZE}`,
  )

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <LoadingRows />
  if (!data) return null

  return (
    <Screen className="space-y-6">
      <PageHeader
        title="Ovoz yozuvlari"
        subtitle="Tinglashga ruxsat bergan foydalanuvchilarning javoblari. Izoh toʻgʻri berilganini tekshirish uchun."
      />

      <Table head={['Foydalanuvchi', 'Mashq', 'Javob', 'Yozuv', 'Ball', 'Vaqt']}>
        {data.items.map((item) => (
          <Row key={item.id}>
            <Cell>
              <span className="block font-bold text-ink">{item.displayName || 'Ismsiz'}</span>
              <span className="block text-xs text-ink-faint">{item.email}</span>
            </Cell>
            <Cell muted>{item.missionTitle}</Cell>
            <Cell wrap>
              <span className="block min-w-56 max-w-md break-words">
                <span className="block text-ink">{item.transcript || '—'}</span>
                {item.pronunciationNote && (
                  <span className="mt-1 block text-xs text-ink-muted">{item.pronunciationNote}</span>
                )}
              </span>
            </Cell>
            <Cell>
              <audio controls preload="none" src={item.audioUrl} className="h-9 w-64" />
            </Cell>
            <Cell muted>{item.score ?? '—'}</Cell>
            <Cell muted>{formatDate(item.recordedAt)}</Cell>
          </Row>
        ))}
        {data.items.length === 0 && (
          <tr>
            <td colSpan={6}>
              <EmptyNote>Hozircha tinglash mumkin boʻlgan yozuv yoʻq</EmptyNote>
            </td>
          </tr>
        )}
      </Table>

      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
    </Screen>
  )
}

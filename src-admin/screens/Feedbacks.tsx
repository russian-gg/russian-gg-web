import { useState } from 'react'
import { formatDate, session, useAdminQuery } from '../lib/api'
import type { FeedbackItem, Paged } from '../lib/types'
import {
  Button,
  Cell,
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  Pager,
  Row,
  Select,
  Table,
} from '../components/ui'

const PAGE_SIZE = 20

export function Feedbacks() {
  const [page, setPage] = useState(1)
  const [issueType, setIssueType] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [failure, setFailure] = useState('')

  const query = `/api/admin-portal/feedback?source=feedback_form&page=${page}&pageSize=${PAGE_SIZE}${
    issueType ? `&issueType=${encodeURIComponent(issueType)}` : ''
  }`
  const { data, error, isLoading } = useAdminQuery<Paged<FeedbackItem>>(query)

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const issueTypes = Array.from(new Set(data.items.map((item) => item.issueType).filter(Boolean)))

  /**
   * The attachment is behind the same bearer token as everything else, so it cannot simply be
   * a link — it is fetched, turned into a blob and handed to the browser.
   */
  async function download(item: FeedbackItem) {
    if (!item.attachmentUrl) return

    setDownloading(item.id)
    setFailure('')

    try {
      const response = await fetch(item.attachmentUrl, {
        headers: { authorization: `Bearer ${session.token()}` },
      })

      if (!response.ok) throw new Error('Faylni yuklab olishda xatolik yuz berdi.')

      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = item.attachmentName || 'feedback-attachment'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Faylni yuklab olib bo'lmadi.")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Murojaatlar" subtitle="Feedback formasi orqali kelgan to'liq murojaatlar" />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          label="Masala turi"
          value={issueType}
          onChange={(value) => {
            setPage(1)
            setIssueType(value)
          }}
          options={[
            { value: '', label: 'Barcha masalalar' },
            ...issueTypes.map((item) => ({ value: item, label: item })),
          ]}
        />
      </div>

      {failure && <ErrorNote>{failure}</ErrorNote>}

      <Table head={['Foydalanuvchi', 'Turi', 'Sarlavha', 'Izoh', 'Fayl', 'Vaqt']}>
        {data.items.map((item) => (
          <Row key={item.id}>
            <Cell>
              <span className="block font-bold text-ink">{item.displayName || 'Ismsiz'}</span>
              <span className="block text-xs text-ink-faint">{item.email}</span>
            </Cell>
            <Cell muted>{item.issueType || '—'}</Cell>
            <Cell strong wrap>
              <span className="block max-w-xs break-words">{item.title || '—'}</span>
            </Cell>
            <Cell wrap>
              <span className="block max-w-md whitespace-pre-wrap break-words">{item.message}</span>
            </Cell>
            <Cell>
              {item.attachmentUrl ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={downloading === item.id}
                  onClick={() => void download(item)}
                >
                  {downloading === item.id ? 'Yuklanmoqda…' : item.attachmentName || 'Yuklab olish'}
                </Button>
              ) : (
                '—'
              )}
            </Cell>
            <Cell muted>{formatDate(item.createdAt)}</Cell>
          </Row>
        ))}
        {data.items.length === 0 && (
          <tr>
            <td colSpan={6}>
              <EmptyNote>Murojaat yo'q</EmptyNote>
            </td>
          </tr>
        )}
      </Table>

      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  )
}

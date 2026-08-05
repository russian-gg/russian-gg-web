import { useEffect, useState } from 'react'
import { adminFetch, formatDate, session, useAdminQuery } from '../lib/api'
import type { Cms, ContentItem, FeedbackItem, Paged } from '../lib/types'
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
  Select,
  Table,
} from '../components/ui'

const PAGE_SIZE = 20

export function Content() {
  const { data, error, isLoading } = useAdminQuery<ContentItem[]>('/api/admin-portal/content')

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  return (
    <div className="space-y-6">
      <PageHeader title="Kontent" subtitle="Mashqlarning nashr holati" />

      <Table head={['Mashq', 'Holat', 'Kun', 'Yangilangan']}>
        {data.map((item) => (
          <Row key={item.id}>
            <Cell>
              <span className="block font-bold text-ink">{item.title}</span>
              <span className="block text-xs text-ink-faint">{item.slug}</span>
            </Cell>
            <Cell>
              <Badge tone={item.reviewStatus === 'Published' ? 'milestone' : 'caution'}>{item.reviewStatus}</Badge>
            </Cell>
            <Cell muted>{item.courseDay ?? '—'}</Cell>
            <Cell muted>{formatDate(item.updatedAt)}</Cell>
          </Row>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={4}>
              <EmptyNote>Kontent topilmadi</EmptyNote>
            </td>
          </tr>
        )}
      </Table>
    </div>
  )
}

export function CmsEditor() {
  const { data, error, isLoading, refresh } = useAdminQuery<Cms>('/api/admin-portal/cms')
  const [draft, setDraft] = useState<Cms | null>(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!draft && isLoading) return <Loading />
  if (!draft) return null

  async function save() {
    if (!draft) return

    setSaving(true)
    setFailure('')
    try {
      await adminFetch('/api/admin-portal/cms', { method: 'PUT', body: JSON.stringify(draft) })
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Saqlanmadi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="CMS promptlari" subtitle="Learner bundledan tashqarida saqlanadigan admin promptlari" />

      <Card className="space-y-4">
        <Prompt
          label="System prompt"
          value={draft.systemPrompt}
          onChange={(value) => setDraft({ ...draft, systemPrompt: value })}
        />
        <Prompt
          label="Outfit prompt"
          value={draft.outfitPrompt}
          onChange={(value) => setDraft({ ...draft, outfitPrompt: value })}
        />
        <Prompt
          label="Enhance prompt"
          value={draft.enhancePrompt}
          onChange={(value) => setDraft({ ...draft, enhancePrompt: value })}
        />

        {failure && <ErrorNote>{failure}</ErrorNote>}

        <Button onClick={save} disabled={saving}>
          {saving ? 'Saqlanmoqda…' : 'Saqlash'}
        </Button>
      </Card>
    </div>
  )
}

function Prompt({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="w-full rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-4 py-3 text-sm text-ink focus:border-signal focus:outline-none"
      />
    </label>
  )
}

export function Comments() {
  const [page, setPage] = useState(1)
  const { data, error, isLoading } = useAdminQuery<Paged<FeedbackItem>>(
    `/api/admin-portal/feedback?source=comment&page=${page}&pageSize=${PAGE_SIZE}`,
  )

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  return (
    <div className="space-y-6">
      <PageHeader title="Izohlar" subtitle="Fikr yuborish oynasidan kelgan qisqa izohlar" />

      <Table head={['Foydalanuvchi', 'Izoh', 'Vaqt']}>
        {data.items.map((item) => (
          <Row key={item.id}>
            <Cell>
              <span className="block font-bold text-ink">{item.displayName || 'Ismsiz'}</span>
              <span className="block text-xs text-ink-faint">{item.email}</span>
            </Cell>
            <Cell>
              <span className="block max-w-xl whitespace-pre-wrap break-words">{item.message}</span>
            </Cell>
            <Cell muted>{formatDate(item.createdAt)}</Cell>
          </Row>
        ))}
        {data.items.length === 0 && (
          <tr>
            <td colSpan={3}>
              <EmptyNote>Izoh yo'q</EmptyNote>
            </td>
          </tr>
        )}
      </Table>

      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  )
}

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
            <Cell strong>{item.title || '—'}</Cell>
            <Cell>
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

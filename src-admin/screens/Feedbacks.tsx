import { useState } from 'react'
import { adminFetch, formatDate, session, useAdminQuery } from '../lib/api'
import type { FeedbackItem, FeedbackStatus, Paged } from '../lib/types'
import { Badge, Button, Cell, EmptyNote, ErrorNote, LoadingRows, PageHeader, Pager, Row, Screen, Select, Table, Textarea } from '../components/ui'

const PAGE_SIZE = 20

/**
 * A request from someone who was not signed in (the landing page's feedback link). It has no
 * account, so a reply written here never reaches them: they are answered at the phone or
 * Telegram they left, which arrives in the email field.
 */
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000'
const isGuest = (item: FeedbackItem) => item.userId === GUEST_USER_ID

/**
 * The learner app sends stable keys (`bug`, `voice`…); older entries carry the Uzbek label the
 * form used to send. Both read the same here.
 */
const KIND_LABELS: Record<string, string> = {
  bug: 'Xatolik',
  voice: 'Mikrofon yoki ovoz',
  payment: 'Toʻlov',
  content: 'Dars mazmuni',
  idea: 'Taklif',
  other: 'Boshqa',
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Yangi',
  in_review: 'Koʻrib chiqilmoqda',
  answered: 'Javob berildi',
}

const STATUS_TONES: Record<FeedbackStatus, 'neutral' | 'caution' | 'milestone'> = {
  new: 'neutral',
  in_review: 'caution',
  answered: 'milestone',
}

const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind

export function Feedbacks() {
  const [page, setPage] = useState(1)
  const [issueType, setIssueType] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [failure, setFailure] = useState('')
  const [replying, setReplying] = useState<FeedbackItem | null>(null)

  const query = `/api/admin-portal/feedback?source=feedback_form&page=${page}&pageSize=${PAGE_SIZE}${
    issueType ? `&issueType=${encodeURIComponent(issueType)}` : ''
  }`
  const { data, error, isLoading, refresh } = useAdminQuery<Paged<FeedbackItem>>(query)

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <LoadingRows />
  if (!data) return null

  const issueTypes = Array.from(new Set([...Object.keys(KIND_LABELS), ...data.items.map((item) => item.issueType).filter(Boolean)]))

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
    <Screen className="space-y-6">
      <PageHeader
        title="Murojaatlar"
        subtitle="Foydalanuvchilar yuborgan murojaatlar. Javobingiz ularga Sozlamalar → Yordam va fikr boʻlimida chiqadi."
      />

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
            ...issueTypes.map((item) => ({ value: item, label: kindLabel(item) })),
          ]}
        />
      </div>

      {failure && <ErrorNote>{failure}</ErrorNote>}

      <Table head={['Foydalanuvchi', 'Turi', 'Murojaat', 'Qayerda', 'Fayl', 'Holat', 'Vaqt']}>
        {data.items.map((item) => (
          <Row key={item.id}>
            <Cell>
              <span className="block font-bold text-ink">{item.displayName || 'Ismsiz'}</span>
              <span className="block text-xs text-ink-faint">{item.email}</span>
              {isGuest(item) && (
                <span className="mt-1 block">
                  <Badge tone="caution">Mehmon · kontakt orqali javob bering</Badge>
                </span>
              )}
            </Cell>
            <Cell muted>{kindLabel(item.issueType) || '—'}</Cell>
            <Cell wrap>
              <span className="block min-w-64 max-w-md break-words">
                <span className="block font-bold text-ink">{item.title || '—'}</span>
                <span className="mt-1 block whitespace-pre-wrap text-ink-muted">{item.message}</span>
                {item.reply && (
                  <span className="mt-2 block rounded-lg bg-signal-soft px-3 py-2 text-sm whitespace-pre-wrap text-ink">
                    <span className="block text-xs font-bold text-signal-ink">Javobimiz · {formatDate(item.repliedAt)}</span>
                    {item.reply}
                  </span>
                )}
              </span>
            </Cell>
            <Cell wrap muted>
              <span className="block min-w-40 max-w-xs break-words">
                {item.context || '—'}
                {item.contextPath && <span className="block font-mono text-xs text-ink-faint">{item.contextPath}</span>}
                {item.userAgent && (
                  <span className="block truncate text-xs text-ink-faint" title={item.userAgent}>
                    {item.userAgent}
                  </span>
                )}
              </span>
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
            <Cell>
              <span className="flex flex-col items-start gap-2">
                <Badge tone={STATUS_TONES[item.status] ?? 'neutral'}>{STATUS_LABELS[item.status] ?? item.status}</Badge>
                <Button variant="secondary" size="sm" onClick={() => setReplying(item)}>
                  {item.reply ? 'Tahrirlash' : 'Javob berish'}
                </Button>
              </span>
            </Cell>
            <Cell muted>{formatDate(item.createdAt)}</Cell>
          </Row>
        ))}
        {data.items.length === 0 && (
          <tr>
            <td colSpan={7}>
              <EmptyNote>Murojaat yo'q</EmptyNote>
            </td>
          </tr>
        )}
      </Table>

      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />

      {replying && (
        <ReplyDialog
          item={replying}
          onClose={() => setReplying(null)}
          onSaved={() => {
            setReplying(null)
            refresh()
          }}
        />
      )}
    </Screen>
  )
}

/** Status and reply for one request. The reply is what the learner reads in their Help tab. */
function ReplyDialog({ item, onClose, onSaved }: { item: FeedbackItem; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<FeedbackStatus>(item.status)
  const [reply, setReply] = useState(item.reply ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function save() {
    setBusy(true)
    setFailure('')
    try {
      const trimmed = reply.trim()
      await adminFetch<FeedbackItem>(`/api/admin-portal/feedback/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          // A first reply moves the request to answered unless a status was picked by hand.
          status: trimmed && !item.reply && status === item.status ? 'answered' : status,
          reply: trimmed,
        }),
      })
      onSaved()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-reply-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onClose()
      }}
    >
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-hairline bg-ground-raised p-5 shadow-2xl">
        <div>
          <h2 id="feedback-reply-title" className="text-lg font-extrabold text-ink">
            {item.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {item.displayName || item.email} · {kindLabel(item.issueType)}
            {item.context ? ` · ${item.context}` : ''}
          </p>
          {isGuest(item) && (
            <p className="mt-2 rounded-lg bg-caution-soft px-3 py-2 text-sm text-caution">
              Bu mehmon murojaati: javob ilovada koʻrinmaydi. Unga {item.email} orqali yozing.
            </p>
          )}
          <p className="mt-3 rounded-lg bg-ground-sunken px-3 py-2 text-sm whitespace-pre-wrap text-ink">{item.message}</p>
        </div>

        <Select
          label="Holat"
          value={status}
          onChange={(value) => setStatus(value as FeedbackStatus)}
          options={(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((value) => ({ value, label: STATUS_LABELS[value] }))}
        />

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Javob</span>
          <Textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={5}
            maxLength={4000}
            autoFocus
            placeholder="Foydalanuvchi buni ilovada oʻqiydi"
          />
        </label>

        {failure && <ErrorNote>{failure}</ErrorNote>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? 'Saqlanmoqda…' : 'Saqlash'}
          </Button>
        </div>
      </div>
    </div>
  )
}

import { useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { api, RequestError } from '../lib/api'
import { Button, Card, ErrorNote, SectionHeading, UzHint } from '../components/ui'

const ISSUE_TYPES = [
  'Xatolik haqida xabar',
  'Taklif',
  'Shikoyat',
  'Toʻlov muammosi',
  'Kontent muammosi',
  'Boshqa',
] as const

export function FeedbacksPage() {
  const t = useT()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [issueType, setIssueType] = useState<(typeof ISSUE_TYPES)[number]>('Xatolik haqida xabar')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function submit() {
    if (title.trim().length < 4) {
      setError(t.feedbackPage.subjectTooShort)
      return
    }

    if (message.trim().length < 8) {
      setError("Izohni biroz batafsilroq yozing.")
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const form = new FormData()
      form.set('issueType', issueType)
      form.set('title', title.trim())
      form.set('message', message.trim())
      if (attachmentFile) {
        form.set('attachment', attachmentFile)
      }

      await api.postForm('/auth/feedback-form', form)

      setTitle('')
      setMessage('')
      setAttachmentFile(null)
      if (fileRef.current) {
        fileRef.current.value = ''
      }
      setSuccess(t.feedbackPage.sent)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.feedbackPage.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.feedbackPage.title}</h1>
        <p className="text-support mt-1">
          Muammo, taklif yoki eʼtirozingizni shu yerda alohida forma orqali yuboring.
        </p>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}
      {success && (
        <div className="rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <Card as="section">
        <SectionHeading>{t.feedbackPage.formTitle}</SectionHeading>
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{t.feedbackPage.kind}</span>
            <select
              value={issueType}
              onChange={(event) => setIssueType(event.target.value as (typeof ISSUE_TYPES)[number])}
              className="h-12 w-full rounded-xl border border-hairline bg-ground-raised px-4 text-base text-ink"
            >
              {ISSUE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{t.feedbackPage.subject}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-12 w-full rounded-xl border border-hairline bg-ground-raised px-4 text-base text-ink"
              placeholder={t.feedbackPage.subjectPlaceholder}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{t.feedbackPage.attach}</span>
            <input
              ref={fileRef}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setAttachmentFile(file)
              }}
              className="block w-full rounded-xl border border-hairline bg-ground-raised px-4 py-3 text-sm text-ink"
            />
            <UzHint>
              Hozircha faylning nomi izoh bilan birga saqlanadi. Kerak bo'lsa keyin to'liq uploadni ham ulaymiz.
            </UzHint>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{t.feedbackPage.details}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
              className="w-full rounded-xl border border-hairline bg-ground-raised px-4 py-3 text-base text-ink"
              placeholder={t.feedbackPage.detailsPlaceholder}
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? 'Yuborilmoqda...' : 'Yuborish'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setTitle('')
                setMessage('')
                setAttachmentFile(null)
                setError(null)
                setSuccess(null)
                if (fileRef.current) {
                  fileRef.current.value = ''
                }
              }}
            >
              Tozalash
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

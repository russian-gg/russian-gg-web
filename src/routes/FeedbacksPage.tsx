import { useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Reveal, Sequence } from '../components/motion'
import { stagger } from '../lib/motion'
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
  const hint = useT().dayPreview
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
    <Sequence gap={stagger.base} className="mx-auto max-w-5xl space-y-8">
      <Reveal as="section">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.feedbackPage.title}</h1>
          <p className="text-support mt-1">{t.feedbackPage.subtitle}</p>
        </header>
      </Reveal>

      {/*
        The two outcomes of the form. Held in an `AnimatePresence` so a message that is
        replaced — an error clearing as a submission succeeds — leaves instead of being
        swapped underneath the reader mid-sentence.
      */}
      <AnimatePresence mode="wait">
        {error && (
          <Reveal key="error" drive>
            <ErrorNote>{error}</ErrorNote>
          </Reveal>
        )}
        {success && (
          <Reveal key="success" drive>
            <div className="rounded-[var(--radius-card)] border border-milestone/30 bg-milestone-soft px-4 py-3 text-sm text-milestone">
              {success}
            </div>
          </Reveal>
        )}
      </AnimatePresence>

      <Reveal as="section">
      <Card as="section">
        <SectionHeading>{t.feedbackPage.formTitle}</SectionHeading>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{t.feedbackPage.kind}</span>
            <select
              value={issueType}
              onChange={(event) => setIssueType(event.target.value as (typeof ISSUE_TYPES)[number])}
              className="h-12 w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 text-base text-ink"
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
              className="h-12 w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 text-base text-ink"
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
              className="block w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 py-3 text-sm text-ink"
            />
            <UzHint>{hint.attachmentNote}</UzHint>
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-ink">{t.feedbackPage.details}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
              className="w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 py-3 text-base text-ink"
              placeholder={t.feedbackPage.detailsPlaceholder}
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-2">
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
      </Reveal>
    </Sequence>
  )
}

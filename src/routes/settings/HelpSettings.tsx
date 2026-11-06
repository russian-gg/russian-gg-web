import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { api, RequestError } from '../../lib/api'
import { cx } from '../../lib/cx'
import { formatDate } from '../../lib/format'
import { fill, useLocale, useT } from '../../lib/i18n'
import { ATTACHMENT_MAX_BYTES, ISSUE_KINDS, type IssueKind } from '../../lib/report-problem'
import { SUPPORT_TELEGRAM_URL } from '../../lib/support'
import type { FeedbackFormResponse, FeedbackStatus, MyFeedbackItem } from '../../lib/types'
import { FileInput } from '../../components/forms/FileInput'
import { KindPicker, MY_FEEDBACK_QUERY_KEY } from '../../components/ReportProblem'
import { Button, Card, ErrorNote, QueryError, Spinner } from '../../components/ui'

/**
 * Help and feedback: the permanent home of a learner's requests.
 *
 * The report sheet is the quick way in, from the screen where something broke. This tab is
 * where a request lives afterwards: the learner can write one without a broken screen in
 * front of them, and come back to see whether it was read and what the answer was. Before it,
 * a request went into a form and nothing ever came back.
 */
export function HelpSettings() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <NewRequestCard />
        <TelegramCard />
      </div>
      <MyRequestsCard />
    </div>
  )
}

function NewRequestCard() {
  const copy = useT().help
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [kind, setKind] = useState<IssueKind>('bug')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit() {
    if (title.trim().length < 4) {
      setError(copy.subjectTooShort)
      return
    }
    if (message.trim().length < 8) {
      setError(copy.detailsTooShort)
      return
    }
    if (file && file.size > ATTACHMENT_MAX_BYTES) {
      setError(copy.fileTooBig)
      return
    }

    setBusy(true)
    setError(null)
    setSent(false)
    try {
      const form = new FormData()
      form.set('issueType', kind)
      form.set('title', title.trim())
      form.set('message', message.trim())
      form.set('contextPath', '/feedback')
      if (file) form.set('attachment', file)

      await api.postForm<FeedbackFormResponse>('/auth/feedback-form', form)
      await queryClient.invalidateQueries({ queryKey: MY_FEEDBACK_QUERY_KEY })

      setTitle('')
      setMessage('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setSent(true)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section">
      <h2 className="text-base font-extrabold tracking-tight text-ink">{copy.newTitle}</h2>
      <p className="text-support mt-0.5">{copy.newBody}</p>

      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <KindPicker value={kind} onChange={setKind} />

        <label className="block">
          <span className="block text-sm font-extrabold text-ink">{copy.subject}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder={copy.subjectPlaceholder}
            className="mt-2 h-12 w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 text-base text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-extrabold text-ink">{copy.details}</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            maxLength={4000}
            placeholder={copy.detailsPlaceholder}
            className="mt-2 block w-full resize-y rounded-xl border-2 border-hairline bg-ground-raised px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
          />
        </label>

        <div>
          <span className="mb-2 block text-sm font-extrabold text-ink">{copy.attach}</span>
          <FileInput
            inputRef={fileRef}
            file={file}
            onChange={setFile}
            chooseLabel={copy.screenshot}
            emptyLabel={copy.attachLimit}
            clearLabel={copy.attachRemove}
          />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        {sent && (
          <p role="status" className="rounded-xl bg-milestone-soft px-4 py-3 text-sm font-bold text-milestone">
            {copy.sentInline}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? copy.sending : copy.send}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function TelegramCard() {
  const copy = useT().help
  return (
    <Card as="section" className="flex flex-wrap items-center gap-4">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
        <Send className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{copy.quickTitle}</h2>
        <p className="text-support">{copy.quickBody}</p>
      </div>
      <a
        href={SUPPORT_TELEGRAM_URL}
        target="_blank"
        rel="noreferrer"
        className="raised inline-flex h-11 shrink-0 items-center rounded-full border-2 border-hairline bg-ground-raised px-4 text-sm font-extrabold text-ink"
      >
        {copy.quickOpen}
      </a>
    </Card>
  )
}

const STATUS_TONE: Record<FeedbackStatus, string> = {
  new: 'bg-ground-sunken text-ink-muted',
  in_review: 'bg-caution-soft text-caution',
  answered: 'bg-milestone-soft text-milestone',
}

function MyRequestsCard() {
  const t = useT()
  const copy = t.help
  const { locale } = useLocale()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: MY_FEEDBACK_QUERY_KEY,
    queryFn: () => api.get<MyFeedbackItem[]>('/auth/feedback-form/mine'),
  })

  return (
    <Card as="section">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{copy.mineTitle}</h2>
        {data && data.length > 0 && (
          <span className="text-sm text-ink-muted">{fill(copy.mineCount, { count: data.length })}</span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {isLoading && <Spinner />}
        {isError && <QueryError onRetry={() => void refetch()} />}
        {data?.length === 0 && <p className="text-support">{copy.mineEmpty}</p>}
        {data?.map((item) => {
          const status = item.status in STATUS_TONE ? item.status : 'new'
          const kindLabel = (ISSUE_KINDS as readonly string[]).includes(item.issueType)
            ? copy.kinds[item.issueType as IssueKind]
            : item.issueType
          return (
            <article
              key={item.id}
              className={cx(
                'rounded-xl border p-4',
                item.reply ? 'border-signal/50 bg-signal-soft/40' : 'border-hairline',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-extrabold text-ink">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {[`#${item.reference}`, item.context ?? kindLabel, formatDate(item.createdAt, locale)].join(' · ')}
                  </p>
                </div>
                <span className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold', STATUS_TONE[status])}>
                  {copy.status[status]}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-ink-muted">{item.message}</p>
              {item.reply && (
                <div className="mt-3 rounded-lg border border-hairline bg-ground-raised px-3.5 py-3">
                  <p className="text-xs font-black tracking-[.1em] text-signal-ink uppercase">{copy.teamReply}</p>
                  <p className="mt-1 text-sm whitespace-pre-line text-ink">{item.reply}</p>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </Card>
  )
}

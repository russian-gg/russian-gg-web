import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckIcon, Flag, MapPin, X } from 'lucide-react'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { cx } from '../lib/cx'
import { useFocusTrap } from '../lib/focus-trap'
import { useT } from '../lib/i18n'
import {
  ATTACHMENT_MAX_BYTES,
  ISSUE_KINDS,
  ReportProblemContext,
  useReportProblem,
  type IssueKind,
  type ReportContext,
} from '../lib/report-problem'
import type { FeedbackFormResponse } from '../lib/types'
import { FileInput } from './forms/FileInput'
import { Overlay } from './motion'
import { Button, ErrorNote } from './ui'

/** The query the Settings help tab lists the learner's requests under; a new one refreshes it. */
export const MY_FEEDBACK_QUERY_KEY = ['my-feedback'] as const

/**
 * Lets any screen open the report sheet over itself.
 *
 * A learner who meets a problem is in the middle of something — a lesson step, a call, a
 * payment. Sending them to a form on another page meant leaving that place, then describing
 * from memory which lesson broke. The sheet opens where they are, says where that is on their
 * behalf, and closes back onto the same screen.
 */
export function ReportProblemProvider({ children }: { children: ReactNode }) {
  const [openWith, setOpenWith] = useState<ReportContext | null>(null)
  const [pageContext, setPageContext] = useState<ReportContext | null>(null)
  const { pathname } = useLocation()

  const open = useCallback(
    (context?: ReportContext) => setOpenWith(context ?? pageContext ?? { label: pathname }),
    [pageContext, pathname],
  )

  const value = useMemo(
    () => ({ open, isOpen: openWith !== null, setPageContext }),
    [open, openWith],
  )

  return (
    <ReportProblemContext.Provider value={value}>
      {children}
      <ReportProblemDialog context={openWith} onClose={() => setOpenWith(null)} />
    </ReportProblemContext.Provider>
  )
}

function ReportProblemDialog({ context, onClose }: { context: ReportContext | null; onClose: () => void }) {
  const open = context !== null
  /*
    Held after close so the sheet's exit animation still has its text: `context` goes null in
    the same commit that starts the exit.
  */
  const [shown, setShown] = useState<ReportContext | null>(context)
  if (context && context !== shown) setShown(context)

  return (
    <Overlay
      open={open}
      portal
      align="bottom"
      // Above the lesson check-in (z-200), which can open this from its last step.
      className="fixed inset-0 z-[300] flex items-end justify-center p-3 sm:items-center sm:p-6"
      backdropClassName="bg-black/45"
    >
      {shown && <ReportSheet key={shown.label + (shown.detail ?? '')} context={shown} onClose={onClose} />}
    </Overlay>
  )
}

function ReportSheet({ context, onClose }: { context: ReportContext; onClose: () => void }) {
  const t = useT()
  const copy = t.help
  const titleId = useId()
  const dialogRef = useFocusTrap<HTMLFormElement>()
  const queryClient = useQueryClient()
  const { pathname, search } = useLocation()
  /*
    A visitor who is not signed in can write too — from the landing page, or stuck at sign-in.
    With no account there is no "my requests" list to answer into, so they leave a phone or
    Telegram for the reply, and the server takes no file from them.
  */
  const guest = !useAuth().user
  const [kind, setKind] = useState<IssueKind>(context.kind ?? 'bug')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  // The route at the moment the sheet opened, not wherever the learner is when they press send.
  const openedOn = useRef(pathname + search)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  async function submit() {
    if (message.trim().length < 8) {
      setError(copy.detailsTooShort)
      return
    }
    if (guest && contact.trim().length < 5) {
      setError(copy.guestContactMissing)
      return
    }
    if (!guest && file && file.size > ATTACHMENT_MAX_BYTES) {
      setError(copy.fileTooBig)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('issueType', kind)
      form.set('message', message.trim())
      form.set('context', [context.label, context.detail].filter(Boolean).join(' · '))
      form.set('contextPath', openedOn.current)

      let result: FeedbackFormResponse | undefined
      if (guest) {
        form.set('name', name.trim())
        form.set('contact', contact.trim())
        result = await api.postForm<FeedbackFormResponse>('/auth/feedback-form/guest', form)
      } else {
        if (file) form.set('attachment', file)
        result = await api.postForm<FeedbackFormResponse>('/auth/feedback-form', form)
        void queryClient.invalidateQueries({ queryKey: MY_FEEDBACK_QUERY_KEY })
      }
      setReference(result?.reference ?? '')
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-ground-raised shadow-2xl"
    >
      {reference !== null ? (
        <div className="flex flex-col items-center gap-3 px-5 pt-8 pb-6 text-center sm:px-6">
          <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-milestone-soft text-milestone">
            <CheckIcon className="size-8" strokeWidth={3} />
          </span>
          <h2 id={titleId} className="text-xl font-extrabold tracking-tight text-ink">
            {copy.sentTitle}
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-ink-muted">{guest ? copy.guestSentBody : copy.sentBody}</p>
          {reference && (
            <p className="flex w-full justify-between gap-3 rounded-xl bg-ground-sunken px-3 py-2.5 text-sm">
              <span className="text-ink-muted">{copy.reference}</span>
              <span className="font-extrabold text-ink tabular-nums">#{reference}</span>
            </p>
          )}
          <Button type="button" block onClick={onClose} className="mt-1">
            {copy.continue}
          </Button>
          {!guest && (
            <Link to="/feedback" onClick={onClose} className="text-sm font-extrabold text-signal-ink hover:underline">
              {copy.seeMine}
            </Link>
          )}
        </div>
      ) : (
        <>
          <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-extrabold tracking-tight text-ink">
                {guest ? copy.guestTitle : copy.sheetTitle}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{guest ? copy.guestBody : copy.sheetBody}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={t.common.close}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ground-sunken text-ink-muted transition-colors hover:text-ink"
            >
              <X aria-hidden="true" className="size-4.5" strokeWidth={2.4} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {!guest && (
              <div className="flex items-center gap-2.5 rounded-xl bg-ground-sunken px-3 py-2.5">
                <MapPin aria-hidden="true" className="size-4.5 shrink-0 text-ink-faint" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-ink">{context.label}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {context.detail ? `${context.detail} · ${copy.contextAuto}` : copy.contextAuto}
                  </p>
                </div>
              </div>
            )}

            <KindPicker value={kind} onChange={setKind} />

            <label className="block">
              <span className="block text-sm font-extrabold text-ink">{copy.whatHappened}</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                maxLength={4000}
                placeholder={copy.whatHappenedPlaceholder}
                className="mt-2 block w-full resize-none rounded-xl border-2 border-hairline bg-ground-raised px-3.5 py-3 text-base text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
              />
            </label>

            {guest ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-sm font-extrabold text-ink">{copy.guestName}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    className="mt-2 h-12 w-full rounded-xl border-2 border-hairline bg-ground-raised px-3.5 text-base text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-extrabold text-ink">{copy.guestContact}</span>
                  <input
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    maxLength={120}
                    required
                    autoComplete="tel"
                    placeholder={copy.guestContactPlaceholder}
                    className="mt-2 h-12 w-full rounded-xl border-2 border-hairline bg-ground-raised px-3.5 text-base text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
                  />
                </label>
              </div>
            ) : (
              <FileInput
                file={file}
                onChange={setFile}
                accept="image/*,.pdf"
                chooseLabel={copy.screenshot}
                emptyLabel={copy.attachLimit}
                clearLabel={copy.attachRemove}
              />
            )}

            {error && <ErrorNote>{error}</ErrorNote>}
          </div>

          <footer className="flex flex-col gap-3 border-t border-hairline px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <p className="text-xs text-ink-muted sm:flex-1">{guest ? copy.guestPrivacy : copy.placeKept}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? copy.sending : copy.send}
              </Button>
            </div>
          </footer>
        </>
      )}
    </form>
  )
}

/** The topic, as a row of chips: one tap, every choice visible, no dropdown to open first. */
export function KindPicker({ value, onChange }: { value: IssueKind; onChange: (kind: IssueKind) => void }) {
  const copy = useT().help
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-extrabold text-ink">{copy.kindLegend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {ISSUE_KINDS.map((kind) => (
          <label
            key={kind}
            className={cx(
              'inline-flex h-9 cursor-pointer items-center rounded-full border-2 px-3.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-signal',
              value === kind
                ? 'border-signal bg-signal-soft font-extrabold text-signal-ink'
                : 'border-hairline font-bold text-ink hover:border-signal',
            )}
          >
            <input
              type="radio"
              name={name}
              value={kind}
              checked={value === kind}
              onChange={() => onChange(kind)}
              className="sr-only"
            />
            {copy.kinds[kind]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * The flag in an activity's header. Icon only on a phone, where the header has no room for a
 * word; labelled from `sm` up, where an unlabelled flag reads as decoration.
 */
export function ReportProblemButton({ context, className }: { context: ReportContext; className?: string }) {
  const copy = useT().help
  const { open } = useReportProblem()
  return (
    <button
      type="button"
      onClick={() => open(context)}
      aria-label={copy.reportAria}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-ink-muted transition-colors hover:bg-ground-sunken hover:text-ink',
        className,
      )}
    >
      <Flag aria-hidden="true" className="size-4" strokeWidth={2} />
      <span className="hidden sm:inline">{copy.report}</span>
    </button>
  )
}

/** The way out under an error that "try again" did not fix. */
export function ReportProblemLink({ context, className }: { context: ReportContext; className?: string }) {
  const copy = useT().help
  const { open } = useReportProblem()
  return (
    <p className={cx('text-center text-sm text-ink-muted', className)}>
      {copy.reportPrompt}{' '}
      <button
        type="button"
        onClick={() => open(context)}
        className="font-extrabold text-signal-ink underline-offset-2 hover:underline"
      >
        {copy.reportLink}
      </button>
    </p>
  )
}

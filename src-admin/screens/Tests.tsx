import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useFocusTrap } from '../../src/lib/focus-trap'
import { duration, ease } from '../../src/lib/motion'
import { cx } from '../../src/lib/cx'
import { Overlay } from '../../src/components/motion'
import { adminFetch, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import {
  DEFAULT_OPTIONS,
  MAX_EXPLANATION_LENGTH,
  MAX_OPTION_LENGTH,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  MAX_TEXT_LENGTH,
  clearDraft,
  emptyQuestion,
  hasDraft,
  loadDraft,
  questionProblems,
  saveDraft,
  toRequest,
} from '../lib/question-draft'
import type { QuestionDraft } from '../lib/question-draft'
import type {
  AdminDeleteResult,
  AdminTest,
  AdminTestDetail,
  AdminTestQuestion,
  TestCategory,
  TestDifficulty,
} from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Cell,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  FieldLabel,
  IconButton,
  Input,
  LoadingRows,
  LoadingStats,
  PageHeader,
  Row,
  Screen,
  Segmented,
  Select,
  Stat,
  Switch,
  Table,
  Textarea,
  TextField,
} from '../components/ui'

const CATEGORY: Record<TestCategory, string> = {
  Grammar: 'Grammatika',
  Phonetics: 'Fonetika',
  Vocabulary: "Lug'at",
}

const DIFFICULTY: Record<TestDifficulty, { label: string; tone: 'milestone' | 'signal' | 'caution' }> = {
  Easy: { label: 'Oson', tone: 'milestone' },
  Medium: { label: "O'rta", tone: 'signal' },
  Hard: { label: 'Qiyin', tone: 'caution' },
}

const CATEGORIES = Object.keys(CATEGORY) as TestCategory[]
const DIFFICULTIES = Object.keys(DIFFICULTY) as TestDifficulty[]

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback)

/**
 * The admin panel's "Testlar" section. A test is a title and a level, not tied to any lesson
 * day; it is filled with questions — each with its own section — and then switched on.
 * Learners' blocks draw only from active tests, so a test can be written in full before
 * anybody sees it.
 */
export function Tests() {
  const [openId, setOpenId] = useState<string | null>(null)

  return openId ? (
    <TestDetail id={openId} onBack={() => setOpenId(null)} />
  ) : (
    <TestList onOpen={setOpenId} />
  )
}

/* -------------------------------------------------------------------------------- list */

function TestList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminTest[]>('/api/admin-portal/tests')
  const [difficulty, setDifficulty] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<AdminTest | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  // Server answers to a toggle, laid over the list until the next fetch lands (see PromoCodes).
  const [patched, setPatched] = useState<Record<string, Partial<AdminTest>>>({})
  useEffect(() => setPatched({}), [data])

  const items = useMemo(() => (data ?? []).map((item) => ({ ...item, ...patched[item.id] })), [data, patched])

  const totals = useMemo(
    () => ({
      tests: items.length,
      active: items.filter((item) => item.isActive).length,
      questions: items.filter((item) => item.isActive).reduce((sum, item) => sum + item.activeQuestionCount, 0),
      empty: items.filter((item) => item.activeQuestionCount === 0).length,
    }),
    [items],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter(
      (item) =>
        (!difficulty || item.difficulty === difficulty) &&
        (!needle || item.title.toLowerCase().includes(needle)),
    )
  }, [items, difficulty, query])

  async function toggle(item: AdminTest) {
    setActionError('')
    setToggling((state) => ({ ...state, [item.id]: true }))
    try {
      const next = await adminFetch<AdminTestDetail>(`/api/admin-portal/tests/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      setPatched((state) => ({ ...state, [item.id]: { isActive: next.isActive } }))
    } catch (caught) {
      setActionError(errorText(caught, "Holatni o'zgartirib bo'lmadi."))
    } finally {
      setToggling((state) => ({ ...state, [item.id]: false }))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    setActionError('')
    setNotice('')
    try {
      const result = await adminFetch<AdminDeleteResult>(`/api/admin-portal/tests/${deleting.id}`, { method: 'DELETE' })
      if (result.deactivated) {
        setNotice("Test savollari o'quvchilarga berilgan, shuning uchun test o'chirilmadi — faqat nofaol qilindi.")
      }
      setDeleting(null)
      refresh()
    } catch (caught) {
      setActionError(errorText(caught, "Testni o'chirib bo'lmadi."))
      setDeleting(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <Screen className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageHeader title="Testlar" subtitle="Testlarni yarating, savollar bilan to'ldiring va faollashtiring" />
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
            Yangi test
          </Button>
        </div>

        {!data && isLoading ? (
          <LoadingStats count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Testlar" value={formatNumber(totals.tests)} note="Hammasi" />
            <Stat label="Faol" value={formatNumber(totals.active)} note="O'quvchilarga ko'rinadi" />
            <Stat label="Nofaol" value={formatNumber(totals.tests - totals.active)} note={`${totals.empty} tasida savol yo'q`} />
            <Stat label="Faol savollar" value={formatNumber(totals.questions)} note="Faol testlarda" />
          </div>
        )}

        <Card as="div" className="space-y-4 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Select
                label="Daraja"
                value={difficulty}
                onChange={setDifficulty}
                options={[{ value: '', label: 'Barcha darajalar' }, ...DIFFICULTIES.map((id) => ({ value: id, label: DIFFICULTY[id].label }))]}
              />
              <div className="relative w-full sm:w-56">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" />
                <TextField value={query} onChange={setQuery} placeholder="Test nomi bo'yicha" className="w-full pl-10" />
              </div>
            </div>
          </div>

          {notice && <Notice>{notice}</Notice>}
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
          {!data && isLoading && <LoadingRows />}

          {data && (
            <Table head={['Test', 'Daraja', 'Savollar', 'Faol', '']}>
              {visible.map((item) => (
                <Row key={item.id}>
                  <Cell>
                    <button
                      type="button"
                      onClick={() => onOpen(item.id)}
                      className="text-left font-bold text-ink hover:text-signal-ink"
                    >
                      {item.title}
                    </button>
                    <div className="mt-0.5 text-xs text-ink-faint">{formatDateTime(item.updatedAt)}</div>
                  </Cell>
                  <Cell>
                    <Badge tone={DIFFICULTY[item.difficulty].tone}>{DIFFICULTY[item.difficulty].label}</Badge>
                  </Cell>
                  <Cell>
                    <span className={cx('tabular-nums', item.activeQuestionCount === 0 ? 'text-caution' : 'text-ink')}>
                      {item.activeQuestionCount}
                      {item.questionCount !== item.activeQuestionCount && (
                        <span className="text-ink-faint"> / {item.questionCount}</span>
                      )}
                    </span>
                  </Cell>
                  <Cell>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.isActive}
                      aria-label={`${item.title} — ${item.isActive ? "o'chirish" : 'yoqish'}`}
                      title={item.activeQuestionCount === 0 && !item.isActive ? "Avval savol qo'shing" : undefined}
                      disabled={toggling[item.id] || (!item.isActive && item.activeQuestionCount === 0)}
                      onClick={() => void toggle(item)}
                      className="disabled:opacity-40"
                    >
                      <Switch checked={item.isActive} />
                    </button>
                  </Cell>
                  <Cell>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton label="O'chirish" tone="danger" onClick={() => setDeleting(item)}>
                        <Trash2 aria-hidden="true" className="size-4" />
                      </IconButton>
                      <IconButton label="Ochish" onClick={() => onOpen(item.id)}>
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </IconButton>
                    </div>
                  </Cell>
                </Row>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyNote>{items.length === 0 ? "Hali test yaratilmagan" : "Bu filtr bo'yicha test topilmadi"}</EmptyNote>
                  </td>
                </tr>
              )}
            </Table>
          )}
        </Card>
      </Screen>

      {creating && (
        <TestFormDialog
          test={null}
          onClose={() => setCreating(false)}
          // Straight into the new test: adding its questions is the next thing to do.
          onSaved={(created) => onOpen(created.id)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Testni o'chirish"
          body={
            <>
              <strong className="font-extrabold text-ink">{deleting.title}</strong> va uning {deleting.questionCount} ta
              savoli o'chiriladi. Savollar o'quvchilarga allaqachon berilgan bo'lsa, ularning natijalari saqlanishi uchun
              test o'chirilmaydi — faqat nofaol qilinadi.
            </>
          }
          confirmLabel="O'chirish"
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------------------ detail */

function TestDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: loaded, error, isLoading, refresh } = useAdminQuery<AdminTestDetail>(`/api/admin-portal/tests/${id}`)
  // Every change answers with the whole test, so the screen takes that rather than refetching.
  const [test, setTest] = useState<AdminTestDetail | null>(null)
  useEffect(() => setTest(loaded), [loaded])

  const [editing, setEditing] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<AdminTestQuestion | null>(null)
  // An unsaved draft from before a refresh reopens the form, so the typing is right where it was.
  const [adding, setAdding] = useState(() => hasDraft(id))
  const [deletingTest, setDeletingTest] = useState(false)
  const [deletingQuestion, setDeletingQuestion] = useState<AdminTestQuestion | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  async function run<T>(action: () => Promise<T>, fallback: string) {
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      return await action()
    } catch (caught) {
      setActionError(errorText(caught, fallback))
      return undefined
    } finally {
      setBusy(false)
    }
  }

  if (!test) {
    return (
      <Screen className="space-y-6">
        <BackLink onBack={onBack} />
        {error ? <ErrorNote onRetry={refresh}>{error}</ErrorNote> : isLoading && <LoadingRows />}
      </Screen>
    )
  }

  const activeQuestions = test.questions.filter((q) => q.isActive).length

  async function setStatus(isActive: boolean) {
    const next = await run(
      () =>
        adminFetch<AdminTestDetail>(`/api/admin-portal/tests/${test!.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive }),
        }),
      "Holatni o'zgartirib bo'lmadi.",
    )
    if (next) setTest(next)
  }

  async function setQuestionStatus(item: AdminTestQuestion) {
    const next = await run(
      () =>
        adminFetch<AdminTestDetail>(`/api/admin-portal/tests/questions/${item.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !item.isActive }),
        }),
      "Holatni o'zgartirib bo'lmadi.",
    )
    if (next) {
      if (test!.isActive && !next.isActive) setNotice("Oxirgi faol savol o'chirildi, shuning uchun test ham nofaol qilindi.")
      setTest(next)
    }
  }

  async function deleteQuestion() {
    if (!deletingQuestion) return
    const target = deletingQuestion
    const result = await run(
      () => adminFetch<AdminDeleteResult>(`/api/admin-portal/tests/questions/${target.id}`, { method: 'DELETE' }),
      "Savolni o'chirib bo'lmadi.",
    )
    setDeletingQuestion(null)
    if (result?.deactivated) setNotice("Savol o'quvchilarga berilgan, shuning uchun o'chirilmadi — faqat nofaol qilindi.")
    if (result) refresh()
  }

  async function deleteTest() {
    const result = await run(
      () => adminFetch<AdminDeleteResult>(`/api/admin-portal/tests/${test!.id}`, { method: 'DELETE' }),
      "Testni o'chirib bo'lmadi.",
    )
    setDeletingTest(false)
    if (result?.deleted) onBack()
    else if (result?.deactivated) {
      setNotice("Test savollari o'quvchilarga berilgan, shuning uchun test o'chirilmadi — faqat nofaol qilindi.")
      refresh()
    }
  }

  return (
    <>
      <Screen className="space-y-6">
        <BackLink onBack={onBack} />

        <Card as="div" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">{test.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={DIFFICULTY[test.difficulty].tone}>{DIFFICULTY[test.difficulty].label}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" className="size-4" />
                Tahrirlash
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeletingTest(true)}>
                <Trash2 aria-hidden="true" className="size-4" />
                O'chirish
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-ground-sunken px-4 py-3">
            <button
              type="button"
              role="switch"
              aria-checked={test.isActive}
              aria-label={test.isActive ? "Testni o'chirish" : 'Testni faollashtirish'}
              disabled={busy || (!test.isActive && activeQuestions === 0)}
              onClick={() => void setStatus(!test.isActive)}
              className="disabled:opacity-40"
            >
              <Switch checked={test.isActive} />
            </button>
            <div className="text-sm">
              <div className="font-bold text-ink">{test.isActive ? 'Faol' : 'Nofaol'}</div>
              <div className="text-ink-muted">
                {test.isActive
                  ? "Savollar o'quvchilarning test bloklariga tushadi."
                  : activeQuestions === 0
                    ? "Faollashtirish uchun kamida bitta faol savol qo'shing."
                    : "O'quvchilar bu testni ko'rmaydi. Tayyor bo'lsa, faollashtiring."}
              </div>
            </div>
          </div>
        </Card>

        {notice && <Notice>{notice}</Notice>}
        {actionError && <ErrorNote>{actionError}</ErrorNote>}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-ink">Savollar</h2>
            <p className="text-sm text-ink-muted">
              {test.questions.length} ta savol · {activeQuestions} ta faol
            </p>
          </div>
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
            {hasDraft(test.id) ? 'Qoralamani davom ettirish' : "Savol qo'shish"}
          </Button>
        </div>

        {test.questions.length === 0 ? (
          <Card as="div">
            <EmptyNote>Bu testda hali savol yo'q. Bittalab yoki ommaviy qo'shing.</EmptyNote>
          </Card>
        ) : (
          <div className="space-y-3">
            {test.questions.map((item, index) => (
              <QuestionCard
                key={item.id}
                item={item}
                number={index + 1}
                busy={busy}
                onToggle={() => void setQuestionStatus(item)}
                onEdit={() => setEditingQuestion(item)}
                onDelete={() => setDeletingQuestion(item)}
              />
            ))}
          </div>
        )}
      </Screen>

      {editing && (
        <TestFormDialog
          test={test}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setEditing(false)
            setTest(next)
          }}
        />
      )}

      {editingQuestion && (
        <EditQuestionDialog
          item={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSaved={(next) => {
            setEditingQuestion(null)
            setTest(next)
          }}
        />
      )}

      {adding && (
        <AddQuestionsDialog
          testId={test.id}
          onClose={() => setAdding(false)}
          onSaved={(next, added) => {
            setAdding(false)
            setTest(next)
            setNotice(`${added} ta savol qo'shildi.`)
          }}
        />
      )}

      {deletingTest && (
        <ConfirmDialog
          title="Testni o'chirish"
          body={
            <>
              <strong className="font-extrabold text-ink">{test.title}</strong> va uning {test.questions.length} ta savoli
              o'chiriladi.
            </>
          }
          confirmLabel="O'chirish"
          busy={busy}
          onConfirm={() => void deleteTest()}
          onCancel={() => setDeletingTest(false)}
        />
      )}

      {deletingQuestion && (
        <ConfirmDialog
          title="Savolni o'chirish"
          body={
            <>
              <strong className="font-extrabold text-ink">{deletingQuestion.text}</strong> o'chiriladi.
            </>
          }
          confirmLabel="O'chirish"
          busy={busy}
          onConfirm={() => void deleteQuestion()}
          onCancel={() => setDeletingQuestion(null)}
        />
      )}
    </>
  )
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 text-sm font-bold text-ink-muted transition-colors hover:text-ink"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Testlar
    </button>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="animate-in rounded-control bg-signal-soft px-4 py-3 text-sm text-ink fade-in-0">
      {children}
    </p>
  )
}

function QuestionCard({
  item,
  number,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: AdminTestQuestion
  number: number
  busy: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card as="div" className={cx('space-y-3 p-4 sm:p-5', !item.isActive && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ground-sunken text-sm font-black text-ink-muted">
          {number}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Badge tone="signal">{CATEGORY[item.category]}</Badge>
          <p className="font-bold whitespace-pre-line text-ink" lang="ru">
            {item.text}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={item.isActive}
            aria-label={`${number}-savol — ${item.isActive ? "o'chirish" : 'yoqish'}`}
            disabled={busy}
            onClick={onToggle}
            className="mr-1 disabled:opacity-50"
          >
            <Switch checked={item.isActive} />
          </button>
          <IconButton label={`${number}-savolni tahrirlash`} onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label={`${number}-savolni o'chirish`} tone="danger" onClick={onDelete}>
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5 pl-11">
        {item.options.map((option, index) => (
          <li
            key={index}
            lang="ru"
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm',
              index === item.correctOptionIndex ? 'bg-milestone-soft font-bold text-milestone' : 'bg-ground-sunken text-ink-muted',
            )}
          >
            {index === item.correctOptionIndex && <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />}
            {option}
          </li>
        ))}
      </ul>
      <p className="pl-11 text-sm whitespace-pre-line text-ink-muted">
        <span className="font-bold text-ink">Izoh: </span>
        {item.explanation}
      </p>
    </Card>
  )
}

/* ------------------------------------------------------------------------------ dialogs */

/** The frame every dialog here shares: focus trapped, Escape closes unless busy, backdrop dismisses. */
function Dialog({
  title,
  subtitle,
  busy,
  onClose,
  wide = false,
  children,
}: {
  title: string
  subtitle?: string
  busy: boolean
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  return (
    <Overlay open onDismiss={busy ? undefined : onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('flex max-h-full w-full', wide ? 'max-w-3xl' : 'max-w-2xl')}
      >
        {/* The header stays put and only the body scrolls, so a long form never pushes the title off screen. */}
        <Card
          as="div"
          className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 shrink-0">
            <h2 className="text-lg font-extrabold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          </div>
          {/* The padding keeps focus rings from being clipped by the scroll edge. */}
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">{children}</div>
        </Card>
      </div>
    </Overlay>
  )
}

function DialogActions({ busy, canSubmit, label, onClose }: { busy: boolean; canSubmit: boolean; label: string; onClose: () => void }) {
  return (
    // Pinned to the bottom of the scrolling body, so saving never needs a scroll down.
    <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t-2 border-hairline bg-ground-raised pt-3 pb-1">
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        Bekor qilish
      </Button>
      <Button type="submit" disabled={busy || !canSubmit}>
        {busy ? 'Saqlanmoqda…' : label}
      </Button>
    </div>
  )
}

/** Create and edit share one form: a title and a level. A created test starts inactive. */
function TestFormDialog({
  test,
  onClose,
  onSaved,
}: {
  test: AdminTestDetail | null
  onClose: () => void
  onSaved: (test: AdminTestDetail) => void
}) {
  const [title, setTitle] = useState(test?.title ?? '')
  const [difficulty, setDifficulty] = useState<TestDifficulty>(test?.difficulty ?? 'Easy')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')
    try {
      const saved = await adminFetch<AdminTestDetail>(test ? `/api/admin-portal/tests/${test.id}` : '/api/admin-portal/tests', {
        method: test ? 'PUT' : 'POST',
        body: JSON.stringify({ title: title.trim(), difficulty }),
      })
      onSaved(saved)
    } catch (caught) {
      setFailure(errorText(caught, "Testni saqlab bo'lmadi."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={test ? 'Testni tahrirlash' : 'Yangi test'}
      subtitle={
        test
          ? "Daraja testning barcha savollariga tegishli. Bo'lim har bir savolda alohida tanlanadi."
          : "Test nomi va darajasini kiriting. Keyin savollarni qo'shasiz — bo'lim har bir savolda tanlanadi. Test savollar tayyor bo'lguncha nofaol turadi."
      }
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <FieldLabel label="Test nomi">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Masalan: Otlarning rodi"
            maxLength={200}
            required
            autoFocus
          />
        </FieldLabel>

        <div>
          <span className="mb-1.5 block text-sm font-bold text-ink">Daraja</span>
          <Segmented<TestDifficulty>
            value={difficulty}
            onChange={setDifficulty}
            options={DIFFICULTIES.map((id) => ({ id, label: DIFFICULTY[id].label }))}
          />
        </div>

        {failure && <ErrorNote>{failure}</ErrorNote>}
        <DialogActions busy={busy} canSubmit={title.trim() !== ''} label={test ? 'Saqlash' : 'Yaratish'} onClose={onClose} />
      </form>
    </Dialog>
  )
}

/**
 * The inputs for one question — its section, text, 3 to 8 options with the right one marked,
 * and the rule —
 * shared by the edit dialog and every card of the add dialog.
 */
function QuestionFields({
  value,
  onChange,
  idPrefix,
  autoFocus = false,
}: {
  value: QuestionDraft
  onChange: (next: QuestionDraft) => void
  idPrefix: string
  autoFocus?: boolean
}) {
  const { options, correctOptionIndex: correct } = value

  /**
   * Only options added beyond the default four can be removed. The right-answer mark follows
   * its option when one above it is removed.
   */
  function removeOption(index: number) {
    if (index < DEFAULT_OPTIONS) return
    onChange({
      ...value,
      options: options.filter((_, i) => i !== index),
      correctOptionIndex: index === correct ? 0 : index < correct ? correct - 1 : correct,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-sm font-bold text-ink">Bo'lim</span>
        <Segmented<TestCategory>
          value={value.category}
          onChange={(category) => onChange({ ...value, category })}
          options={CATEGORIES.map((id) => ({ id, label: CATEGORY[id] }))}
        />
      </div>

      <FieldLabel label="Savol">
        <Textarea
          value={value.text}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          placeholder="Masalan: Выберите правильное окончание: Я живу в Ташкент__."
          maxLength={MAX_TEXT_LENGTH}
          autoFocus={autoFocus}
        />
      </FieldLabel>

      <fieldset>
        <legend className="mb-0.5 text-sm font-bold text-ink">
          Javob variantlari <span className="font-normal text-ink-muted">— to'g'ri javobni belgilang</span>
        </legend>
        <AnimatePresence initial={false}>
          {options.map((option, index) => {
            const isCorrect = index === correct
            return (
              <m.div
                key={index}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: { duration: duration.base, ease: ease.enter } }}
                exit={{ opacity: 0, height: 0, transition: { duration: duration.quick, ease: ease.exit } }}
                className="overflow-hidden"
              >
                {/* The padding gives the focus ring room inside the clipped, animating row. */}
                <div className="flex items-center gap-2 p-1">
                  <label
                    className={cx(
                      'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control border-2 transition-colors',
                      isCorrect ? 'border-milestone bg-milestone-soft text-milestone' : 'border-hairline text-ink-faint hover:border-ink-faint',
                    )}
                    title="To'g'ri javob"
                  >
                    <input
                      type="radio"
                      name={`${idPrefix}-correct-option`}
                      checked={isCorrect}
                      onChange={() => onChange({ ...value, correctOptionIndex: index })}
                      aria-label={`${index + 1}-variant to'g'ri javob`}
                      className="sr-only"
                    />
                    {isCorrect ? (
                      <Check aria-hidden="true" className="size-4 animate-in zoom-in-50 fade-in-0" strokeWidth={3} />
                    ) : (
                      index + 1
                    )}
                  </label>
                  <Input
                    value={option}
                    onChange={(event) =>
                      onChange({ ...value, options: options.map((current, i) => (i === index ? event.target.value : current)) })
                    }
                    placeholder={`${index + 1}-variant`}
                    aria-label={`${index + 1}-variant`}
                    maxLength={MAX_OPTION_LENGTH}
                  />
                  {index >= DEFAULT_OPTIONS && (
                    <IconButton label={`${index + 1}-variantni olib tashlash`} tone="danger" onClick={() => removeOption(index)}>
                      <X aria-hidden="true" className="size-4" />
                    </IconButton>
                  )}
                </div>
              </m.div>
            )
          })}
        </AnimatePresence>
        <Button
          variant="secondary"
          size="sm"
          className="mt-1.5"
          onClick={() => onChange({ ...value, options: options.length >= MAX_OPTIONS ? options : [...options, ''] })}
          disabled={options.length >= MAX_OPTIONS}
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
          Variant qo'shish
        </Button>
      </fieldset>

      <FieldLabel label="Qoida / izoh">
        <Textarea
          value={value.explanation}
          onChange={(event) => onChange({ ...value, explanation: event.target.value })}
          placeholder="Javobdan keyin va natijalar sahifasida ko'rsatiladi."
          maxLength={MAX_EXPLANATION_LENGTH}
        />
      </FieldLabel>
    </div>
  )
}

/** Edits one saved question in place. */
function EditQuestionDialog({
  item,
  onClose,
  onSaved,
}: {
  item: AdminTestQuestion
  onClose: () => void
  onSaved: (test: AdminTestDetail) => void
}) {
  const [question, setQuestion] = useState<QuestionDraft>(() => ({
    key: item.id,
    category: item.category,
    text: item.text,
    options: [...item.options],
    correctOptionIndex: item.correctOptionIndex,
    explanation: item.explanation,
  }))
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')
    try {
      const saved = await adminFetch<AdminTestDetail>(`/api/admin-portal/tests/questions/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...toRequest(question), isActive: item.isActive }),
      })
      onSaved(saved)
    } catch (caught) {
      setFailure(errorText(caught, "Savolni saqlab bo'lmadi."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title="Savolni tahrirlash" subtitle="Savol rus tilida, izoh esa o'zbek tilida yoziladi." busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <QuestionFields value={question} onChange={setQuestion} idPrefix="edit" autoFocus />
        {failure && <ErrorNote>{failure}</ErrorNote>}
        <DialogActions busy={busy} canSubmit={questionProblems(question).length === 0} label="Saqlash" onClose={onClose} />
      </form>
    </Dialog>
  )
}

/**
 * Adds one or more questions in a single request. It opens with one card; "Yana savol
 * qo'shish" adds the next one only once every card so far is complete. From the second card on
 * the cards fold: each shows its number and question as a header that opens it, and only one is
 * open at a time, so a long batch stays short on screen. Whatever is typed is kept as a draft
 * in this browser until it is saved or cleared. Saved whole or not at all.
 */
function AddQuestionsDialog({
  testId,
  onClose,
  onSaved,
}: {
  testId: string
  onClose: () => void
  onSaved: (test: AdminTestDetail, added: number) => void
}) {
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => loadDraft(testId) ?? [emptyQuestion()])
  // The one card that is unfolded. A restored draft opens on its first unfinished card.
  const [openKey, setOpenKey] = useState<string | null>(
    () => (questions.find((question) => questionProblems(question).length > 0) ?? questions[questions.length - 1]).key,
  )
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  // Problems stay hidden until the admin tries to save or add another, so a fresh card is not all red.
  const [showProblems, setShowProblems] = useState(false)

  useEffect(() => saveDraft(testId, questions), [testId, questions])

  const problems = questions.map(questionProblems)
  const firstUnfinished = problems.findIndex((list) => list.length > 0)
  const ready = firstUnfinished === -1
  const foldable = questions.length > 1

  function update(index: number, next: QuestionDraft) {
    setQuestions((state) => state.map((question, i) => (i === index ? next : question)))
  }

  /** Shows what is missing and unfolds the first card that has something missing. */
  function pointAtUnfinished() {
    setShowProblems(true)
    setOpenKey(questions[firstUnfinished].key)
  }

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return
    if (!ready) {
      pointAtUnfinished()
      return
    }
    const next = emptyQuestion(questions[questions.length - 1].category)
    setQuestions([...questions, next])
    setOpenKey(next.key)
    setShowProblems(false)
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) {
      const fresh = emptyQuestion()
      setQuestions([fresh])
      setOpenKey(fresh.key)
      setShowProblems(false)
      return
    }
    const rest = questions.filter((_, i) => i !== index)
    setQuestions(rest)
    if (questions[index].key === openKey) setOpenKey(rest[Math.min(index, rest.length - 1)].key)
  }

  function clearAll() {
    const fresh = emptyQuestion()
    clearDraft(testId)
    setQuestions([fresh])
    setOpenKey(fresh.key)
    setShowProblems(false)
    setFailure('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) {
      pointAtUnfinished()
      return
    }
    setBusy(true)
    setFailure('')
    try {
      const saved = await adminFetch<AdminTestDetail>(`/api/admin-portal/tests/${testId}/questions/bulk`, {
        method: 'POST',
        body: JSON.stringify({ questions: questions.map(toRequest) }),
      })
      clearDraft(testId)
      onSaved(saved, questions.length)
    } catch (caught) {
      setFailure(errorText(caught, "Savollarni saqlab bo'lmadi."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Savol qo'shish"
      subtitle="Savol rus tilida, izoh esa o'zbek tilida yoziladi. Yozilganlar shu brauzerda qoralama sifatida saqlanadi."
      busy={busy}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <AnimatePresence initial={false}>
          {questions.map((question, index) => {
            const open = !foldable || question.key === openKey
            const unfinished = showProblems && problems[index].length > 0
            const panelId = `question-panel-${question.key}`
            const text = question.text.trim()

            return (
              <m.div
                key={question.key}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: { duration: duration.base, ease: ease.enter } }}
                exit={{ opacity: 0, height: 0, transition: { duration: duration.base, ease: ease.exit } }}
                className="overflow-hidden"
              >
                {/* The gap between cards is padding inside the animated box, so a leaving card takes it along. */}
                <div className="pb-3">
                  <div
                    className={cx(
                      'rounded-2xl border-2 transition-colors duration-200',
                      unfinished ? 'border-danger' : open ? 'border-hairline' : 'border-hairline bg-ground-sunken',
                    )}
                  >
                    <div className="flex items-center gap-2 p-2 pl-3">
                      {foldable ? (
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={panelId}
                          onClick={() => setOpenKey(open ? null : question.key)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1.5 text-left"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ground-raised text-sm font-black text-ink-muted tabular-nums">
                            {index + 1}
                          </span>
                          <span className={cx('min-w-0 flex-1 truncate text-sm font-bold', text ? 'text-ink' : 'text-ink-faint')} lang={text ? 'ru' : undefined}>
                            {text || 'Savol matni kiritilmagan'}
                          </span>
                          {!open && <Badge tone={unfinished ? 'danger' : 'signal'}>{unfinished ? "To'ldirilmagan" : CATEGORY[question.category]}</Badge>}
                          <ChevronDown aria-hidden="true" className={cx('size-4 shrink-0 text-ink-faint transition-transform duration-300', open && 'rotate-180')} />
                        </button>
                      ) : (
                        <h3 className="flex-1 py-1.5 text-sm font-extrabold text-ink">{index + 1}-savol</h3>
                      )}
                      <IconButton label={`${index + 1}-savolni olib tashlash`} tone="danger" onClick={() => removeQuestion(index)}>
                        <Trash2 aria-hidden="true" className="size-4" />
                      </IconButton>
                    </div>

                    <AnimatePresence initial={false}>
                      {open && (
                        <m.div
                          id={panelId}
                          key="panel"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto', transition: { duration: duration.base, ease: ease.enter } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: duration.quick, ease: ease.exit } }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4 px-4 pb-4">
                            <QuestionFields value={question} onChange={(next) => update(index, next)} idPrefix={question.key} autoFocus />
                            {unfinished && (
                              <ul
                                className="animate-in space-y-1 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger fade-in-0 slide-in-from-top-1"
                                aria-live="polite"
                              >
                                {problems[index].map((problem) => (
                                  <li key={problem}>{problem}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </m.div>
            )
          })}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
          <Button variant="secondary" onClick={addQuestion} disabled={busy || questions.length >= MAX_QUESTIONS}>
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
            Yana savol qo'shish
          </Button>
          <Button variant="secondary" size="sm" onClick={clearAll} disabled={busy}>
            Qoralamani tozalash
          </Button>
        </div>

        {failure && (
          <div className="pb-4">
            <ErrorNote>{failure}</ErrorNote>
          </div>
        )}
        <DialogActions
          busy={busy}
          canSubmit
          label={questions.length > 1 ? `${questions.length} ta savolni saqlash` : 'Saqlash'}
          onClose={onClose}
        />
      </form>
    </Dialog>
  )
}

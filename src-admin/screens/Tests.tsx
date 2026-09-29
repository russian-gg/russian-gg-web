import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, Check, ChevronRight, ListPlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useFocusTrap } from '../../src/lib/focus-trap'
import { cx } from '../../src/lib/cx'
import { Overlay } from '../../src/components/motion'
import { adminFetch, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import { BULK_EXAMPLE, MAX_OPTIONS, MIN_OPTIONS, parseBulkQuestions } from '../lib/bulk-questions'
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
  Tabs,
  Textarea,
  TextField,
} from '../components/ui'

const FIRST_DAY = 1
const LAST_DAY = 90

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

const DAY_OPTIONS = Array.from({ length: LAST_DAY - FIRST_DAY + 1 }, (_, i) => {
  const day = FIRST_DAY + i
  return { value: String(day), label: `${day}-kun` }
})

const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback)

/**
 * The admin panel's "Testlar" section. A test is created from its criteria — lesson day,
 * section, difficulty — then filled with questions, one at a time or pasted in bulk, then
 * switched on. Learners' blocks draw only from active tests, so a test can be written in full
 * before anybody sees it.
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

type CategoryFilter = 'all' | TestCategory

function TestList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminTest[]>('/api/admin-portal/tests')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [day, setDay] = useState('')
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
  const days = useMemo(() => [...new Set(items.map((item) => item.courseDay))].sort((a, b) => a - b), [items])

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
        (category === 'all' || item.category === category) &&
        (!day || item.courseDay === Number(day)) &&
        (!difficulty || item.difficulty === difficulty) &&
        (!needle || item.title.toLowerCase().includes(needle)),
    )
  }, [items, category, day, difficulty, query])

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-full overflow-x-auto">
              <Tabs<CategoryFilter>
                value={category}
                onChange={setCategory}
                options={[{ id: 'all', label: 'Hammasi' }, ...CATEGORIES.map((id) => ({ id, label: CATEGORY[id] }))]}
              />
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Select
                label="Kun"
                value={day}
                onChange={setDay}
                options={[{ value: '', label: 'Barcha kunlar' }, ...days.map((value) => ({ value: String(value), label: `${value}-kun` }))]}
              />
              <Select
                label="Qiyinlik"
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
            <Table head={['Test', 'Kun', "Bo'lim", 'Qiyinlik', 'Savollar', 'Faol', '']}>
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
                  <Cell muted>
                    <span className="whitespace-nowrap tabular-nums">{item.courseDay}-kun</span>
                  </Cell>
                  <Cell muted>{CATEGORY[item.category]}</Cell>
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
                  <td colSpan={7}>
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
          defaultDay={day ? Number(day) : FIRST_DAY}
          defaultCategory={category === 'all' ? 'Grammar' : category}
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
  const [question, setQuestion] = useState<AdminTestQuestion | 'new' | null>(null)
  const [bulk, setBulk] = useState(false)
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
                <Badge>{test.courseDay}-kun</Badge>
                <Badge tone="signal">{CATEGORY[test.category]}</Badge>
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
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setBulk(true)}>
              <ListPlus aria-hidden="true" className="size-4" />
              Ommaviy qo'shish
            </Button>
            <Button onClick={() => setQuestion('new')}>
              <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
              Savol qo'shish
            </Button>
          </div>
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
                onEdit={() => setQuestion(item)}
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

      {question && (
        <QuestionFormDialog
          testId={test.id}
          item={question === 'new' ? null : question}
          onClose={() => setQuestion(null)}
          onSaved={(next) => {
            setQuestion(null)
            setTest(next)
          }}
        />
      )}

      {bulk && (
        <BulkDialog
          testId={test.id}
          onClose={() => setBulk(false)}
          onSaved={(next, added) => {
            setBulk(false)
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
    <p role="status" className="animate-in rounded-[var(--radius-control)] bg-signal-soft px-4 py-3 text-sm text-ink fade-in-0">
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
        <p className="min-w-0 flex-1 font-bold whitespace-pre-line text-ink" lang="ru">
          {item.text}
        </p>
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
        className={cx('max-h-full w-full overflow-y-auto', wide ? 'max-w-3xl' : 'max-w-2xl')}
      >
        <Card as="div" className="w-full" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          </div>
          {children}
        </Card>
      </div>
    </Overlay>
  )
}

function DialogActions({ busy, canSubmit, label, onClose }: { busy: boolean; canSubmit: boolean; label: string; onClose: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-1">
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        Bekor qilish
      </Button>
      <Button type="submit" disabled={busy || !canSubmit}>
        {busy ? 'Saqlanmoqda…' : label}
      </Button>
    </div>
  )
}

/** Create and edit share one form. A created test starts inactive. */
function TestFormDialog({
  test,
  defaultDay = FIRST_DAY,
  defaultCategory = 'Grammar',
  onClose,
  onSaved,
}: {
  test: AdminTestDetail | null
  defaultDay?: number
  defaultCategory?: TestCategory
  onClose: () => void
  onSaved: (test: AdminTestDetail) => void
}) {
  const [title, setTitle] = useState(test?.title ?? '')
  const [courseDay, setCourseDay] = useState(test?.courseDay ?? defaultDay)
  const [category, setCategory] = useState<TestCategory>(test?.category ?? defaultCategory)
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
        body: JSON.stringify({ title: title.trim(), courseDay, category, difficulty }),
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
          ? "Mezonlar testning barcha savollariga tegishli."
          : "Avval test mezonlarini tanlang. Keyin savollarni qo'shasiz — test savollar tayyor bo'lguncha nofaol turadi."
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
          <span className="mb-1.5 block text-sm font-bold text-ink">Dars (kun)</span>
          <Select label="Dars (kun)" block value={String(courseDay)} onChange={(value) => setCourseDay(Number(value))} options={DAY_OPTIONS} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-sm font-bold text-ink">Bo'lim</span>
            <Segmented<TestCategory>
              value={category}
              onChange={setCategory}
              options={CATEGORIES.map((id) => ({ id, label: CATEGORY[id] }))}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-bold text-ink">Qiyinlik</span>
            <Segmented<TestDifficulty>
              value={difficulty}
              onChange={setDifficulty}
              options={DIFFICULTIES.map((id) => ({ id, label: DIFFICULTY[id].label }))}
            />
          </div>
        </div>

        {failure && <ErrorNote>{failure}</ErrorNote>}
        <DialogActions busy={busy} canSubmit={title.trim() !== ''} label={test ? 'Saqlash' : 'Yaratish'} onClose={onClose} />
      </form>
    </Dialog>
  )
}

function QuestionFormDialog({
  testId,
  item,
  onClose,
  onSaved,
}: {
  testId: string
  item: AdminTestQuestion | null
  onClose: () => void
  onSaved: (test: AdminTestDetail) => void
}) {
  const [text, setText] = useState(item?.text ?? '')
  const [options, setOptions] = useState<string[]>(item ? [...item.options] : ['', '', ''])
  const [correct, setCorrect] = useState(item?.correctOptionIndex ?? 0)
  const [explanation, setExplanation] = useState(item?.explanation ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  /** The right-answer mark follows its option when one above it is removed. */
  function removeOption(index: number) {
    if (options.length <= MIN_OPTIONS) return
    setOptions((state) => state.filter((_, i) => i !== index))
    setCorrect((value) => (index === value ? 0 : index < value ? value - 1 : value))
  }

  const complete = text.trim() !== '' && explanation.trim() !== '' && options.every((option) => option.trim() !== '')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')
    try {
      const saved = await adminFetch<AdminTestDetail>(
        item ? `/api/admin-portal/tests/questions/${item.id}` : `/api/admin-portal/tests/${testId}/questions`,
        {
          method: item ? 'PUT' : 'POST',
          body: JSON.stringify({
            text: text.trim(),
            options: options.map((option) => option.trim()),
            correctOptionIndex: correct,
            explanation: explanation.trim(),
            isActive: item?.isActive ?? true,
          }),
        },
      )
      onSaved(saved)
    } catch (caught) {
      setFailure(errorText(caught, "Savolni saqlab bo'lmadi."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={item ? 'Savolni tahrirlash' : "Savol qo'shish"}
      subtitle="Savol rus tilida, izoh esa o'zbek tilida yoziladi."
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <FieldLabel label="Savol">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Masalan: Выберите правильное окончание: Я живу в Ташкент__."
            maxLength={1000}
            required
            autoFocus
          />
        </FieldLabel>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-bold text-ink">
            Javob variantlari <span className="font-normal text-ink-muted">— to'g'ri javobni belgilang</span>
          </legend>
          {options.map((option, index) => {
            const isCorrect = index === correct
            return (
              <div key={index} className="flex items-center gap-2">
                <label
                  className={cx(
                    'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border-2 transition-colors',
                    isCorrect ? 'border-milestone bg-milestone-soft text-milestone' : 'border-hairline text-ink-faint hover:border-ink-faint',
                  )}
                  title="To'g'ri javob"
                >
                  <input
                    type="radio"
                    name="correct-option"
                    checked={isCorrect}
                    onChange={() => setCorrect(index)}
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
                  onChange={(event) => setOptions((state) => state.map((value, i) => (i === index ? event.target.value : value)))}
                  placeholder={`${index + 1}-variant`}
                  aria-label={`${index + 1}-variant`}
                  maxLength={300}
                  required
                />
                <IconButton label={`${index + 1}-variantni olib tashlash`} tone="danger" onClick={() => removeOption(index)}>
                  <X aria-hidden="true" className={cx('size-4', options.length <= MIN_OPTIONS && 'opacity-30')} />
                </IconButton>
              </div>
            )
          })}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOptions((state) => (state.length >= MAX_OPTIONS ? state : [...state, '']))}
            disabled={options.length >= MAX_OPTIONS}
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
            Variant qo'shish
          </Button>
        </fieldset>

        <FieldLabel label="Qoida / izoh">
          <Textarea
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            placeholder="Javobdan keyin va natijalar sahifasida ko'rsatiladi."
            maxLength={2000}
            required
          />
        </FieldLabel>

        {failure && <ErrorNote>{failure}</ErrorNote>}
        <DialogActions busy={busy} canSubmit={complete} label="Saqlash" onClose={onClose} />
      </form>
    </Dialog>
  )
}

/**
 * Paste many questions at once. The text is parsed as it is typed, so every mistake shows —
 * with its question number — before anything is sent; the batch is saved whole or not at all.
 */
function BulkDialog({
  testId,
  onClose,
  onSaved,
}: {
  testId: string
  onClose: () => void
  onSaved: (test: AdminTestDetail, added: number) => void
}) {
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const parsed = useMemo(() => parseBulkQuestions(source), [source])
  const ready = parsed.questions.length > 0 && parsed.problems.length === 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')
    try {
      const saved = await adminFetch<AdminTestDetail>(`/api/admin-portal/tests/${testId}/questions/bulk`, {
        method: 'POST',
        body: JSON.stringify({ questions: parsed.questions }),
      })
      onSaved(saved, parsed.questions.length)
    } catch (caught) {
      setFailure(errorText(caught, "Savollarni saqlab bo'lmadi."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="Ommaviy qo'shish"
      subtitle="Har bir savolni bo'sh qator bilan ajrating. Belgisiz qator — savol, «+» — to'g'ri variant, «-» — boshqa variantlar, «=» — izoh."
      busy={busy}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          <Textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={BULK_EXAMPLE}
            aria-label="Savollar matni"
            spellCheck={false}
            autoFocus
            className="min-h-80 font-mono text-[13px] leading-relaxed"
          />
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl bg-ground-sunken p-4">
              <div className="text-xs font-bold tracking-wide text-ink-faint uppercase">Tayyor</div>
              <div className="mt-1 text-3xl font-black text-ink tabular-nums">{parsed.questions.length}</div>
              <div className="text-ink-muted">ta savol</div>
            </div>
            <Button variant="secondary" size="sm" block onClick={() => setSource(BULK_EXAMPLE)} disabled={busy}>
              Namunani qo'yish
            </Button>
            {parsed.problems.length > 0 && (
              <ul className="max-h-60 space-y-1.5 overflow-y-auto" aria-live="polite">
                {parsed.problems.map((problem, index) => (
                  <li key={index} className="animate-in rounded-xl bg-danger-soft px-3 py-2 text-danger fade-in-0">
                    <span className="font-bold">{problem.number}-savol:</span> {problem.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {failure && <ErrorNote>{failure}</ErrorNote>}
        <DialogActions
          busy={busy}
          canSubmit={ready}
          label={parsed.questions.length > 0 ? `${parsed.questions.length} ta savolni qo'shish` : "Qo'shish"}
          onClose={onClose}
        />
      </form>
    </Dialog>
  )
}

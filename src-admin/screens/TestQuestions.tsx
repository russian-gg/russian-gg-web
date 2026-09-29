import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useFocusTrap } from '../../src/lib/focus-trap'
import { cx } from '../../src/lib/cx'
import { Overlay } from '../../src/components/motion'
import { adminFetch, formatNumber, useAdminQuery } from '../lib/api'
import type { AdminTestQuestion, TestCategory, TestDifficulty } from '../lib/types'
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
  inputClass,
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
  TextField,
} from '../components/ui'

/** Mirrors the server's rules, so the form stops a bad question before the round trip does. */
const MIN_OPTIONS = 3
const MAX_OPTIONS = 8
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

type CategoryFilter = 'all' | TestCategory

type FormState = {
  courseDay: number
  text: string
  options: string[]
  correctOptionIndex: number
  explanation: string
  category: TestCategory
  difficulty: TestDifficulty
}

const emptyForm = (courseDay = FIRST_DAY): FormState => ({
  courseDay,
  text: '',
  options: ['', '', ''],
  correctOptionIndex: 0,
  explanation: '',
  category: 'Grammar',
  difficulty: 'Easy',
})

const formFrom = (item: AdminTestQuestion): FormState => ({
  courseDay: item.courseDay,
  text: item.text,
  options: [...item.options],
  correctOptionIndex: item.correctOptionIndex,
  explanation: item.explanation,
  category: item.category,
  difficulty: item.difficulty,
})

/**
 * The question bank behind the learner's Tests tab. A block takes three questions per section
 * from the days the learner has reached, so what matters here is how full each day and section
 * is — that is what the filters and counts are for.
 */
export function TestQuestions() {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminTestQuestion[]>('/api/admin-portal/test-questions')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [day, setDay] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<AdminTestQuestion | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminTestQuestion | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  // Server answers to a toggle, laid over the list until the next fetch lands (see PromoCodes).
  const [patched, setPatched] = useState<Record<string, AdminTestQuestion>>({})
  useEffect(() => setPatched({}), [data])

  const items = useMemo(() => (data ?? []).map((item) => patched[item.id] ?? item), [data, patched])

  const days = useMemo(() => [...new Set(items.map((item) => item.courseDay))].sort((a, b) => a - b), [items])

  const counts = useMemo(() => {
    const result: Record<CategoryFilter, number> = { all: 0, Grammar: 0, Phonetics: 0, Vocabulary: 0 }
    for (const item of items) {
      if (!item.isActive) continue
      result.all += 1
      result[item.category] += 1
    }
    return result
  }, [items])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter(
      (item) =>
        (category === 'all' || item.category === category) &&
        (!day || item.courseDay === Number(day)) &&
        (!difficulty || item.difficulty === difficulty) &&
        (!needle ||
          item.text.toLowerCase().includes(needle) ||
          item.options.some((option) => option.toLowerCase().includes(needle))),
    )
  }, [items, category, day, difficulty, query])

  async function toggle(item: AdminTestQuestion) {
    setActionError('')
    setToggling((state) => ({ ...state, [item.id]: true }))
    try {
      const next = await adminFetch<AdminTestQuestion>(`/api/admin-portal/test-questions/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      setPatched((state) => ({ ...state, [item.id]: next }))
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Holatni o'zgartirib bo'lmadi.")
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
      // 204 when it is gone; a body when the server switched it off instead because it was served.
      const result = await adminFetch<{ deactivated?: boolean } | undefined>(
        `/api/admin-portal/test-questions/${deleting.id}`,
        { method: 'DELETE' },
      )
      if (result?.deactivated) {
        setNotice("Savol o'quvchilarga berilgan, shuning uchun o'chirilmadi — faqat o'chirib qo'yildi.")
      }
      setDeleting(null)
      refresh()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Savolni o'chirib bo'lmadi.")
      setDeleting(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <Screen className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageHeader title="Testlar" subtitle="O'quvchilarning test bloklari uchun savollar banki" />
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
            Yangi savol
          </Button>
        </div>

        {!data && isLoading ? (
          <LoadingStats count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Faol savollar"
              value={formatNumber(counts.all)}
              note={`${items.length - counts.all} ta o'chirilgan`}
            />
            {CATEGORIES.map((id) => (
              <Stat key={id} label={CATEGORY[id]} value={formatNumber(counts[id])} note="Faol savollar" />
            ))}
          </div>
        )}

        <Card as="div" className="space-y-4 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-full overflow-x-auto">
              <Tabs<CategoryFilter>
                value={category}
                onChange={setCategory}
                options={[
                  { id: 'all', label: 'Hammasi' },
                  ...CATEGORIES.map((id) => ({ id, label: CATEGORY[id] })),
                ]}
              />
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Select
                label="Kun"
                value={day}
                onChange={setDay}
                options={[
                  { value: '', label: 'Barcha kunlar' },
                  ...days.map((value) => ({ value: String(value), label: `${value}-kun` })),
                ]}
              />
              <Select
                label="Qiyinlik"
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: '', label: 'Barcha darajalar' },
                  ...DIFFICULTIES.map((id) => ({ value: id, label: DIFFICULTY[id].label })),
                ]}
              />
              <div className="relative w-full sm:w-56">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint"
                />
                <TextField value={query} onChange={setQuery} placeholder="Savol bo'yicha qidirish" className="w-full pl-10" />
              </div>
            </div>
          </div>

          {notice && (
            <p role="status" className="rounded-[var(--radius-control)] bg-signal-soft px-4 py-3 text-sm text-ink">
              {notice}
            </p>
          )}
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
          {!data && isLoading && <LoadingRows />}

          {data && (
            <Table head={['Kun', 'Savol', "Bo'lim", 'Qiyinlik', 'Faol', '']}>
              {visible.map((item) => (
                <Row key={item.id}>
                  <Cell muted>
                    <span className="whitespace-nowrap tabular-nums">{item.courseDay}-kun</span>
                  </Cell>
                  <Cell>
                    <div className="max-w-xl">
                      <div className="font-bold text-ink">{item.text}</div>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.options.map((option, index) => (
                          <li
                            key={index}
                            className={cx(
                              'rounded-full px-2.5 py-0.5 text-xs',
                              index === item.correctOptionIndex
                                ? 'bg-milestone-soft font-bold text-milestone'
                                : 'bg-ground-sunken text-ink-muted',
                            )}
                          >
                            {option}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Cell>
                  <Cell muted>{CATEGORY[item.category]}</Cell>
                  <Cell>
                    <Badge tone={DIFFICULTY[item.difficulty].tone}>{DIFFICULTY[item.difficulty].label}</Badge>
                  </Cell>
                  <Cell>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.isActive}
                      aria-label={`${item.text} — ${item.isActive ? "o'chirish" : 'yoqish'}`}
                      disabled={toggling[item.id]}
                      onClick={() => void toggle(item)}
                      className="disabled:opacity-50"
                    >
                      <Switch checked={item.isActive} />
                    </button>
                  </Cell>
                  <Cell>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton label="Tahrirlash" onClick={() => setEditing(item)}>
                        <Pencil aria-hidden="true" className="size-4" />
                      </IconButton>
                      <IconButton label="O'chirish" tone="danger" onClick={() => setDeleting(item)}>
                        <Trash2 aria-hidden="true" className="size-4" />
                      </IconButton>
                    </div>
                  </Cell>
                </Row>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyNote>
                      {items.length === 0 ? "Hali savol qo'shilmagan" : "Bu filtr bo'yicha savol topilmadi"}
                    </EmptyNote>
                  </td>
                </tr>
              )}
            </Table>
          )}
        </Card>
      </Screen>

      {editing && (
        <QuestionFormDialog
          item={editing === 'new' ? null : editing}
          defaultDay={day ? Number(day) : FIRST_DAY}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Savolni o'chirish"
          body={
            <>
              <strong className="font-extrabold text-ink">{deleting.text}</strong> o'chiriladi. Agar u
              o'quvchilarga allaqachon berilgan bo'lsa, ularning natijalari saqlanib qolishi uchun savol
              o'chirilmaydi — faqat o'chirib qo'yiladi.
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

/* -------------------------------------------------------------------------------- form */

const textareaClass =
  'min-h-24 w-full rounded-2xl border-2 border-hairline bg-ground-raised px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none'

/** Create and edit share one form: an edit is a create that starts filled in. */
function QuestionFormDialog({
  item,
  defaultDay,
  onClose,
  onSaved,
}: {
  item: AdminTestQuestion | null
  defaultDay: number
  onClose: () => void
  onSaved: () => void
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const [form, setForm] = useState<FormState>(() => (item ? formFrom(item) : emptyForm(defaultDay)))
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((state) => ({ ...state, [key]: value }))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  function setOption(index: number, value: string) {
    setForm((state) => ({ ...state, options: state.options.map((option, i) => (i === index ? value : option)) }))
  }

  function addOption() {
    setForm((state) =>
      state.options.length >= MAX_OPTIONS ? state : { ...state, options: [...state.options, ''] },
    )
  }

  /** The right-answer mark follows its option when one above it is removed. */
  function removeOption(index: number) {
    setForm((state) => {
      if (state.options.length <= MIN_OPTIONS) return state
      const correct = state.correctOptionIndex
      return {
        ...state,
        options: state.options.filter((_, i) => i !== index),
        correctOptionIndex: index === correct ? 0 : index < correct ? correct - 1 : correct,
      }
    })
  }

  const complete =
    form.text.trim() !== '' && form.explanation.trim() !== '' && form.options.every((option) => option.trim() !== '')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')

    try {
      await adminFetch<AdminTestQuestion>(
        item ? `/api/admin-portal/test-questions/${item.id}` : '/api/admin-portal/test-questions',
        {
          method: item ? 'PUT' : 'POST',
          body: JSON.stringify({
            courseDay: form.courseDay,
            text: form.text.trim(),
            options: form.options.map((option) => option.trim()),
            correctOptionIndex: form.correctOptionIndex,
            explanation: form.explanation.trim(),
            category: form.category,
            difficulty: form.difficulty,
            isActive: item?.isActive ?? true,
          }),
        },
      )
      onSaved()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Savolni saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  const title = item ? 'Savolni tahrirlash' : 'Yangi savol'

  return (
    <Overlay open onDismiss={busy ? undefined : onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-full w-full max-w-2xl overflow-y-auto"
      >
        <Card as="div" className="w-full" onClick={(event) => event.stopPropagation()}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink">{title}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Savol rus tilida, izoh esa o'zbek tilida yoziladi. O'quvchi savolni shu kunga yetganda oladi.
              </p>
            </div>

            <FieldLabel label="Dars (kun)">
              <select
                value={form.courseDay}
                onChange={(event) => set('courseDay', Number(event.target.value))}
                className={cx(inputClass, 'px-3 font-semibold')}
              >
                {Array.from({ length: LAST_DAY - FIRST_DAY + 1 }, (_, i) => FIRST_DAY + i).map((value) => (
                  <option key={value} value={value}>
                    {value}-kun
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Savol">
              <textarea
                value={form.text}
                onChange={(event) => set('text', event.target.value)}
                placeholder="Masalan: Выберите правильное окончание: Я живу в Ташкент__."
                maxLength={1000}
                required
                autoFocus
                className={textareaClass}
              />
            </FieldLabel>

            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-sm font-bold text-ink">
                Javob variantlari <span className="font-normal text-ink-muted">— to'g'ri javobni belgilang</span>
              </legend>
              {form.options.map((option, index) => {
                const correct = index === form.correctOptionIndex
                return (
                  <div key={index} className="flex items-center gap-2">
                    <label
                      className={cx(
                        'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border-2 transition-colors',
                        correct ? 'border-milestone bg-milestone-soft text-milestone' : 'border-hairline text-ink-faint hover:border-ink-faint',
                      )}
                      title="To'g'ri javob"
                    >
                      <input
                        type="radio"
                        name="correct-option"
                        checked={correct}
                        onChange={() => set('correctOptionIndex', index)}
                        aria-label={`${index + 1}-variant to'g'ri javob`}
                        className="sr-only"
                      />
                      {correct ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : index + 1}
                    </label>
                    <input
                      value={option}
                      onChange={(event) => setOption(index, event.target.value)}
                      placeholder={`${index + 1}-variant`}
                      maxLength={300}
                      required
                      className={inputClass}
                    />
                    <IconButton
                      label={`${index + 1}-variantni olib tashlash`}
                      tone="danger"
                      onClick={() => removeOption(index)}
                    >
                      <X aria-hidden="true" className={cx('size-4', form.options.length <= MIN_OPTIONS && 'opacity-30')} />
                    </IconButton>
                  </div>
                )
              })}
              <Button
                variant="secondary"
                size="sm"
                onClick={addOption}
                disabled={form.options.length >= MAX_OPTIONS}
              >
                <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
                Variant qo'shish
              </Button>
            </fieldset>

            <FieldLabel label="Qoida / izoh">
              <textarea
                value={form.explanation}
                onChange={(event) => set('explanation', event.target.value)}
                placeholder="Javobdan keyin va natijalar sahifasida ko'rsatiladi."
                maxLength={2000}
                required
                className={textareaClass}
              />
            </FieldLabel>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Bo'lim">
                <Segmented<TestCategory>
                  value={form.category}
                  onChange={(value) => set('category', value)}
                  options={CATEGORIES.map((id) => ({ id, label: CATEGORY[id] }))}
                />
              </FieldLabel>
              <FieldLabel label="Qiyinlik">
                <Segmented<TestDifficulty>
                  value={form.difficulty}
                  onChange={(value) => set('difficulty', value)}
                  options={DIFFICULTIES.map((id) => ({ id, label: DIFFICULTY[id].label }))}
                />
              </FieldLabel>
            </div>

            {failure && <ErrorNote>{failure}</ErrorNote>}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={busy || !complete}>
                {busy ? 'Saqlanmoqda…' : 'Saqlash'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Overlay>
  )
}

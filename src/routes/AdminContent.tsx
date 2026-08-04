import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, RequestError } from '../lib/api'
import { cx } from '../lib/cx'
import { useT } from '../lib/i18n'
import type {
  ContentReviewStatus,
  ContentReviewView,
  MissionReviewView,
  OperationsView,
} from '../lib/types'
import { Badge, Button, Card, ErrorNote, SectionHeading, Spinner } from '../components/ui'

const STATUS_LABEL: Record<ContentReviewStatus, string> = {
  Draft: 'Qoralama',
  InReview: 'Ko’rib chiqilmoqda',
  ChangesRequested: 'Tuzatish so’ralgan',
  Approved: 'Tasdiqlangan',
  Published: 'Nashr qilingan',
  Archived: 'Arxivlangan',
}

/** Next legal moves per state; mirrors the server's transition table. */
const NEXT_STATES: Record<ContentReviewStatus, ContentReviewStatus[]> = {
  Draft: ['InReview', 'Archived'],
  InReview: ['Approved', 'ChangesRequested', 'Archived'],
  ChangesRequested: ['InReview', 'Archived'],
  Approved: ['Published', 'ChangesRequested'],
  Published: ['Archived'],
  Archived: [],
}

/**
 * The editorial console (PRD §14). Nothing reaches learners without a named editor moving it
 * to Published, so this screen is the gate, not a convenience.
 */
export function AdminContent() {
  const t = useT()

  const [tab, setTab] = useState<'review' | 'translations'>('review')
  const [filter, setFilter] = useState<ContentReviewStatus | null>('InReview')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: missions, isLoading } = useQuery({
    queryKey: ['admin-missions', filter],
    queryFn: () =>
      api.get<MissionReviewView[]>(`/admin/missions${filter ? `?status=${filter}` : ''}`),
  })

  const { data: operations } = useQuery({
    queryKey: ['admin-operations'],
    queryFn: () => api.get<OperationsView>('/admin/operations'),
    retry: false,
  })

  const decide = useMutation({
    mutationFn: ({ id, toStatus, comment }: { id: string; toStatus: ContentReviewStatus; comment?: string }) =>
      api.post<MissionReviewView>(`/admin/missions/${id}/review`, { toStatus, comment }),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-missions'] })
    },
    onError: (caught) =>
      setError(caught instanceof RequestError ? caught.message : 'Amalni bajarib bo’lmadi.'),
  })

  return (
    <div className="space-y-9">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Kontent nazorati</h1>
        <p className="text-support mt-1">
          Har bir mashq nashrdan oldin rus tili muharriri tomonidan tasdiqlanishi shart.
        </p>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex gap-2">
        {(['review', 'translations'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTab(option)}
            aria-pressed={tab === option}
            className={cx(
              'rounded-[var(--radius-control)] px-4 py-2 text-sm font-extrabold transition-colors',
              tab === option
                ? 'bg-signal text-on-signal shadow-[0_3px_0_0_var(--color-signal-depth)]'
                : 'text-ink-muted hover:bg-ground-sunken hover:text-ink',
            )}
          >
            {option === 'review' ? 'Nashr nazorati' : 'Tarjimalar'}
          </button>
        ))}
      </div>

      {tab === 'translations' && <TranslationsPanel onError={setError} />}

      {tab === 'review' && operations && <OperationsPanel operations={operations} />}

      {tab === 'review' && (
      <div className="flex flex-wrap gap-2">
        {([null, 'Draft', 'InReview', 'Approved', 'Published'] as const).map((status) => (
          <button
            key={status ?? 'all'}
            type="button"
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              filter === status
                ? 'bg-signal text-on-signal'
                : 'border-2 border-hairline text-ink-muted hover:text-ink'
            }`}
          >
            {status ? STATUS_LABEL[status] : 'Barchasi'}
          </button>
        ))}
      </div>
      )}

      {tab === 'review' && isLoading && <Spinner />}

      {tab === 'review' && (
      <div className="space-y-3">
        {missions?.map((mission) => (
          <Card key={mission.id} as="article">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={mission.status === 'Published' ? 'milestone' : 'neutral'}>
                {STATUS_LABEL[mission.status]}
              </Badge>
              <Badge>v{mission.version}</Badge>
              {mission.courseDay && <Badge>{mission.courseDay}-kun</Badge>}
            </div>

            <h3 className="mt-3 text-base font-extrabold text-ink">{mission.titleRu}</h3>
            <p className="text-support">{mission.slug}</p>

            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <Row term="Uslub" value={t.labels.formality[mission.formality]} />
              <Row term="Ishda" value={t.labels.workplace[mission.workplaceUse]} />
              <Row term="Iboralar" value={String(mission.targetPhraseCount)} />
              <Row term="Qadamlar" value={String(mission.stepCount)} />
            </dl>

            {/* Surfaced because publishing is blocked without it for informal content. */}
            {!mission.hasUsageNote &&
              (mission.formality === 'Informal' || mission.formality === 'Slang') && (
                <p className="mt-3 rounded-lg bg-caution-soft px-3 py-2 text-sm text-caution">
                  Qo’llash izohi yo’q — norasmiy kontent bunisiz nashr qilinmaydi.
                </p>
              )}

            <div className="mt-4 flex flex-wrap gap-2">
              {NEXT_STATES[mission.status].map((next) => (
                <Button
                  key={next}
                  variant={next === 'Published' ? 'primary' : 'secondary'}
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({
                      id: mission.id,
                      toStatus: next,
                      comment:
                        next === 'ChangesRequested'
                          ? (prompt('Nima tuzatilishi kerak?') ?? undefined)
                          : undefined,
                    })
                  }
                >
                  {STATUS_LABEL[next]}
                </Button>
              ))}

              <Button
                variant="ghost"
                onClick={() => setSelected(selected === mission.id ? null : mission.id)}
              >
                Tarix
              </Button>
            </div>

            {selected === mission.id && <History missionId={mission.id} />}
          </Card>
        ))}

        {missions?.length === 0 && (
          <p className="text-support">Bu holatda mashqlar yo’q.</p>
        )}
      </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- translations */

interface TranslationRow {
  kind: string
  key: string
  field: string
  label: string
  uz: string
  ru?: string | null
  en?: string | null
}

const FIELD_LABEL: Record<string, string> = {
  title: 'Nomi',
  objective: 'Maqsadi',
  outcome: 'Natijasi',
  focus: 'Mavzusi',
}

const KIND_LABEL: Record<string, string> = {
  mission: 'Mashqlar',
  milestone: 'Bosqichlar',
  courseDay: 'Kunlar',
}

/**
 * The translation table. Uzbek is shown but not editable: it is the source every other
 * language falls back to, and it belongs with the curriculum rather than with a form.
 *
 * Edits are held locally and saved together, because translating is done in passes — nobody
 * writes one Russian sentence and reloads the page.
 */
function TranslationsPanel({ onError }: { onError: (message: string | null) => void }) {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState('mission')
  const [drafts, setDrafts] = useState<Record<string, { ru: string; en: string }>>({})

  const { data: rows, isLoading } = useQuery({
    queryKey: ['admin-translations'],
    queryFn: () => api.get<TranslationRow[]>('/admin/translations'),
  })

  const save = useMutation({
    mutationFn: (edits: Array<{ kind: string; key: string; field: string; ru: string; en: string }>) =>
      api.put<number>('/admin/translations', { edits }),
    onSuccess: async () => {
      onError(null)
      setDrafts({})
      await queryClient.invalidateQueries({ queryKey: ['admin-translations'] })
    },
    onError: (caught) =>
      onError(caught instanceof RequestError ? caught.message : 'Tarjimani saqlab bo’lmadi.'),
  })

  if (isLoading) return <Spinner />

  const shown = rows?.filter((row) => row.kind === kind) ?? []
  const idOf = (row: TranslationRow) => `${row.kind}:${row.key}:${row.field}`
  const valueOf = (row: TranslationRow) =>
    drafts[idOf(row)] ?? { ru: row.ru ?? '', en: row.en ?? '' }

  const pending = Object.entries(drafts).map(([id, value]) => {
    const [rowKind, key, field] = id.split(':')
    return { kind: rowKind, key, field, ...value }
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(KIND_LABEL).map(([option, label]) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            onClick={() => setKind(option)}
            className={cx(
              'rounded-full px-3.5 py-1.5 text-sm font-bold transition',
              kind === option
                ? 'bg-signal-soft text-signal-ink'
                : 'border-2 border-hairline text-ink-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}

        <span className="text-support ml-auto">
          {pending.length > 0
            ? `${pending.length} ta o’zgarish saqlanmagan`
            : 'Hammasi saqlangan'}
        </span>

        <Button disabled={pending.length === 0 || save.isPending} onClick={() => save.mutate(pending)}>
          Saqlash
        </Button>
      </div>

      <div className="space-y-3">
        {shown.map((row) => {
          const id = idOf(row)
          const value = valueOf(row)

          return (
            <Card key={id} as="article">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{FIELD_LABEL[row.field] ?? row.field}</Badge>
                <span className="text-support">{row.label}</span>
              </div>

              <p className="mt-2 text-base text-ink">{row.uz}</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(['ru', 'en'] as const).map((language) => (
                  <label key={language} className="block">
                    <span className="mb-1 block text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
                      {language === 'ru' ? 'Ruscha' : 'Inglizcha'}
                    </span>
                    <textarea
                      rows={2}
                      value={value[language]}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [id]: { ...value, [language]: event.target.value },
                        }))
                      }
                      placeholder={row.uz}
                      className="w-full rounded-xl border-2 border-hairline bg-ground-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                    />
                  </label>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function OperationsPanel({ operations }: { operations: OperationsView }) {
  const items = [
    { label: 'Ko’rikni kutayotgan', value: operations.missionsAwaitingReview, warn: false },
    { label: 'Dead-letter jobs', value: operations.deadLetteredJobs, warn: operations.deadLetteredJobs > 0 },
    {
      label: 'Solishtirilmagan to’lovlar',
      value: operations.unreconciledPaymentEvents,
      warn: operations.unreconciledPaymentEvents > 0,
    },
  ]

  return (
    <section>
      <SectionHeading>Operatsion holat</SectionHeading>
      <Card>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label}>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  item.warn ? 'text-signal-ink' : 'text-ink'
                }`}
              >
                {item.value}
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-faint">
                {item.label}
              </p>
            </div>
          ))}

          <div>
            <p
              className={`text-2xl font-semibold ${
                operations.voiceProviderHealthy ? 'text-milestone' : 'text-signal-ink'
              }`}
            >
              {operations.voiceProviderHealthy ? 'OK' : 'Nosoz'}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-faint">
              Ovoz provayderi
            </p>
          </div>
        </div>
      </Card>
    </section>
  )
}

function History({ missionId }: { missionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-history', missionId],
    queryFn: () => api.get<ContentReviewView[]>(`/admin/missions/${missionId}/history`),
  })

  if (isLoading) return <Spinner label="Tarix" />

  return (
    <ol className="mt-4 space-y-2 border-t border-hairline pt-4">
      {data?.map((entry, index) => (
        <li key={index} className="text-sm">
          <span className="font-medium text-ink">
            {STATUS_LABEL[entry.fromStatus]} → {STATUS_LABEL[entry.toStatus]}
          </span>
          {entry.wasAiDrafted && <Badge tone="caution">AI qoralama</Badge>}
          {entry.comment && <p className="text-support">{entry.comment}</p>}
        </li>
      ))}
    </ol>
  )
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt className="text-ink-faint">{term}</dt>
      <dd className="text-ink">{value}</dd>
    </>
  )
}

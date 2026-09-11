import { useState } from 'react'
import { formatDateTime, formatNumber, formatPercent, useAdminQuery } from '../lib/api'
import type { LessonFeedbackReport } from '../lib/types'
import { BarList } from '../components/charts'
import {
  Badge,
  Card,
  Cell,
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  Pager,
  Row,
  SectionHeading,
  Select,
  Stat,
  Table,
} from '../components/ui'

const PAGE_SIZE = 20

/*
 * What each score meant on the learner's card, index = score - 1. Written out here rather than
 * imported: the admin panel deliberately does not share the learner app's dictionary.
 */
const SATISFACTION = ['Umuman mamnun emas', 'Mamnun emas', 'Betaraf', 'Mamnun', 'Juda mamnun']
const RECOMMENDATION = [
  "Yo'q, tavsiya qilmaydi",
  "Ehtimol, yo'q",
  'Hali bilmaydi',
  'Ehtimol, tavsiya qiladi',
  'Albatta tavsiya qiladi',
]
const RATING = ['1 yulduz', '2 yulduz', '3 yulduz', '4 yulduz', '5 yulduz']

type Tone = 'milestone' | 'caution' | 'danger'

const averageOf = (value?: number | null) => (value === null || value === undefined ? '—' : `${value.toFixed(1)} / 5`)

/** Best answer on top, the order the learner saw the cards in. */
const distribution = (labels: string[], counts: number[]) =>
  labels.map((label, index) => ({ label, value: counts[index] ?? 0 })).reverse()

const toneFor = (score: number): Tone => (score >= 4 ? 'milestone' : score === 3 ? 'caution' : 'danger')

export function LessonFeedbacks() {
  const [page, setPage] = useState(1)
  const [checkpoint, setCheckpoint] = useState('')

  const query = `/api/admin-portal/lesson-feedback?page=${page}&pageSize=${PAGE_SIZE}${
    checkpoint ? `&checkpointDay=${checkpoint}` : ''
  }`
  const { data, error, isLoading } = useAdminQuery<LessonFeedbackReport>(query)

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dars fikrlari"
        subtitle="O'quvchilar har 3 kunlik darsdan keyin qoldirgan baholar va izohlar"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          label="Kun"
          value={checkpoint}
          onChange={(value) => {
            setPage(1)
            setCheckpoint(value)
          }}
          options={[
            { value: '', label: 'Barcha kunlar' },
            ...data.checkpoints.map((day) => ({ value: String(day), label: `${day}-kun` })),
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Javoblar" value={formatNumber(data.responses)} />
        <Stat label="O'rtacha baho" value={averageOf(data.averageRating)} note="Yulduzlar bo'yicha" />
        <Stat label="Mamnunlik" value={averageOf(data.averageSatisfaction)} note="5 — juda mamnun" />
        <Stat
          label="Tavsiya qiladi"
          value={formatPercent(data.recommendPercent)}
          note="«Albatta» yoki «Ehtimol» deganlar"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeading>Mamnunlik</SectionHeading>
          <BarList items={distribution(SATISFACTION, data.satisfactionCounts)} format={formatNumber} labelWidth="w-28 sm:w-40" />
        </Card>
        <Card>
          <SectionHeading>Tavsiya qilish</SectionHeading>
          <BarList items={distribution(RECOMMENDATION, data.recommendationCounts)} format={formatNumber} labelWidth="w-28 sm:w-40" />
        </Card>
        <Card>
          <SectionHeading>Yulduzli baho</SectionHeading>
          <BarList items={distribution(RATING, data.ratingCounts)} format={formatNumber} labelWidth="w-20 sm:w-24" />
        </Card>
      </div>

      <Table head={['Foydalanuvchi', 'Kun', 'Mamnunlik', 'Tavsiya', 'Baho', 'Izoh', 'Vaqt']}>
        {data.items.map((item) => (
          <Row key={item.id}>
            <Cell>
              <span className="block font-bold text-ink">{item.displayName || 'Ismsiz'}</span>
              <span className="block text-xs text-ink-faint">{item.email || item.phoneNumber || '—'}</span>
            </Cell>
            <Cell muted>{item.checkpointDay}-kun</Cell>
            <Cell>
              <Badge tone={toneFor(item.satisfaction)}>{SATISFACTION[item.satisfaction - 1] ?? item.satisfaction}</Badge>
            </Cell>
            <Cell>
              <Badge tone={toneFor(item.recommendation)}>{RECOMMENDATION[item.recommendation - 1] ?? item.recommendation}</Badge>
            </Cell>
            <Cell>
              <Stars value={item.rating} />
            </Cell>
            <Cell wrap>
              <span className="block max-w-md whitespace-pre-wrap break-words">{item.note || '—'}</span>
            </Cell>
            <Cell muted>{formatDateTime(item.createdAt)}</Cell>
          </Row>
        ))}
        {data.items.length === 0 && (
          <tr>
            <td colSpan={7}>
              <EmptyNote>Hali fikr qoldirilmagan</EmptyNote>
            </td>
          </tr>
        )}
      </Table>

      <Pager page={page} total={data.responses} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  )
}

type StarsProps = {
  value: number
}

function Stars({ value }: StarsProps) {
  const filled = Math.max(0, Math.min(5, value))
  return (
    <span className="whitespace-nowrap text-base tracking-wider" aria-label={`${filled} / 5`} title={`${filled} / 5`}>
      <span className="text-coin">{'★'.repeat(filled)}</span>
      <span className="text-hairline">{'★'.repeat(5 - filled)}</span>
    </span>
  )
}

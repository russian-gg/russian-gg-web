import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { phaseLabelUz } from '../lib/format'
import type { CourseDayView, EntitlementView, MissionSummary } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { Badge, Card, SectionHeading, Spinner } from '../components/ui'

/** The 90-day map. Locked days stay visible so the shape of the journey is legible. */
export function CoursePath() {
  const [openDay, setOpenDay] = useState<number | null>(null)

  const { data: days, isLoading } = useQuery({
    queryKey: ['course-map'],
    queryFn: () => api.get<CourseDayView[]>('/course/map'),
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  if (isLoading || !days) return <Spinner />

  const isPreviewMode = entitlement?.hasProAccess === true && entitlement.status === 'None'

  const phases = [
    { phase: 'Foundation' as const, range: '1–30' },
    { phase: 'Bridge' as const, range: '31–60' },
    { phase: 'Immersion' as const, range: '61–90' },
  ]

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">90 kunlik yo’l</h1>
        <p className="text-support mt-1">
          Har bir kun bitta ovozli mashq. O’zbek tilidagi qo’llab-quvvatlash bosqichma-bosqich kamayadi.
        </p>
      </header>

      {phases.map(({ phase, range }) => {
        const phaseDays = days.filter((day) => day.phase === phase)
        if (phaseDays.length === 0) return null

        return (
          <section key={phase}>
            <SectionHeading>
              {phaseLabelUz[phase]} · {range}-kun
            </SectionHeading>

            <div className="space-y-2">
              {phaseDays.map((day) => (
                <DayRow
                  key={day.day}
                  day={day}
                  isOpen={openDay === day.day}
                  isPreviewMode={isPreviewMode}
                  onToggle={() => setOpenDay(openDay === day.day ? null : day.day)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function DayRow({
  day,
  isOpen,
  isPreviewMode,
  onToggle,
}: {
  day: CourseDayView
  isOpen: boolean
  isPreviewMode: boolean
  onToggle: () => void
}) {
  const { data: missions, isLoading } = useQuery({
    queryKey: ['day-missions', day.day],
    queryFn: () => api.get<MissionSummary[]>(`/course/days/${day.day}/missions`),
    enabled: isOpen,
  })

  const isDone = day.completedMissionCount >= day.requiredMissionCount

  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-4 py-3 text-left"
      >
        <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink-faint">
          {day.day}
        </span>

        <span
          className={`flex-1 text-base ${
            day.isUnlocked || isPreviewMode ? 'text-ink' : 'text-ink-faint'
          }`}
        >
          {day.focusUz}
        </span>

        {isDone && <Badge tone="milestone">Bajarildi</Badge>}
        {!isPreviewMode && !day.isUnlocked && !isDone && (
          <Badge tone={day.isFreePreview ? 'neutral' : 'caution'}>
            {day.isFreePreview ? 'Ochiq' : 'Yopiq'}
          </Badge>
        )}
      </button>

      {isOpen && (
        <div className="pb-4 pl-12">
          {isLoading && <Spinner label="Mashqlar" />}
          {missions && missions.length === 0 && (
            <Card>
              <p className="text-support">
                Bu kun uchun mashqlar tayyorlanmoqda. 1–30-kunlar to’liq ochiq.
              </p>
            </Card>
          )}
          {missions && missions.length > 0 && (
            <div className="space-y-3">
              {missions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

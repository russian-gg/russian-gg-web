import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { phaseLabelUz } from '../lib/format'
import type { CourseDayView, EntitlementView, MissionSummary, ProgressView } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { Badge, Button, Card, SectionHeading, Spinner } from '../components/ui'

export function CoursePath() {
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [lockedMessage, setLockedMessage] = useState<string | null>(null)

  const { data: days, isLoading } = useQuery({
    queryKey: ['course-map'],
    queryFn: () => api.get<CourseDayView[]>('/course/map'),
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  const { data: progress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
  })

  if (isLoading || !days) return <Spinner />

  const completedDays = Math.max(0, (progress?.currentDay ?? 1) - 1)
  const isPreviewMode = entitlement?.hasProAccess === true && entitlement.status === 'None'

  const phases = [
    { phase: 'Foundation' as const, range: '1-30' },
    { phase: 'Bridge' as const, range: '31-60' },
    { phase: 'Immersion' as const, range: '61-90' },
  ]

  function handleToggle(day: CourseDayView) {
    if (!day.isUnlocked && !isPreviewMode) {
      setLockedMessage("Avval shu darajagacha yetib keling, keyin bu bo'lim ochiladi.")
      return
    }
    setOpenDay((current) => (current === day.day ? null : day.day))
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">90 kunlik yo'l</h1>
          <p className="text-support mt-1">
            Har bir kun bittadan aniq vazifa. Kunma-kun yurganingiz sari yo'l o'zi ochilib boradi.
          </p>
        </div>
        <Badge tone="milestone">{completedDays}/90</Badge>
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
                  onToggle={() => handleToggle(day)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {lockedMessage && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4">
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-semibold text-ink">Bu kun hali yopiq</h2>
            <p className="text-support mt-2">{lockedMessage}</p>
            <Button className="mt-5" onClick={() => setLockedMessage(null)}>
              Tushunarli
            </Button>
          </Card>
        </div>
      )}
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

        <span className={`flex-1 text-base ${day.isUnlocked ? 'text-ink' : 'text-ink-faint'}`}>
          {day.focusUz}
        </span>

        {isDone && <Badge tone="milestone">Bajarilgan</Badge>}
        {!day.isUnlocked && !isPreviewMode && !isDone && <Badge tone="caution">Yopiq</Badge>}
      </button>

      {isOpen && (
        <div className="pb-4 pl-12">
          {isLoading && <Spinner label="Mashqlar" />}
          {missions && missions.length === 0 && (
            <Card>
              <p className="text-support">Bu kun uchun mashqlar tayyorlanmoqda.</p>
            </Card>
          )}
          {missions && missions.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2">
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

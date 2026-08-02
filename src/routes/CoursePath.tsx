import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { phaseLabelUz } from '../lib/format'
import type { CourseDayView, EntitlementView, MissionSummary, ProgressView } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { Badge, Button, Card, LinkButton, SectionHeading, Spinner } from '../components/ui'

/**
 * Why a day is shut. Only `pro` can be bought out of — a `progress` lock opens by working
 * through the earlier days, so offering Pro there would sell something that does not help.
 */
type LockedDay = { kind: 'pro' | 'progress'; day: number }

export function CoursePath() {
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [locked, setLocked] = useState<LockedDay | null>(null)

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
  const maxUnlockedDay = entitlement?.maxUnlockedDay ?? 1

  const phases = [
    { phase: 'Foundation' as const, range: '1-30' },
    { phase: 'Bridge' as const, range: '31-60' },
    { phase: 'Immersion' as const, range: '61-90' },
  ]

  function handleToggle(day: CourseDayView) {
    if (!day.isUnlocked) {
      setLocked({ kind: day.day > maxUnlockedDay ? 'pro' : 'progress', day: day.day })
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
                  maxUnlockedDay={maxUnlockedDay}
                  onToggle={() => handleToggle(day)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {locked && <LockedDayDialog locked={locked} onDismiss={() => setLocked(null)} />}
    </div>
  )
}

/**
 * A shut day, and the one thing that opens it. The Pro case leads with buying, because that
 * is the actual next step — an "understood" button was a dead end at the exact moment the
 * learner reached for more of the course.
 */
function LockedDayDialog({ locked, onDismiss }: { locked: LockedDay; onDismiss: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  const isPro = locked.kind === 'pro'

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4"
      onClick={onDismiss}
    >
      <Card
        className="w-full max-w-md"
        // The backdrop closes; the card itself must not.
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-day-title"
      >
        <h2 id="locked-day-title" className="text-lg font-semibold text-ink">
          {isPro ? `${locked.day}-kun Pro tarkibida` : 'Bu kun hali yopiq'}
        </h2>

        <p className="text-support mt-2">
          {isPro
            ? "Bepul rejada birinchi 7 kun ochiq. Qolgan 83 kunni va mashq kutubxonasini Pro ochadi."
            : `Avval oldingi kunlarni yakunlang — shundan keyin ${locked.day}-kun o'zi ochiladi.`}
        </p>

        {isPro ? (
          <>
            <LinkButton to="/paywall" block className="mt-5">
              Pro sotib olish
            </LinkButton>
            <Button variant="ghost" block className="mt-2" onClick={onDismiss}>
              Keyinroq
            </Button>
          </>
        ) : (
          <Button className="mt-5" onClick={onDismiss}>
            Tushunarli
          </Button>
        )}
      </Card>
    </div>
  )
}

function DayRow({
  day,
  isOpen,
  maxUnlockedDay,
  onToggle,
}: {
  day: CourseDayView
  isOpen: boolean
  maxUnlockedDay: number
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
        {!day.isUnlocked && !isDone && (
          <Badge tone="caution">{day.day > maxUnlockedDay ? 'Pro kerak' : 'Yopiq'}</Badge>
        )}
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

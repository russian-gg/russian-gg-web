import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { phaseLabelUz } from '../lib/format'
import type { HomeView } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { Badge, EmptyState, LinkButton, SectionHeading, Spinner } from '../components/ui'

/**
 * One next best action, and what it leads to. Deliberately not a dashboard of unrelated
 * cards (PRD §6) — the numbers live on the progress screen.
 */
export function Home() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['home'],
    queryFn: () => api.get<HomeView>('/course/home'),
  })

  if (isLoading) return <Spinner />
  if (isError || !data) {
    return (
      <EmptyState
        title="Ma’lumotni yuklab bo’lmadi"
        body="Internetni tekshirib, sahifani yangilang."
      />
    )
  }

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="signal">{data.currentDay}-kun / 90</Badge>
          <Badge>{phaseLabelUz[data.phase]}</Badge>
          {data.streakDays > 1 && <Badge tone="milestone">{data.streakDays} kun ketma-ket</Badge>}
          {data.tier === 'Free' && <Badge tone="caution">Bepul</Badge>}
        </div>

        <h1 className="mt-4 text-2xl font-semibold leading-snug tracking-tight text-ink">
          {data.dayFocusUz || 'Bugungi mashq'}
        </h1>
      </header>

      <section>
        <SectionHeading>Bugungi ovozli mashq</SectionHeading>
        {data.todayMission ? (
          <>
            <MissionCard mission={data.todayMission} />
            {!data.todayMission.isLocked && (
              <LinkButton to={`/missions/${data.todayMission.id}`} block className="mt-3">
                Mashqni boshlash
              </LinkButton>
            )}
          </>
        ) : (
          <EmptyState
            title="Bugunga mashq topilmadi"
            body="90 kunlik yo’ldan boshqa mashqni tanlang yoki mashq kutubxonasiga o’ting."
            action={<LinkButton to="/path">90 kunlik yo’l</LinkButton>}
          />
        )}
      </section>

      {/*
        One section, deliberately. Progress numbers, the milestone preview, repair suggestions
        and the practice shelf all have their own screens; stacked here they turned the one
        thing the learner came to do into a fifth of the page (PRD §6).
      */}
    </div>
  )
}

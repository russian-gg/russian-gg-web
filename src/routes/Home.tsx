import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { fill, useT } from '../lib/i18n'
import { missionPath } from '../lib/mission-path'
import type { HomeView } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { Badge, EmptyState, LinkButton, SectionHeading, Spinner } from '../components/ui'

/**
 * One next best action, and what it leads to. Deliberately not a dashboard of unrelated
 * cards (PRD §6) — the numbers live on the progress screen.
 */
export function Home() {
  const t = useT()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['home'],
    queryFn: () => api.get<HomeView>('/course/home'),
    // This card is the learner's next action. After finishing a lesson it must always reflect
    // the server's newest "today mission", not a still-fresh cache entry from the route they
    // just left.
    refetchOnMount: 'always',
  })

  if (isLoading) return <Spinner />
  if (isError || !data) {
    return (
      <EmptyState
        title={t.common.loadFailed}
        body={t.common.loadFailedBody}
      />
    )
  }

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="signal">{fill(t.common.dayOfTotal, { day: data.currentDay, total: 90 })}</Badge>
          <Badge>{t.labels.phase[data.phase]}</Badge>
          {data.streakDays > 1 && <Badge tone="milestone">{fill(t.home.streak, { count: data.streakDays })}</Badge>}
          {data.tier === 'Free' && <Badge tone="caution">{t.account.plan.free}</Badge>}
        </div>

        <h1 className="mt-4 text-2xl font-extrabold leading-snug tracking-tight text-ink">
          {data.dayFocusUz || t.home.fallbackTitle}
        </h1>
      </header>

      <section>
        <SectionHeading>{t.home.todayMission}</SectionHeading>
        {data.todayMission ? (
          <>
            <MissionCard mission={data.todayMission} />
            {!data.todayMission.isLocked && (
              <LinkButton to={missionPath(data.todayMission)} block className="mt-3">
                {t.home.start}
              </LinkButton>
            )}
          </>
        ) : (
          <EmptyState
            title={t.home.empty}
            body={t.home.emptyBody}
            action={<LinkButton to="/path">{t.nav.path}</LinkButton>}
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

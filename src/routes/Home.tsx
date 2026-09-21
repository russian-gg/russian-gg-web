import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { fill, useT } from '../lib/i18n'
import type { HomeView } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { HeroBanner } from '../components/home/HeroBanner'
import { DashboardSearch } from '../components/home/DashboardSearch'
import { FeatureTiles, RecommendedLessons } from '../components/home/HomeSections'
import {
  AchievementsPanel,
  ProgressRing,
  QuoteCard,
  RecentActivity,
} from '../components/home/HomeSidePanels'
import { missionPath } from '../lib/mission-path'
import { Badge, EmptyState, LinkButton, SectionHeading, Spinner } from '../components/ui'

/**
 * The home screen.
 *
 * One next action, and then evidence. The banner and the lesson card under it are the same
 * door offered twice, and everything below and beside them is the answer to "how am I doing" —
 * deliberately in that order, and deliberately in a column the learner has to choose to read.
 * The rail on the right only exists from `xl`; on anything narrower it falls in underneath, so
 * a phone still opens on the lesson rather than on a scoreboard.
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

  /*
    Where the banner's one door leads. The mission card below opens the same place, which is
    the point — there is a single next action on this screen, offered twice: once as the thing
    you came for, once as the thing you are about to do.
  */
  const startPath = data.todayMission ? missionPath(data.todayMission) : '/path'

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <DashboardSearch />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
        {/* The column the learner came for. */}
        <div className="min-w-0 space-y-6">
          <HeroBanner to={startPath} />

          {/*
            The day, the phase, the streak and the plan. They used to sit inside a card with the
            mission title, and they are kept here rather than moved into the banner: a hero with
            four status chips in it is a dashboard header again, and these read perfectly well as
            a quiet line underneath one.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal">{fill(t.common.dayOfTotal, { day: data.currentDay, total: 90 })}</Badge>
            <Badge>{t.labels.phase[data.phase]}</Badge>
            {data.streakDays > 1 && <Badge tone="milestone">{fill(t.home.streak, { count: data.streakDays })}</Badge>}
            {data.tier === 'Free' && <Badge tone="caution">{t.account.plan.free}</Badge>}
          </div>

          <section>
            <SectionHeading
              action={
                <Link to="/path" className="text-sm font-bold text-signal-ink">
                  {t.home.seeAll}
                </Link>
              }
            >
              {t.home.todayMission}
            </SectionHeading>
            {data.todayMission ? (
              <MissionCard mission={data.todayMission} featured />
            ) : (
              <EmptyState
                title={t.home.empty}
                body={t.home.emptyBody}
                action={<LinkButton to="/path">{t.nav.path}</LinkButton>}
              />
            )}
          </section>

          <section>
            <SectionHeading>{t.home.features.title}</SectionHeading>
            <p className="text-support -mt-1 mb-3 text-sm">{t.home.features.subtitle}</p>
            <FeatureTiles />
          </section>

          {/*
            Pro-only, and absent rather than teased when the plan does not include it: the
            server sends an empty list for a Free learner, and a heading over nothing is worse
            than no heading at all.
          */}
          {data.practiceForToday.length > 0 && (
            <section>
              <SectionHeading
                action={
                  <Link to="/practice" className="text-sm font-bold text-signal-ink">
                    {t.home.seeAll}
                  </Link>
                }
              >
                {t.home.recommended.title}
              </SectionHeading>
              <RecommendedLessons missions={data.practiceForToday} />
            </section>
          )}
        </div>

        {/* Evidence, not instructions. */}
        <aside className="min-w-0 space-y-6">
          <QuoteCard />
          <ProgressRing currentDay={data.currentDay} />
          <AchievementsPanel />
          <RecentActivity />
        </aside>
      </div>
    </div>
  )
}

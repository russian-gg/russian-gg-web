import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { pickContent } from '../lib/content'
import { fill, useLocale, useT } from '../lib/i18n'
import type { HomeView } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { LearningActivity } from '../components/LearningActivity'
import { Badge, EmptyState, LinkButton, SectionHeading, Spinner } from '../components/ui'

/**
 * One next best action, and what it leads to. Deliberately not a dashboard of unrelated
 * cards (PRD §6) — the numbers live on the progress screen.
 */
export function Home() {
  const t = useT()
  const { locale } = useLocale()
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

  const title = data.todayMission
    ? pickContent(locale, {
        uz: data.todayMission.titleUz,
        ru: data.todayMission.titleRu,
        en: data.todayMission.titleEn,
      })
    : data.dayFocusUz || t.home.fallbackTitle

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="rounded-[var(--radius-card)] border border-hairline bg-ground-raised px-6 py-6 shadow-[0_8px_28px_rgb(22_24_29/0.04)] sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="signal">{fill(t.common.dayOfTotal, { day: data.currentDay, total: 90 })}</Badge>
          <Badge>{t.labels.phase[data.phase]}</Badge>
          {data.streakDays > 1 && <Badge tone="milestone">{fill(t.home.streak, { count: data.streakDays })}</Badge>}
          {data.tier === 'Free' && <Badge tone="caution">{t.account.plan.free}</Badge>}
        </div>

        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink">
          {title}
        </h1>
      </header>

      <section>
        <SectionHeading>{t.home.todayMission}</SectionHeading>
        {data.todayMission ? (
          <MissionCard mission={data.todayMission} featured />
        ) : (
          <EmptyState
            title={t.home.empty}
            body={t.home.emptyBody}
            action={<LinkButton to="/path">{t.nav.path}</LinkButton>}
          />
        )}
        <LearningActivity />
      </section>

      {/*
        One section, deliberately. Progress numbers, the milestone preview, repair suggestions
        and the practice shelf all have their own screens; stacked here they turned the one
        thing the learner came to do into a fifth of the page (PRD §6).
      */}
    </div>
  )
}

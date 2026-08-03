import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { phaseLabelUz } from '../lib/format'
import type { HomeView } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { Badge, Card, EmptyState, LinkButton, SectionHeading, Spinner, UzHint } from '../components/ui'

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
        No progress block here. This screen answers "what do I do today"; the numbers have
        their own screen, and repeating them under the one action they should be taking was
        the second thing competing for attention (PRD §6).
      */}
      {data.nextMilestone && (
        <section>
          <SectionHeading>Keyingi bosqich</SectionHeading>
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="signal">{data.nextMilestone.day}-kun</Badge>
              <Badge>
                {data.nextMilestone.daysRemaining === 0
                  ? 'Bugun'
                  : `${data.nextMilestone.daysRemaining} kun qoldi`}
              </Badge>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-ink">{data.nextMilestone.titleUz}</h3>
            <UzHint>{data.nextMilestone.outcomeUz}</UzHint>
          </Card>
        </section>
      )}

      {data.repairs.length > 0 && (
        <section>
          <SectionHeading>Mustahkamlash kerak</SectionHeading>
          <div className="space-y-3">
            {data.repairs.map((repair) => (
              <Card key={repair.id} as="article">
                <p className="text-base text-ink">{repair.reasonUz}</p>
                {repair.missionId && repair.missionTitleUz && (
                  <Link
                    to={`/missions/${repair.missionId}`}
                    className="mt-3 inline-block text-sm font-semibold text-signal-ink"
                  >
                    {repair.missionTitleUz} →
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          action={<Link to="/practice" className="text-sm font-semibold text-signal-ink">Barchasi</Link>}
        >
          Bugun mashq qilish
        </SectionHeading>

        {data.practiceForToday.length > 0 ? (
          <div className="space-y-3">
            {data.practiceForToday.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Mashq kutubxonasi Pro tarkibida"
            body="Shoshilinch vaziyat uchun qisqa mashqlar — ish suhbati, shikoyat, telefon suhbati."
            action={<LinkButton to="/paywall">Pro haqida</LinkButton>}
          />
        )}
      </section>
    </div>
  )
}

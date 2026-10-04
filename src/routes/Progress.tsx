import type { ReactNode } from 'react'
import type { Variants } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  Quote,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'
import { fill, useT } from '../lib/i18n'
import type { ProgressView, SkillArea } from '../lib/types'
import targetArt from '../assets/images/progress_main_card_2.webp'
import streakArt from '../assets/images/progress_icon_1.webp'
import overallArt from '../assets/images/progress_icon_2.webp'
import missionsArt from '../assets/images/progress_icon_3.webp'
import levelArt from '../assets/images/progress_icon_4.webp'
import { ConfidenceTrend, MilestoneTimeline, SkillRow } from '../components/Progress'
import { Badge, Card, QueryError, Spinner, UzHint } from '../components/ui'
import { CountUp, Meter, Reveal, Sequence, SequenceInView } from '../components/motion'
import { fadeIn, pop, rise, spring, stagger } from '../lib/motion'

const SKILLS: SkillArea[] = ['Listening', 'Speaking', 'Pronunciation', 'Vocabulary', 'Grammar']
const COURSE_DAYS = 90

// The page is two columns from the header down: the header's tip cards and the panels below
// them share the right one, so their edges line up.
const COLUMNS = 'xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]'

// The tip cards belong to the right edge, so that is where they come from.
const fromRight = fadeIn('right', 16)

// The illustration lands rather than fades: it is the one object on the card, and it arrives
// on the same spring the product's other physical things settle on.
const artLanding: Variants = {
  hidden: { opacity: 0, scale: 0.82, x: 18 },
  shown: { opacity: 1, scale: 1, x: 0, transition: { ...spring, duration: 0.7 } },
}

export function Progress() {
  const t = useT()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
  })

  if (isLoading) return <Spinner />
  if (isError || !data) return <QueryError onRetry={() => void refetch()} />

  const day = Math.min(data.currentDay, COURSE_DAYS)
  const percent = Math.round((day / COURSE_DAYS) * 100)
  const steady = data.streakDays > 1

  return (
    <Sequence className="space-y-6" gap={stagger.base}>
      <Reveal as="section" className={`grid items-end gap-x-6 gap-y-4 ${COLUMNS}`}>
        <div>
          {/*
            The standing chips pop in rather than fading up, and they do it one after another.
            This is the screen a learner opens to be told how they are doing, and these are the
            facts it opens with - the day and the phase. A badge is a small, emphatic thing, so
            it gets the small, emphatic entrance.
          */}
          <Sequence className="flex flex-wrap items-center gap-2" gap={stagger.wide}>
            <Reveal as="span" variants={pop}>
              <Badge tone="signal">{fill(t.common.dayOfTotal, { day: data.currentDay, total: COURSE_DAYS })}</Badge>
            </Reveal>
            <Reveal as="span" variants={pop}>
              <Badge>{t.labels.phase[data.phase]}</Badge>
            </Reveal>
          </Sequence>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">{t.progress.title}</h1>
          <p className="mt-1 text-base text-ink-muted">{t.progress.subtitle}</p>
        </div>

        {/*
          Two standing reminders, on the same column as the panels under them, so the pair is
          exactly as wide as the skills card it sits above. Decoration, so on a phone they give
          way first.
        */}
        <Sequence className="hidden grid-cols-2 gap-3 md:grid" gap={stagger.wide} delay={0.12}>
          <Reveal variants={fromRight}>
            <Tip icon={GraduationCap} title={t.progress.tipLearnTitle} body={t.progress.tipLearnBody} />
          </Reveal>
          <Reveal variants={fromRight}>
            <Tip icon={BarChart3} title={t.progress.tipAnalyzeTitle} body={t.progress.tipAnalyzeBody} />
          </Reveal>
        </Sequence>
      </Reveal>

      <div className={`grid items-start gap-6 ${COLUMNS}`}>
        <div className="space-y-6">
          <Reveal variants={rise}>
            <Card className="relative overflow-hidden">
              {/*
                The card lands first and then says its piece in reading order: the label, the
                number counting up to today, the bar filling to the same place, the note. The
                picture and its caption come last, because they comment on the number rather
                than state it.
              */}
              <Sequence gap={stagger.wide} delay={0.1}>
              <div className="relative sm:max-w-[62%]">
                <Reveal>
                  <h2 className="text-sm font-bold text-ink-muted">{t.progress.overall}</h2>
                </Reveal>
                <Reveal>
                  <p className="mt-2 flex items-baseline gap-2 text-ink">
                    <span className="text-5xl leading-none font-extrabold tracking-tight tabular-nums">
                      <CountUp value={day} /> / {COURSE_DAYS}
                    </span>
                    <span className="text-xl font-bold text-ink-muted">{t.path.hero.dayUnit}</span>
                  </p>
                </Reveal>

                <Reveal className="mt-5 flex items-center gap-3">
                  <Meter
                    value={day}
                    max={COURSE_DAYS}
                    label={t.progress.overall}
                    delay={0.25}
                    className="h-3 flex-1 overflow-hidden rounded-full bg-ground-sunken"
                    fillClassName="min-w-3 rounded-full bg-signal"
                  />
                  <span className="text-sm font-extrabold text-ink tabular-nums">
                    <CountUp value={percent} />%
                  </span>
                </Reveal>

                {/*
                  Praise only for what happened. A streak is something the learner did, so it
                  is named; without one the card says how the course works instead of
                  congratulating a result that is not there.
                */}
                <Reveal className="mt-5 flex items-center gap-3 rounded-2xl bg-milestone-soft/60 px-4 py-3">
                  <TrendingUp aria-hidden="true" strokeWidth={2.2} className="size-6 shrink-0 text-milestone" />
                  <div>
                    <p className="text-sm font-extrabold text-ink">
                      {steady ? t.progress.steadyTitle : t.progress.startTitle}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {steady ? fill(t.progress.steadyBody, { count: data.streakDays }) : t.progress.startBody}
                    </p>
                  </div>
                </Reveal>
              </div>

              {/*
                Two layers, because two things move it: the wrapper places it and lands it, and
                the image inside drifts. One element cannot do both — the landing and the drift
                are both transforms, and whichever ran second would overwrite the first.
              */}
              <Reveal
                variants={artLanding}
                className="pointer-events-none absolute top-1/2 right-3 hidden h-[86%] max-w-[36%] -translate-y-1/2 sm:block"
              >
                <img
                  src={targetArt}
                  alt=""
                  width={560}
                  height={427}
                  decoding="async"
                  className="h-full w-auto animate-[gameBob_5s_ease-in-out_infinite] object-contain select-none"
                />
              </Reveal>
              <Reveal variants={pop} className="absolute right-5 bottom-5 hidden max-w-36 md:block">
                <p className="rounded-2xl bg-ground-raised/95 px-3.5 py-2.5 text-center text-xs leading-snug font-bold text-ink shadow-[0_8px_24px_rgb(22_24_29/0.10)]">
                  {t.progress.artCaption}
                </p>
              </Reveal>
              </Sequence>
            </Card>
          </Reveal>

          <Reveal as="section">
            <PanelHeading icon={BookOpen}>{t.progress.milestones}</PanelHeading>
            <MilestoneTimeline milestones={data.milestones} nextHref="/path" nextLabel={t.progress.openPath} />
          </Reveal>
        </div>

        <div className="space-y-6">
          <Reveal>
            <Card>
              <PanelHeading icon={BarChart3}>{t.progress.skills}</PanelHeading>
              {/*
                Five skill rows, on the tight beat. They are a table, not five separate claims -
                the learner reads down them to compare, and a wide stagger would make the
                comparison wait for the animation to finish.
              */}
              <SequenceInView gap={stagger.tight}>
                {SKILLS.map((skill) => (
                  <Reveal key={skill}>
                    <SkillRow skill={skill} value={data.skills[skill]} delta={data.skillDeltas30d[skill]} />
                  </Reveal>
                ))}
              </SequenceInView>
            </Card>
          </Reveal>

          <Reveal>
            <Card>
              <PanelHeading icon={Trophy} tone="caution">{t.progress.achievements}</PanelHeading>
              <SequenceInView className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4" gap={stagger.wide}>
                <Achievement
                  art={streakArt}
                  tint="#3d9bf7"
                  value={<CountUp value={data.streakDays} />}
                  label={t.progress.streakLabel}
                  note={steady ? t.progress.streakGood : t.progress.streakStart}
                />
                <Achievement
                  art={overallArt}
                  tint="#1fcdb4"
                  value={<><CountUp value={percent} />%</>}
                  label={t.progress.overall}
                  note={fill(t.progress.overallNote, { total: COURSE_DAYS })}
                />
                <Achievement
                  art={missionsArt}
                  tint="#ffa914"
                  value={<CountUp value={data.totalMissionsCompleted} />}
                  label={t.progress.missionsLabel}
                  note={fill(t.progress.missionsNote, { count: data.totalMissionsCompleted })}
                />
                <Achievement
                  art={levelArt}
                  tint="#8a4cf6"
                  value={data.speakingLevel}
                  label={t.progress.levelLabel}
                  note={t.labels.level[data.speakingLevel]}
                />
              </SequenceInView>
            </Card>
          </Reveal>

          <Reveal>
            <Card className="flex items-center gap-4">
              <Reveal as="span" variants={pop} className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-milestone-soft text-milestone">
                <Quote aria-hidden="true" strokeWidth={2.2} className="size-6" />
              </Reveal>
              <p className="text-sm leading-relaxed text-ink">“{t.progress.quote}”</p>
            </Card>
          </Reveal>

          <Reveal>
            <Card>
              <ConfidenceTrend value={data.confidenceIndex} delta={data.confidenceDelta30d} />

              <div className="mt-5 flex flex-wrap gap-8 border-t border-hairline pt-5">
                <LevelFigure label={t.progress.comprehension} level={data.comprehensionLevel} name={t.labels.level[data.comprehensionLevel]} />
                <LevelFigure label={t.progress.speaking} level={data.speakingLevel} name={t.labels.level[data.speakingLevel]} />
              </div>

              {/* The estimate follows demonstrated ability; it is never a certificate (PRD §6). */}
              <UzHint>{t.progress.levelNote}</UzHint>
            </Card>
          </Reveal>

          {data.repairs.length > 0 && (
            <Reveal as="section">
              <PanelHeading icon={TrendingUp}>{t.progress.repairs}</PanelHeading>
              <Sequence className="space-y-3" gap={stagger.base}>
                {data.repairs.map((repair) => (
                  <Reveal key={repair.id}>
                    <Card as="article">
                      <p className="text-base text-ink">
                        {t.repairReasons[repair.gapCode as keyof typeof t.repairReasons] ?? t.repairReasons.fallback}
                      </p>
                      <p className="text-support mt-1">
                        {fill(t.progress.repairEvidence, { count: repair.evidenceCount })}
                      </p>
                      {repair.missionId && repair.missionTitleUz && (
                        <Link
                          to={`/missions/${repair.missionId}`}
                          className="mt-3 inline-block text-sm font-semibold text-signal-ink"
                        >
                          {repair.missionTitleUz} →
                        </Link>
                      )}
                    </Card>
                  </Reveal>
                ))}
              </Sequence>
            </Reveal>
          )}
        </div>
      </div>
    </Sequence>
  )
}

/** A section title with its mark, the way every panel on this screen opens. */
function PanelHeading({
  icon: Icon,
  tone = 'signal',
  children,
}: {
  icon: LucideIcon
  tone?: 'signal' | 'caution'
  children: ReactNode
}) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-lg font-extrabold text-ink">
      <Reveal
        as="span"
        variants={pop}
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
          tone === 'caution' ? 'bg-caution-soft text-caution' : 'bg-signal-soft text-signal-ink'
        }`}
      >
        <Icon aria-hidden="true" strokeWidth={1.9} className="size-5" />
      </Reveal>
      {children}
    </h2>
  )
}

function Tip({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex h-full min-w-0 items-center gap-3 rounded-2xl border border-hairline bg-ground-raised px-4 py-3 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-signal/40 shadow-[0_8px_24px_rgb(22_24_29/0.035)]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal-ink">
        <Icon aria-hidden="true" strokeWidth={1.8} className="size-5" />
      </span>
      <p className="text-xs leading-snug text-ink-muted">
        <span className="block text-sm font-bold text-ink">{title}</span>
        {body}
      </p>
    </div>
  )
}

/**
 * One standing figure, under its own badge. The tint behind it is passed in rather than taken
 * from the theme, and matches the badge: the four tiles are told apart by colour, and the theme
 * has only one accent to give.
 */
function Achievement({
  art,
  tint,
  value,
  label,
  note,
}: {
  art: string
  tint: string
  value: ReactNode
  label: string
  note: string
}) {
  return (
    <Reveal variants={rise} className="h-full">
    <div
      className="group flex h-full flex-col items-center rounded-2xl px-2 py-4 text-center transition-transform duration-200 hover:-translate-y-1"
      style={{ backgroundColor: `color-mix(in srgb, ${tint} 10%, transparent)` }}
    >
      {/* The badge pops as its tile lands, and tips toward the pointer: it is a medal. */}
      <Reveal as="span" variants={pop} className="block">
        <img
          src={art}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          className="size-14 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
        />
      </Reveal>
      <p className="mt-2.5 text-2xl leading-none font-extrabold text-ink tabular-nums">{value}</p>
      <p className="mt-2 text-xs font-extrabold text-ink">{label}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{note}</p>
    </div>
    </Reveal>
  )
}

function LevelFigure({ label, level, name }: { label: string; level: string; name: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{level}</p>
      <p className="text-support">{name}</p>
    </div>
  )
}

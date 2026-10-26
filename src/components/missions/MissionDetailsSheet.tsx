import { useEffect, useState, type Ref } from 'react'
import { AnimatePresence, type Variants } from 'motion/react'
import * as m from 'motion/react-m'
import { useNavigate } from 'react-router-dom'
import { Check, Lock, Play, RotateCcw, Timer, X } from 'lucide-react'
import { pickContent } from '../../lib/content'
import { cx } from '../../lib/cx'
import { fill, useLocale, useT } from '../../lib/i18n'
import { MISSION_IMAGE_SIZE, missionImage } from '../../lib/mission-images'
import { missionLockText } from '../../lib/mission-lock'
import { missionPath } from '../../lib/mission-path'
import { duration, ease, fade, springSoft } from '../../lib/motion'
import { Reveal } from '../motion'
import { PreviewFact } from '../PreviewDialog'
import { Badge, Button, LinkButton } from '../ui'
import { missionStatusLabel, type MissionRow } from './mission-row'
import { ZoneScene } from './ZoneScene'
import { missionIcon, zoneOf } from './zones'

/**
 * The chosen mission, read before it is started: where it happens, what to get done, how long
 * it runs and how it is scored, and the one thing to do next.
 *
 * It rises from the bottom of the page when a mission is chosen, and it is part of the page
 * rather than a dialog over it: sticky to the bottom edge while the road scrolls behind it, and
 * resting under the road once the learner reaches the end. Nothing is dimmed or trapped — the
 * road stays usable, and choosing another mission swaps what the panel says in place.
 *
 * Everything shown is the mission's own data. The button goes where the shelf's cards always
 * went — `missionPath`, which opens the mission's brief (and from there the live conversation)
 * or its lesson — so nothing about how a mission starts, resumes or is repeated changes here.
 * A locked mission has nothing to start: its button leads to what unlocks it.
 *
 * `row` outlives `open` on purpose: the caller keeps the last mission while the panel plays its
 * exit, so it does not empty out on its way off the screen.
 */
export function MissionDetailsSheet({
  row,
  open,
  showFreeLabel,
  onDismiss,
  ref,
}: {
  row: MissionRow | undefined
  open: boolean
  showFreeLabel: boolean
  onDismiss: () => void
  ref?: Ref<HTMLElement>
}) {
  const t = useT()

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onDismiss])

  return (
    <AnimatePresence initial={false}>
      {open && row && (
        <m.section
          key="mission-details"
          ref={ref}
          id="mission-details"
          aria-labelledby="mission-details-title"
          variants={rising}
          initial="hidden"
          animate="shown"
          exit="exit"
          className={cx(
            // Clears the phone's tab bar; from `md` up there is none. One layer above the
            // floating Telegram button, which would otherwise sit on the panel's action.
            'sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[45] md:bottom-6',
            'max-h-[min(56dvh,30rem)] overflow-y-auto md:max-h-[70dvh] rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-4 sm:p-5',
            'shadow-[0_-8px_40px_rgb(22_24_29/0.14)]',
          )}
        >
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.common.close}
            className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-ground-raised/90 text-ink-muted transition hover:bg-ground-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-signal"
          >
            <X aria-hidden="true" strokeWidth={1.9} className="size-5" />
          </button>
          {/* Keyed by mission, so a new choice arrives rather than the old text being swapped in place. */}
          <Reveal key={row.mission.id} variants={fade}>
            <Details row={row} showFreeLabel={showFreeLabel} />
          </Reveal>
        </m.section>
      )}
    </AnimatePresence>
  )
}

/** Up from below, on the spring the product's other surfaces settle on; down and away to close. */
const rising: Variants = {
  hidden: { opacity: 0, y: 56 },
  shown: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: 40, transition: { duration: duration.quick, ease: ease.exit } },
}

function Details({ row, showFreeLabel }: { row: MissionRow; showFreeLabel: boolean }) {
  const t = useT()
  const copy = t.practice
  const { locale } = useLocale()
  const navigate = useNavigate()
  const { mission, number, title, status, locked, isProLock } = row
  const best = mission.bestScore ?? null
  const objective = pickContent(locale, {
    uz: mission.objectiveUz,
    ru: mission.objectiveRu,
    en: mission.objectiveEn,
  })
  const needsRegisterNote =
    mission.category === 'StreetRussian' ||
    mission.formality === 'Informal' ||
    mission.formality === 'Slang' ||
    mission.workplaceUse !== 'Safe'

  // The situation it belongs to; the untagged missions are named by their category instead.
  const area = mission.topic !== 'Unset' ? t.labels.topic[mission.topic] : t.labels.category[mission.category]
  // What the learner will be able to say, from the mission's own target phrases. Written in
  // Uzbek in the content, whatever the interface language.
  const learning = mission.learningPointsUz.filter(Boolean).slice(0, 6)

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-6">
      <MissionIllustration key={mission.slug} mission={mission} title={title} />

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-10">
          <Badge tone="signal">{fill(copy.missionNumber, { number })}</Badge>
          <span className="text-xs font-bold text-ink-muted">{area}</span>
          <StatusBadge row={row} />
          {showFreeLabel && !locked && <Badge>{t.account.plan.free}</Badge>}
        </div>

        <h2 id="mission-details-title" className="mt-2.5 text-2xl leading-tight font-extrabold tracking-tight wrap-break-word text-ink">
          {title}
        </h2>

        {objective && (
          <div className="mt-3">
            <p className="text-[11px] font-black tracking-[.1em] text-ink-faint uppercase">{copy.scenarioLabel}</p>
            <p className="mt-1 text-[15px] leading-6 text-ink-muted">{objective}</p>
          </div>
        )}

        {learning.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-4">
            <p className="text-[11px] font-black tracking-[.1em] text-ink-faint uppercase">{copy.learnHeading}</p>
            <ul lang="uz" className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {learning.map((point) => (
                <li key={point} className="flex min-w-0 items-start gap-2 text-sm leading-5 text-ink">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-milestone-soft text-milestone">
                    <Check aria-hidden="true" strokeWidth={3} className="size-2.5" />
                  </span>
                  <span className="min-w-0 wrap-break-word">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-hairline pt-4 lg:grid-cols-4">
          <PreviewFact label={t.preview.time} value={fill(t.common.minutes, { count: mission.estimatedMinutes })} />
          {mission.passScore != null ? (
            <PreviewFact label={t.preview.passMark} value={fill(t.preview.passValue, { score: mission.passScore })} />
          ) : (
            mission.targetPhraseCount > 0 && (
              <PreviewFact
                label={t.preview.phrases}
                value={fill(t.preview.phrasesValue, { count: mission.targetPhraseCount })}
              />
            )
          )}
          <PreviewFact label={copy.levelLabel} value={mission.targetLevel} />
          <PreviewFact
            label={copy.bestLabel}
            value={best !== null ? `${best}%` : status === 'done' ? t.path.done : copy.notTried}
          />
        </div>

        {needsRegisterNote && (
          <div className="mt-3 rounded-2xl border border-caution/25 bg-caution-soft/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="caution">{t.labels.formality[mission.formality]}</Badge>
              <Badge tone={mission.workplaceUse === 'Safe' ? 'neutral' : 'caution'}>
                {t.labels.workplace[mission.workplaceUse]}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{t.preview.registerNote}</p>
          </div>
        )}

        {/* On a phone the sheet can outgrow the screen; the action stays pinned to its bottom edge. */}
        <div className="sticky -bottom-4 -mx-4 mt-auto flex flex-col gap-3 bg-ground-raised px-4 pt-4 pb-4 sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:p-0 sm:pt-4">
          {locked ? (
            <>
              <p className="text-sm font-semibold text-ink-muted sm:mr-auto">
                {missionLockText(mission, isProLock ? 'pro' : 'progress', t)}
              </p>
              <LinkButton to={isProLock ? '/paywall' : '/path'} variant="secondary" size="md" className="w-full sm:w-auto">
                <Lock aria-hidden="true" strokeWidth={2} className="size-4" />
                {isProLock ? t.path.buyPro : t.nav.path}
              </LinkButton>
            </>
          ) : (
            // A finished mission offers its repeat on the quieter button; the others lead
            // with the action.
            <Button
              variant={status === 'done' ? 'secondary' : 'primary'}
              size="lg"
              onClick={() => navigate(missionPath(mission))}
              data-ui-sound="select"
              className="w-full sm:w-auto"
            >
              {status === 'done' ? (
                <RotateCcw aria-hidden="true" strokeWidth={2.2} className="size-5" />
              ) : (
                <Play aria-hidden="true" strokeWidth={2.2} className="size-5 fill-current" />
              )}
              {status === 'done' ? copy.repeat : status === 'inProgress' ? copy.continue : copy.start}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ row }: { row: MissionRow }) {
  const t = useT()
  const label = missionStatusLabel(row, t)

  if (row.locked) {
    return (
      <Badge tone="caution">
        <Lock aria-hidden="true" strokeWidth={2.2} className="mr-1 size-3.5" />
        {label}
      </Badge>
    )
  }
  if (row.status === 'done') {
    return (
      <Badge tone="milestone">
        <Check aria-hidden="true" strokeWidth={2.6} className="mr-1 size-3.5" />
        {label}
      </Badge>
    )
  }
  if (row.status === 'inProgress') {
    return (
      <Badge tone="caution">
        <Timer aria-hidden="true" strokeWidth={2.2} className="mr-1 size-3.5" />
        {label}
      </Badge>
    )
  }
  return <Badge>{label}</Badge>
}

/**
 * The mission's picture, laid over a stand-in: a little street of the mission's part of town
 * with the mission's own marker on it. The stand-in is always drawn, and the picture fades in
 * over it once it has actually loaded — so a picture not delivered yet, or one that fails,
 * never shows as a broken image or an empty box, and nothing jumps when one arrives. Keyed by
 * slug at the call site, so a failure on one mission is not remembered for the next.
 */
function MissionIllustration({ mission, title }: { mission: MissionRow['mission']; title: string }) {
  const t = useT()
  const src = missionImage(mission.slug)
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const Icon = missionIcon(mission)

  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl bg-signal-soft md:aspect-[4/3]">
      <div aria-hidden="true">
        <ZoneScene zone={zoneOf(mission)} className="absolute inset-0 size-full" />
        <span className="absolute top-[16%] left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-ground-raised bg-signal text-on-signal shadow-[0_8px_24px_rgb(52_122_223/0.35)] md:top-[14%] md:size-20">
          <Icon strokeWidth={1.9} className="size-8 md:size-10" />
        </span>
      </div>

      {src && state !== 'failed' && (
        <img
          src={src}
          alt={state === 'loaded' ? fill(t.practice.illustrationAlt, { title }) : ''}
          width={MISSION_IMAGE_SIZE.width}
          height={MISSION_IMAGE_SIZE.height}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          className={cx(
            'absolute inset-0 size-full object-cover select-none motion-safe:transition-opacity motion-safe:duration-300',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}

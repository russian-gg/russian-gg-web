import { useEffect } from 'react'
import { BookOpen, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFocusTrap } from '../../lib/focus-trap'
import { fill, useT } from '../../lib/i18n'
import { Button, Card } from '../ui'
import { Overlay } from '../motion'

/** What the level test hands Home: the free conversation it picked for this learner. */
export type WelcomeStart = { missionId: string; missionTitle?: string | null }

/**
 * The first screen after the level test. It used to send the learner straight into a
 * conversation; now Home opens and asks where to begin — the day's lesson or the free live
 * conversation. Either one, once finished, is what opens the welcome gift.
 */
export function WelcomeStartDialog({
  start,
  lessonPath,
  day,
  onDismiss,
}: {
  start: WelcomeStart
  lessonPath: string
  day: number
  onDismiss: () => void
}) {
  const t = useT()
  const dialogRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  const choice =
    'flex items-start gap-3 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-4 text-left transition-colors hover:border-signal focus-visible:border-signal'

  return (
    <Overlay open onDismiss={onDismiss} backdropClassName="bg-black/40">
      <Card
        className="w-full max-w-md"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-start-title"
      >
        <h2 id="welcome-start-title" className="text-xl font-extrabold text-ink">
          {t.home.welcomeTitle}
        </h2>
        <p className="text-support mt-2">{t.home.welcomeBody}</p>

        <div className="mt-5 grid gap-3">
          <Link to={lessonPath} className={choice}>
            <BookOpen aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-signal-ink" />
            <span>
              <span className="block font-extrabold text-ink">{fill(t.home.welcomeLesson, { day })}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">{t.home.welcomeLessonHint}</span>
            </span>
          </Link>
          <Link to={`/missions/${start.missionId}`} className={choice}>
            <MessageCircle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-signal-ink" />
            <span>
              <span className="block font-extrabold text-ink">{t.home.welcomeMission}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">
                {start.missionTitle
                  ? fill(t.home.welcomeMissionHintNamed, { title: start.missionTitle })
                  : t.home.welcomeMissionHint}
              </span>
            </span>
          </Link>
        </div>

        <Button variant="ghost" block className="mt-3" onClick={onDismiss}>
          {t.common.later}
        </Button>
      </Card>
    </Overlay>
  )
}

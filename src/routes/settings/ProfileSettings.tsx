import { useState } from 'react'
import { BookOpen, Info, CalendarDays, Flame, LogOut, MessageCircle, Pencil, Target, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, RequestError } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { useT, type Dictionary } from '../../lib/i18n'
import type { ProgressView } from '../../lib/types'
import { useLocale, LOCALE_NAMES } from '../../lib/i18n'
import { Button, Card, ErrorNote, Field, QueryError, Spinner } from '../../components/ui'
import { InfoNote, LevelTile, SectionCard, StatTile } from './stats'

/**
 * Who the learner is, how far they have got, and the two account actions.
 *
 * One column, not two. The four blocks here are read in order — this is you, this is your
 * level, this is your position in the course, this is how you leave — and a two-column grid
 * put "delete my account" level with "your level", which is not a pairing anyone asked for.
 * The width is capped instead, so the cards stay a comfortable measure on a wide screen
 * without the layout inventing a second column to fill it.
 */
export function ProfileSettings() {
  const t = useT()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: progress, isLoading, isError, refetch } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  async function deleteAccount() {
    const confirmation = prompt(t.settings.deletePrompt)
    if (confirmation !== t.settings.deleteConfirmWord) return

    setBusy(true)
    try {
      await api.post('/auth/delete-account')
      await signOut()
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.settings.deleteFailed)
      setBusy(false)
    }
  }

  if (isLoading) return <Spinner />
  if (isError) return <QueryError onRetry={() => void refetch()} />

  return (
    /*
      One column of full-width cards.

      The page used to cap at `max-w-4xl` and — because that cap had no `mx-auto` — sat against
      the left edge of a 96rem shell with the rest of the screen empty beside it. The cap is
      gone; the cards now take the width they are given and the tiles inside spread across it,
      which is the shape the design calls for.

      Pairing the two measurement cards into columns was tried and reverted: with the 248px
      rail alongside, an `xl` viewport leaves each tile about 165px, and "BAJARILGAN MASHQLAR"
      needs 229px to stay on one line. Stacked, the same tiles get 300-400px at every desktop
      width.
    */
    <div className="space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}

      <ProfileHeader progress={progress} />

      <LanguageLevelCard progress={progress} t={t} />
      <CourseProgressCard progress={progress} t={t} />

      <Card className="py-0">
        <AccountActions
          busy={busy}
          onSignOut={() => void signOut().then(() => navigate('/'))}
          onDelete={() => void deleteAccount()}
        />
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------------- header */

/**
 * The account, as a card rather than a bare row.
 *
 * It used to float above the first section with no surface of its own, which on the light
 * grey page made it read as part of the page header rather than as the first item of the
 * list. Everything else on this screen is a white card; so is this.
 */
function ProfileHeader({ progress }: { progress?: ProgressView }) {
  const t = useT()
  const { locale } = useLocale()
  const { user, refreshUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name =
    user?.displayName?.trim() || user?.email?.split('@')[0] || user?.phoneNumber || t.account.learner
  const initials = name.trim().slice(0, 2).toUpperCase()

  /*
    The three facts under the name, and all three are already known: what this account is,
    where the two levels currently sit, and which language the interface is in. They are one
    line because none of them is worth a row of its own — together they are the answer to
    "is this the right account?".

    No avatar upload behind the initials. `UpdateProfileRequest` has no image field and there
    is no endpoint to put one, so a camera badge would be a button that cannot do anything.
  */
  const meta = [
    user?.role === 'Learner' ? t.account.learner : user?.role,
    progress ? `${progress.comprehensionLevel} → ${progress.speakingLevel}` : null,
    LOCALE_NAMES[locale],
  ].filter(Boolean)

  async function saveName() {
    const next = draft.trim()
    if (!next || next === name) {
      setEditing(false)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.patch('/auth/me', { displayName: next })
      await refreshUser()
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.settings.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-signal text-xl font-extrabold text-on-signal sm:size-20 sm:text-2xl"
        >
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold text-ink sm:text-2xl">{name}</p>
          <p className="text-support truncate text-sm">{user?.email ?? user?.phoneNumber}</p>
          <p className="text-support mt-1 truncate text-sm">{meta.join(' · ')}</p>
        </div>

        {!editing && (
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(user?.displayName?.trim() ?? '')
              setEditing(true)
            }}
          >
            <Pencil aria-hidden="true" strokeWidth={2} className="size-4" />
            {t.profile.editProfile}
          </Button>
        )}
      </div>

      {/*
        The only thing on this account a learner can actually change is the name — the level is
        measured, the email is the identity, and the language has its own control on the next
        tab. So the edit is one field inline rather than a dialog over a form of one input.
      */}
      {editing && (
        <div className="mt-5 border-t border-hairline pt-5">
          <Field
            label={t.profile.displayNameLabel}
            name="displayName"
            value={draft}
            autoFocus
            maxLength={60}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void saveName()
              if (event.key === 'Escape') setEditing(false)
            }}
            error={error ?? undefined}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void saveName()}>
              {t.profile.save}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

/* --------------------------------------------------------------------------- level */

function LanguageLevelCard({ progress, t }: { progress?: ProgressView; t: Dictionary }) {
  return (
    <SectionCard
      title={t.profile.level}
      aside={
        /*
          It goes to Progress, which is where the two levels are actually broken down over the
          ninety days. There is no levels explainer page to point at, and a link that only
          looked like one would be worse than no link — so this is the nearest real thing, and
          it is genuinely what somebody asking "what is my level?" wants next.
        */
        <Link
          to="/progress"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-signal-ink hover:underline"
        >
          <Info aria-hidden="true" strokeWidth={2} className="size-4" />
          {t.profile.aboutLevel}
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <LevelTile
          icon={BookOpen}
          label={t.progress.comprehension}
          level={progress?.comprehensionLevel}
          meaning={progress?.comprehensionLevel ? t.labels.level[progress.comprehensionLevel] : undefined}
        />
        <LevelTile
          icon={MessageCircle}
          label={t.progress.speaking}
          level={progress?.speakingLevel}
          meaning={progress?.speakingLevel ? t.labels.level[progress.speakingLevel] : undefined}
        />
      </div>
      <InfoNote>{t.profile.levelNote}</InfoNote>
    </SectionCard>
  )
}

/* ------------------------------------------------------------------------ position */

function CourseProgressCard({ progress, t }: { progress?: ProgressView; t: Dictionary }) {
  return (
    <SectionCard
      title={t.profile.coursePosition}
      aside={<span className="text-support text-sm">{t.profile.asOfToday}</span>}
    >
      {/*
        A plain grid, not the `<dl>` this used to be: a `dl` may only contain `dt`/`dd` pairs,
        and a tile is a box with a heading, a figure and a caption in it. The `dl` would have
        been valid-looking markup that no parser agrees with.
      */}
      {/*
        Three across only once there is room for three. The desktop rail takes 248px, so a
        768px tablet leaves this card 456px — three tiles there are 131px each, and the label
        alone needs 229px. It steps 1 → 2 → 3 instead, and every step lands above that.
      */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <StatTile
          icon={CalendarDays}
          label={t.profile.currentDay}
          value={progress ? `${progress.currentDay}/90` : null}
          hint={progress ? t.labels.phase[progress.phase] : undefined}
        />
        <StatTile
          icon={Target}
          label={t.profile.missionsDone}
          value={progress?.totalMissionsCompleted ?? null}
          hint={t.profile.totalMissions}
        />
        <StatTile
          icon={Flame}
          tone="coin"
          label={t.profile.streakDays}
          value={progress?.streakDays ?? null}
          hint={progress && progress.streakDays > 0 ? t.profile.keepGoing : undefined}
        />
      </div>
    </SectionCard>
  )
}

/* ------------------------------------------------------------------------- account */

/**
 * The two ways out, told apart.
 *
 * They were two buttons side by side in one row, which put a reversible action and an
 * irreversible one at the same weight and a thumb's width apart. Signing out sits on its own
 * line; deleting is separated by a rule, explained first, and only then offered.
 */
function AccountActions({
  busy,
  onSignOut,
  onDelete,
}: {
  busy: boolean
  onSignOut: () => void
  onDelete: () => void
}) {
  const t = useT()

  return (
    <div className="py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-extrabold tracking-tight text-ink">{t.settings.account}</p>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onSignOut}>
            <LogOut aria-hidden="true" strokeWidth={2} className="size-4" />
            {t.account.signOut}
          </Button>
          <Button variant="danger" disabled={busy} onClick={onDelete}>
            <Trash2 aria-hidden="true" strokeWidth={2} className="size-4" />
            {t.settings.deleteAccount}
          </Button>
        </div>
      </div>

      {/*
        The warning sits under both buttons rather than only beside the red one. It is the
        sentence that explains what "delete" costs, and somebody weighing the two needs it in
        view while they are weighing them, not after they have chosen.
      */}
      <p className="text-support mt-3 text-sm">{t.settings.deleteNote}</p>
    </div>
  )
}

import { lazy, Suspense, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { InstallPrompt } from './components/InstallPrompt'
import { LessonFeedbackGate } from './components/LessonFeedbackGate'
import { TelegramFloatingButton } from './components/TelegramFloatingButton'
import { WelcomeGiftGate } from './components/WelcomeGiftGate'
import { Button, EmptyState, Spinner } from './components/ui'
import { trackVisit } from './lib/api'
import { useAuth } from './lib/auth-context'
import { useT } from './lib/i18n'
import { needsPhone } from './lib/country'
import { playUiSound, type UiSound } from './lib/ui-sounds'
import { Home } from './routes/Home'

/**
 * `React.lazy` wants a module whose default export is the component, and nothing in this
 * codebase uses default exports. This adapts a named one rather than making twenty routes
 * each write the same `.then` by hand.
 */
function route<T extends Record<string, unknown>, K extends keyof T>(
  load: () => Promise<T>,
  name: K,
) {
  return lazy(() => load().then((module) => ({ default: module[name] as ComponentType })))
}

/*
  Every screen but the signed-in home is split out.

  The whole product used to arrive in one 964 KB chunk: somebody opening the marketing page
  downloaded both lesson players, the games, the paywall and 2,200 lines of lesson content
  before the first sentence painted, and this audience is on mobile data. Home is the
  exception because it is where a returning learner lands, and it is small.

  The content modules follow their screens automatically — `foundation-lessons.ts` is reached
  only from `FoundationLesson` and `MissionLive`, and `liveVoice.ts` only from the screens
  that actually open a microphone — so neither is in the entry chunk any more.
*/
const AdminContent = route(() => import('./routes/AdminContent'), 'AdminContent')
const CoursePath = route(() => import('./routes/CoursePath'), 'CoursePath')
const FeedbacksPage = route(() => import('./routes/FeedbacksPage'), 'FeedbacksPage')
const Landing = route(() => import('./routes/Landing'), 'Landing')
const FoundationLesson = route(() => import('./routes/FoundationLesson'), 'FoundationLesson')
const MissionEntry = route(() => import('./routes/MissionBrief'), 'MissionEntry')
const MissionLive = route(() => import('./routes/MissionLive'), 'MissionLive')
const MissionResult = route(() => import('./routes/MissionResult'), 'MissionResult')
const Onboarding = route(() => import('./routes/Onboarding'), 'Onboarding')
const Paywall = route(() => import('./routes/Paywall'), 'Paywall')
const BillingReturn = route(() => import('./routes/Paywall'), 'BillingReturn')
const Games = route(() => import('./routes/games/Games'), 'Games')
const GenderRunnerGame = route(() => import('./routes/games/GenderRunnerGame'), 'GenderRunnerGame')
const SawGame = route(() => import('./routes/games/SawGame'), 'SawGame')
const SpeakingGamePage = route(
  () => import('./routes/games/speaking/SpeakingGamePage'),
  'SpeakingGamePage',
)
const Practice = route(() => import('./routes/Practice'), 'Practice')
const Progress = route(() => import('./routes/Progress'), 'Progress')
const Settings = route(() => import('./routes/Settings'), 'Settings')
const SignIn = route(() => import('./routes/SignIn'), 'SignIn')
const SignUp = route(() => import('./routes/SignIn'), 'SignUp')
const ResetPasswordPage = route(() => import('./routes/SignIn'), 'ResetPasswordPage')
const LinkPhonePage = route(() => import('./routes/SignIn'), 'LinkPhonePage')

export function App() {
  useVisitBeacon()
  useGlobalUiSounds()

  return (
    <>
      {/*
        The boundary is inside the router and outside the route table, so the shell, the gates
        and the navigation survive a screen that throws — and `retry` re-renders that screen
        rather than reloading the document.

        One Suspense around the whole table rather than one per route: every fallback is the
        same spinner, and a chunk that is already cached resolves without ever showing it.
      */}
      <ErrorBoundary fallback={(retry) => <RouteFailure onRetry={retry} />}>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
            <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
            <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
            <Route path="/reset-password" element={<PublicOnly><ResetPasswordPage /></PublicOnly>} />

            {/*
              Outside the shell, because nothing should compete with the forty seconds, and public,
              because the microphone is this product's first taste — asking for a sign-up in front
              of it charges the highest price before showing any value.

              It does cost a live voice session every time it opens. That is held down on the
              server by a hard per-address limit rather than by a sign-up form here.
            */}
            <Route path="/onboarding" element={<Onboarding />} />

            {/*
              Mandatory phone linking for a signed-in learner who has no confirmed phone (the Google
              → phone migration). Full screen and outside the shell: it ends in a sign-out, so there
              is nothing to navigate to from here.
            */}
            <Route path="/link-phone" element={<RequireAuth><LinkPhonePage /></RequireAuth>} />


            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/home" element={<Home />} />
              <Route path="/path" element={<CoursePath />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/games" element={<Games />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/feedbacks" element={<FeedbacksPage />} />
              <Route path="/lessons/:day/:missionId" element={<FoundationLesson />} />
              {/* A converted mission shows its brief here; every other mission opens the player. */}
              <Route path="/missions/:missionId" element={<MissionEntry />} />
              <Route path="/missions/attempts/:attemptId/result" element={<MissionResult />} />
              <Route path="/paywall" element={<Paywall />} />
              <Route path="/billing/return" element={<BillingReturn />} />
              {/* Profile and billing are tabs of Settings now; the old address still works. */}
              <Route path="/profile" element={<Navigate to="/settings" replace />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/general" element={<Settings />} />
              <Route path="/settings/billing" element={<Settings />} />
              <Route path="/admin" element={<RequireStaff><AdminContent /></RequireStaff>} />
            </Route>

            {/* The conversation is full screen: nothing should compete with the character. */}
            <Route path="/missions/:missionId/live" element={<RequireAuth><MissionLive /></RequireAuth>} />

            {/* Full screen, outside the shell: a blade rolling at you should not share a page
                with navigation. */}
            <Route path="/games/arra" element={<RequireAuth><SawGame /></RequireAuth>} />
            <Route path="/games/rod-runner" element={<RequireAuth><GenderRunnerGame /></RequireAuth>} />
            <Route path="/games/:slug" element={<RequireAuth><SpeakingGamePage /></RequireAuth>} />

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>

      <WelcomeGiftGate />
      <LessonFeedbackGate />

      <TelegramFloatingButton />
      {/*
        Outside the routes on purpose. Somebody who lands on the marketing page and never signs
        in is exactly the person worth having the app on their phone, and offering it only
        after sign-in would ask the wrong half of the audience.
      */}
      <InstallPrompt />
    </>
  )
}

/**
 * Shown in place of a screen that threw while rendering. It is inside the router, so the
 * shell around it is still there and a learner can simply navigate away — which is usually
 * the fastest fix and is why this does not offer a page reload.
 */
function RouteFailure({ onRetry }: { onRetry: () => void }) {
  const t = useT()

  return (
    <div className="mx-auto max-w-lg py-12">
      <EmptyState
        title={t.common.loadFailed}
        body={t.common.loadFailedBody}
        action={<Button onClick={onRetry}>{t.common.retry}</Button>}
      />
    </div>
  )
}

function useGlobalUiSounds() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const source = event.target instanceof Element
        ? event.target.closest<HTMLElement>('button, a, [role="button"]')
        : null
      if (!source || source.matches(':disabled') || source.getAttribute('aria-disabled') === 'true') return
      const requested = source.dataset.uiSound as UiSound | 'none' | undefined
      if (requested === 'none') return
      playUiSound(requested ?? 'click')
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, isPendingOnboarding } = useAuth()
  const location = useLocation()

  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  // A learner still owing a verified phone links one before reaching anything else.
  if (needsPhone(user) && location.pathname !== '/link-phone') {
    return <Navigate to="/link-phone" replace />
  }
  if (isPendingOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/signup" replace state={{ clearPendingOnboarding: true }} />
  }

  return <>{children}</>
}

/**
 * A signed-in learner never sees the marketing or auth pages; they go straight to where
 * they left off, or to placement if they have not been placed.
 */
/**
 * Counts the page, signed in or not.
 *
 * Everything else this product measures starts at an account, which leaves the largest drop
 * in the funnel — people who arrived and never registered — invisible. This is the only thing
 * that sees them.
 */
function useVisitBeacon() {
  const location = useLocation()

  useEffect(() => {
    trackVisit(location.pathname)
  }, [location.pathname])
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, isLoading, isPendingOnboarding } = useAuth()

  if (isLoading) return <Spinner />
  if (isPendingOnboarding) return <>{children}</>
  if (user && !needsPhone(user)) {
    return <Navigate to={user.hasCompletedDiagnostic ? '/home' : '/onboarding'} replace />
  }

  return <>{children}</>
}

/**
 * Client-side role gating is for navigation only. The server authorises every admin call
 * independently, so hiding the route is convenience, not security (PRD §12).
 */
function RequireStaff({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const isStaff = user?.role === 'ContentEditor' || user?.role === 'Administrator'

  if (!isStaff) return <Navigate to="/home" replace />

  return <>{children}</>
}

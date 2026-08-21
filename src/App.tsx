import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { InstallPrompt } from './components/InstallPrompt'
import { TelegramFloatingButton } from './components/TelegramFloatingButton'
import { WelcomeGiftGate } from './components/WelcomeGiftGate'
import { Spinner } from './components/ui'
import { trackVisit } from './lib/api'
import { useAuth } from './lib/auth-context'
import { playUiSound, type UiSound } from './lib/ui-sounds'
import { AdminContent } from './routes/AdminContent'
import { CoursePath } from './routes/CoursePath'
import { FeedbacksPage } from './routes/FeedbacksPage'
import { Home } from './routes/Home'
import { Landing } from './routes/Landing'
import { FoundationLesson } from './routes/FoundationLesson'
import { MissionPlayer } from './routes/MissionPlayer'
import { MissionResult } from './routes/MissionResult'
import { Onboarding } from './routes/Onboarding'
import { BillingReturn, Paywall } from './routes/Paywall'
import { Games } from './routes/games/Games'
import { SawGame } from './routes/games/SawGame'
import { Practice } from './routes/Practice'
import { Progress } from './routes/Progress'
import { Settings } from './routes/Settings'
import { SignIn, SignUp } from './routes/SignIn'

export function App() {
  useVisitBeacon()
  useGlobalUiSounds()

  return (
    <>
      <Routes>
        <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />

        {/*
          Outside the shell, because nothing should compete with the forty seconds, and public,
          because the microphone is this product's first taste — asking for a sign-up in front
          of it charges the highest price before showing any value.

          It does cost a live voice session every time it opens. That is held down on the
          server by a hard per-address limit rather than by a sign-up form here.
        */}
        <Route path="/onboarding" element={<Onboarding />} />


        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/home" element={<Home />} />
          <Route path="/path" element={<CoursePath />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/games" element={<Games />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/feedbacks" element={<FeedbacksPage />} />
          <Route path="/lessons/:day/:missionId" element={<FoundationLesson />} />
          <Route path="/missions/:missionId" element={<MissionPlayer />} />
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

        {/* Full screen, outside the shell: a blade rolling at you should not share a page
            with navigation. */}
        <Route path="/games/arra" element={<RequireAuth><SawGame /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>

      <WelcomeGiftGate />

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
  if (user) return <Navigate to={user.hasCompletedDiagnostic ? '/home' : '/onboarding'} replace />

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

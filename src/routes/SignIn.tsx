import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import googleGIcon from '../assets/google-g-official.svg'
import { RequestError, track } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { onboardingDraft } from '../lib/onboardingDraft'
import { useT } from '../lib/i18n'
import {
  loadGoogleIdentityScript,
  renderGoogleButton,
  type GoogleCredentialResponse,
} from '../lib/google-auth'
import { Button, ErrorNote, Field } from '../components/ui'

const DEFAULT_GOOGLE_CLIENT_ID =
  '718388409500-ljra0b5j8j3dpubieljmd228gd1c55p3.apps.googleusercontent.com'

/**
 * Where to land after authenticating. A placement run taken while signed out outranks
 * everything: those answers are only held for this hop and must be spent immediately.
 */
function destinationAfterAuth(hasCompletedDiagnostic: boolean) {
  if (onboardingDraft.exists()) return '/onboarding'
  return hasCompletedDiagnostic ? '/home' : '/onboarding'
}

export function SignIn() {
  const t = useT()
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const user = await signIn(email, password)
      navigate(destinationAfterAuth(user.hasCompletedDiagnostic), { replace: true })
    } catch (caught) {
      setError(
        caught instanceof RequestError ? caught.message : t.auth.signInFailed,
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    if (!response.credential) {
      setError(t.auth.googleNoToken)
      return
    }

    setGoogleBusy(true)
    setError(null)

    try {
      const user = await signInWithGoogle(response.credential)
      navigate(destinationAfterAuth(user.hasCompletedDiagnostic), { replace: true })
    } catch (caught) {
      setError(
        caught instanceof RequestError
          ? caught.message
          : t.auth.googleFailed,
      )
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t.auth.signInTitle}
      footer={
        <>
          {t.auth.noAccount}{' '}
          <Link to="/signup" className="font-semibold text-signal-ink">
            {t.auth.goSignUp}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}

        <GoogleContinueButton
          busy={googleBusy}
          text="continue_with"
          onCredential={handleGoogleCredential}
        />

        <Divider />

        <Field
          label={t.auth.email}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          label={t.auth.password}
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((value) => !value)}
        />

        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? t.auth.signingIn : t.auth.signInAction}
        </Button>
      </form>
    </AuthLayout>
  )
}

export function SignUp() {
  const t = useT()
  const { abandonPendingOnboarding, isPendingOnboarding, signInWithGoogle, signUp } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const didClearPendingRef = useRef(false)

  useEffect(() => {
    if (didClearPendingRef.current) {
      return
    }

    if (isPendingOnboarding && location.state?.clearPendingOnboarding === true) {
      didClearPendingRef.current = true
      abandonPendingOnboarding()
      navigate('/signup', { replace: true })
    }
  }, [abandonPendingOnboarding, isPendingOnboarding, location.state, navigate])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await signUp(email, password, displayName || undefined)
      track('signup_completed')
      navigate('/onboarding')
    } catch (caught) {
      setError(
        caught instanceof RequestError
          ? caught.message
          : t.auth.signUpFailed,
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    if (!response.credential) {
      setError(t.auth.googleNoToken)
      return
    }

    setGoogleBusy(true)
    setError(null)

    try {
      const user = await signInWithGoogle(response.credential, displayName || undefined, {
        pendingOnboarding: true,
      })
      track('signup_completed')
      navigate(destinationAfterAuth(user.hasCompletedDiagnostic))
    } catch (caught) {
      setError(
        caught instanceof RequestError
          ? caught.message
          : t.auth.googleFailed,
      )
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t.auth.signUpTitle}
      footer={
        <>
          {t.auth.haveAccount}{' '}
          <Link to="/signin" className="font-semibold text-signal-ink">
            {t.auth.goSignIn}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}

        <GoogleContinueButton
          busy={googleBusy}
          text="signup_with"
          onCredential={handleGoogleCredential}
        />

        <Divider />

        <Field
          label={t.auth.displayName}
          name="displayName"
          autoComplete="given-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint={t.auth.displayNameHint}
        />

        <Field
          label={t.auth.email}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          label={t.auth.password}
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t.auth.passwordHint}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((value) => !value)}
        />

        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? t.auth.signingUp : t.auth.signUpAction}
        </Button>
      </form>
    </AuthLayout>
  )
}

function AuthLayout({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="text-sm font-medium text-ink-faint">
        ← russian.gg
      </Link>
      <h1 className="mb-7 mt-6 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      {children}
      <p className="text-support mt-6">{footer}</p>
    </div>
  )
}

function PasswordField({
  label,
  hint,
  showPassword,
  onTogglePassword,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  showPassword: boolean
  onTogglePassword: () => void
}) {
  const t = useT()
  const id = props.id ?? props.name ?? label

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <div className="relative">
        <input
          {...props}
          id={id}
          className="h-12 w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 pr-14 text-base text-ink placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute top-1/2 right-3 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
          aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
          aria-pressed={showPassword}
        >
          <EyeGlyph open={showPassword} />
        </button>
      </div>
      {hint && <span className="text-support mt-1 block">{hint}</span>}
    </label>
  )
}

function EyeGlyph({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-1.8">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-1.8">
      <path d="M3 4.5 20 19.5" />
      <path d="M10.6 6.2A11.6 11.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-4.1 4.5" />
      <path d="M6.7 8.1A17.2 17.2 0 0 0 2 12s3.5 6 10 6c1.4 0 2.6-.3 3.8-.7" />
      <path d="M9.9 9.9A3 3 0 0 0 14 14" />
    </svg>
  )
}

function GoogleContinueButton({
  busy,
  text,
  onCredential,
}: {
  busy: boolean
  text: 'continue_with' | 'signup_with'
  onCredential: (response: GoogleCredentialResponse) => void | Promise<void>
}) {
  const buttonRef = useRef<HTMLDivElement | null>(null)
  const onCredentialEvent = useEffectEvent(onCredential)
  const initializedRef = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const t = useT()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID
  const buttonLabel = text === 'signup_with' ? t.auth.googleSignUp : t.auth.googleContinue

  useEffect(() => {
    if (!clientId || !buttonRef.current || initializedRef.current) return

    let cancelled = false
    let probe: ReturnType<typeof setTimeout> | undefined

    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return
        initializedRef.current = true
        renderGoogleButton(
          buttonRef.current,
          clientId,
          (response) => {
            void onCredentialEvent(response)
          },
          text,
        )

        /*
         * Google refuses an unregistered origin *silently* — `renderButton` returns without
         * throwing and simply leaves the container empty, which used to leave a handsome
         * button on screen that could never do anything. Checking for the iframe is the only
         * signal we get; the reason itself is only in the console, so it is logged there too.
         */
        probe = setTimeout(() => {
          if (cancelled) return
          const rendered = (buttonRef.current?.childElementCount ?? 0) > 0
          if (!rendered) {
            console.error(
              '[auth] Google did not render its button. The most common cause is that this ' +
                `origin (${window.location.origin}) is not an authorised JavaScript origin for ` +
                `client ${clientId}. Check the browser console for the [GSI_LOGGER] message.`,
            )
          }
          setStatus(rendered ? 'ready' : 'unavailable')
        }, 1500)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('[auth] Google Identity Services failed to load.', error)
        setStatus('unavailable')
      })

    return () => {
      cancelled = true
      if (probe) clearTimeout(probe)
    }
  }, [clientId, onCredentialEvent, text])

  if (!clientId) {
    return null
  }

  // A button that cannot work must not be shown as if it can: email sign-in still works, and
  // saying so is better than letting the learner tap a dead control.
  if (status === 'unavailable') {
    return (
      <p className="text-support rounded-xl bg-ground-sunken px-4 py-3">
        {t.auth.googleUnavailable}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={buttonRef}
          className={`min-h-[44px] ${busy ? 'pointer-events-none opacity-70' : 'opacity-0'}`}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full border-2 border-hairline bg-ground-raised px-5 text-[15px] font-medium text-ink shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <img src={googleGIcon} alt="" className="mr-3 size-6 shrink-0" />
          <span>{buttonLabel}</span>
        </div>
      </div>
      {busy && <p className="text-support text-center">{t.auth.googleWorking}</p>}
    </div>
  )
}

function Divider() {
  const t = useT()

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-hairline" />
      <span className="text-support">{t.auth.or}</span>
      <div className="h-px flex-1 bg-hairline" />
    </div>
  )
}

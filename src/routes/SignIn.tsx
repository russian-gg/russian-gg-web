import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import googleGIcon from '../assets/google-g-dark.svg'
import { OtpInput } from '../components/OtpInput'
import { Button, ErrorNote, Field } from '../components/ui'
import { RequestError, track } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { needsPhone } from '../lib/country'
import {
  loadGoogleIdentityScript,
  renderGoogleButton,
  type GoogleCredentialResponse,
} from '../lib/google-auth'
import { fill, useT } from '../lib/i18n'
import { onboardingDraft } from '../lib/onboardingDraft'
import type { UserProfile } from '../lib/types'

const DEFAULT_GOOGLE_CLIENT_ID =
  '718388409500-ljra0b5j8j3dpubieljmd228gd1c55p3.apps.googleusercontent.com'

const JUST_LINKED_KEY = 'rgg.justLinked'

function postAuthDestination(user: UserProfile, from?: string) {
  if (needsPhone(user)) return '/link-phone'
  if (onboardingDraft.exists()) return '/onboarding'
  if (!user.hasCompletedDiagnostic) return '/onboarding'
  return from ?? '/home'
}

/** Returning learners use a password. An OTP is never part of routine sign-in. */
export function SignIn() {
  const t = useT()
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = typeof location.state?.from === 'string' ? location.state.from : undefined
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justLinked] = useState(() => {
    try {
      if (sessionStorage.getItem(JUST_LINKED_KEY)) {
        sessionStorage.removeItem(JUST_LINKED_KEY)
        return true
      }
    } catch {
      // The banner is optional; authentication is not.
    }
    return false
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const user = await signIn(normalizeLoginIdentifier(identifier), password)
      navigate(postAuthDestination(user, returnTo), { replace: true })
    } catch (caught) {
      setError(
        authErrorText(caught, t.auth.signInFailed, {
          invalid_credentials: t.auth.invalidCredentials,
          account_inactive: t.auth.accountInactive,
        }),
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
      navigate(postAuthDestination(user, returnTo), { replace: true })
    } catch (caught) {
      setError(authErrorText(caught, t.auth.googleFailed, {}))
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
      {justLinked && (
        <p className="mb-5 rounded-xl bg-milestone-soft px-4 py-3 text-sm font-medium text-milestone">
          {t.auth.phone.linkedBanner}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <GoogleContinueButton busy={googleBusy} text="continue_with" onCredential={handleGoogleCredential} />
        <Divider />
        <Field
          label={t.auth.loginIdentifier}
          name="identifier"
          autoComplete="username"
          required
          placeholder={t.auth.loginIdentifierPlaceholder}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          hint={t.auth.loginIdentifierHint}
        />
        <PasswordField
          label={t.auth.password}
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((value) => !value)}
        />
        <Button type="submit" size="lg" block disabled={busy || !identifier.trim() || !password}>
          {busy ? t.auth.signingIn : t.auth.signInAction}
        </Button>
      </form>
    </AuthLayout>
  )
}

/** New learners choose phone registration or the existing email registration path. */
export function SignUp() {
  const t = useT()
  const {
    abandonPendingOnboarding,
    isPendingOnboarding,
    requestPhoneCode,
    signInWithGoogle,
    signUp,
    verifyPhoneCode,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'phone' | 'email'>('phone')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const didClearPendingRef = useRef(false)

  useEffect(() => {
    if (didClearPendingRef.current) return
    if (isPendingOnboarding && location.state?.clearPendingOnboarding === true) {
      didClearPendingRef.current = true
      abandonPendingOnboarding()
      navigate('/signup', { replace: true })
    }
  }, [abandonPendingOnboarding, isPendingOnboarding, location.state, navigate])

  async function submitEmail(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signUp(email, password, displayName.trim())
      track('signup_completed')
      navigate('/onboarding')
    } catch (caught) {
      setError(
        authErrorText(caught, t.auth.signUpFailed, {
          invalid_email: t.auth.invalidEmail,
          email_taken: t.auth.emailTaken,
          weak_password: t.auth.weakPassword,
        }),
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
      track('signup_completed')
      navigate(postAuthDestination(user), { replace: true })
    } catch (caught) {
      setError(authErrorText(caught, t.auth.googleFailed, {}))
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
      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <GoogleContinueButton busy={googleBusy} text="signup_with" onCredential={handleGoogleCredential} />
      <Divider />
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-ground-sunken p-1">
        <AuthModeButton active={mode === 'phone'} onClick={() => setMode('phone')}>
          {t.auth.phone.registerWithPhone}
        </AuthModeButton>
        <AuthModeButton active={mode === 'email'} onClick={() => setMode('email')}>
          {t.auth.phone.registerWithEmail}
        </AuthModeButton>
      </div>
      {mode === 'phone' ? (
        <PhoneCredentialSetupFlow
          subtitle={t.auth.phone.registrationSubtitle}
          requestCode={requestPhoneCode}
          onVerified={async (phone, code, name, newPassword) => {
            const user = await verifyPhoneCode(phone, code, name, newPassword)
            track('signup_completed')
            navigate(postAuthDestination(user), { replace: true })
          }}
          submitLabel={t.auth.phone.completeRegistration}
        />
      ) : (
        <form onSubmit={submitEmail} className="space-y-4">
          <Field
            label={t.auth.displayName}
            name="displayName"
            autoComplete="name"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <Field
            label={t.auth.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PasswordField
            label={t.auth.password}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint={t.auth.passwordHint}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
          />
          <Button
            type="submit"
            size="lg"
            block
            disabled={busy || displayName.trim().length < 2 || !email.trim() || !validPassword(password)}
          >
            {busy ? t.auth.signingUp : t.auth.signUpAction}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

/** Existing email/Google learners verify a phone once and set its reusable password. */
export function LinkPhonePage() {
  const t = useT()
  const { user, requestPhoneLink, verifyPhoneLink, signOut } = useAuth()

  async function finishAndLeave() {
    try {
      sessionStorage.setItem(JUST_LINKED_KEY, '1')
    } catch {
      // The banner is optional.
    }
    await signOut()
  }

  return (
    <AuthLayout title={t.auth.phone.linkTitle}>
      <PhoneCredentialSetupFlow
        subtitle={t.auth.phone.linkSubtitle}
        requestCode={requestPhoneLink}
        initialDisplayName={user?.displayName ?? ''}
        onVerified={async (phone, code, name, newPassword) => {
          await verifyPhoneLink(phone, code, name, newPassword)
          await finishAndLeave()
        }}
        submitLabel={t.auth.phone.savePhonePassword}
      />
    </AuthLayout>
  )
}

function PhoneCredentialSetupFlow({
  subtitle,
  requestCode,
  onVerified,
  initialDisplayName = '',
  submitLabel,
}: {
  subtitle: string
  requestCode: (phoneE164: string) => Promise<{ resendInSeconds: number }>
  onVerified: (phoneE164: string, code: string, displayName: string, password: string) => Promise<void>
  initialDisplayName?: string
  submitLabel: string
}) {
  const t = useT()
  const tp = t.auth.phone
  const [step, setStep] = useState<'phone' | 'credentials'>('phone')
  const [local, setLocal] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const e164 = '+998' + local
  const canRequest = local.length === 9
  const canSubmit = code.length === 4 && displayName.trim().length >= 2 && validPassword(password)

  useEffect(() => {
    if (resendIn <= 0) return
    const id = window.setTimeout(() => setResendIn((value) => value - 1), 1000)
    return () => window.clearTimeout(id)
  }, [resendIn])

  async function sendCode(event?: FormEvent) {
    event?.preventDefault()
    if (!canRequest || busy) return
    setBusy(true)
    setError(null)
    try {
      const challenge = await requestCode(e164)
      setCode('')
      setStep('credentials')
      setResendIn(challenge.resendInSeconds)
    } catch (caught) {
      setError(errorText(caught, tp.errors.default, tp.errors))
    } finally {
      setBusy(false)
    }
  }

  async function submitCredentials(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError(null)
    try {
      await onVerified(e164, code, displayName.trim(), password)
    } catch (caught) {
      setError(errorText(caught, tp.errors.default, tp.errors))
      if (caught instanceof RequestError && caught.code.startsWith('otp_')) setCode('')
    } finally {
      setBusy(false)
    }
  }

  if (step === 'credentials') {
    return (
      <form onSubmit={submitCredentials} className="space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-ink">{tp.setupTitle}</h2>
          <p className="text-support mt-1">{fill(tp.codeSentTo, { phone: e164 })}</p>
          <p className="text-support mt-1">{tp.setupSubtitle}</p>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={setCode}
          disabled={busy}
          ariaLabel={tp.codeTitle}
        />
        <Field
          label={t.auth.displayName}
          name="phoneDisplayName"
          autoComplete="name"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <PasswordField
          label={t.auth.password}
          name="phonePassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={t.auth.passwordHint}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((value) => !value)}
        />
        <Button type="submit" size="lg" block disabled={busy || !canSubmit}>
          {busy ? tp.verifying : submitLabel}
        </Button>
        <div className="flex items-center justify-between gap-4 text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('phone')
              setCode('')
              setError(null)
            }}
            className="font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {tp.changeNumber}
          </button>
          <button
            type="button"
            disabled={resendIn > 0 || busy}
            onClick={() => void sendCode()}
            className="font-semibold text-signal-ink disabled:text-ink-faint"
          >
            {resendIn > 0 ? fill(tp.resendIn, { seconds: resendIn }) : tp.resend}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      <p className="text-support">{subtitle}</p>
      <label className="block" htmlFor="phone">
        <span className="mb-1.5 block text-sm font-medium text-ink">{tp.label}</span>
        <div className="flex items-center gap-2 rounded-2xl border-2 border-hairline bg-ground-raised pl-4 transition-colors focus-within:border-signal">
          <span className="text-base font-semibold text-ink-muted">+998</span>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={tp.placeholder}
            value={local}
            onChange={(event) => setLocal(event.target.value.replace(/\D/g, '').slice(0, 9))}
            className="h-12 w-full rounded-r-2xl bg-transparent pr-4 text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
      </label>
      <Button type="submit" size="lg" block disabled={!canRequest || busy}>
        {busy ? tp.sending : tp.getCode}
      </Button>
    </form>
  )
}

function AuthModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
        active ? 'bg-ground-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="text-sm font-medium text-ink-faint">
        ← russian.gg
      </Link>
      <h1 className="mt-6 mb-7 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      {children}
      {footer && <p className="text-support mt-6">{footer}</p>}
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
          className="h-12 w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 pr-14 text-base text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
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
      .catch((caught: unknown) => {
        if (cancelled) return
        console.error('[auth] Google Identity Services failed to load.', caught)
        setStatus('unavailable')
      })

    return () => {
      cancelled = true
      if (probe) clearTimeout(probe)
    }
  }, [clientId, onCredentialEvent, text])

  if (!clientId || status === 'unavailable') return null

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
    <div className="flex items-center gap-3 py-4">
      <div className="h-px flex-1 bg-hairline" />
      <span className="text-support">{t.auth.or}</span>
      <div className="h-px flex-1 bg-hairline" />
    </div>
  )
}

function validPassword(value: string) {
  return value.length >= 8 && /[A-Za-zА-Яа-яЁё]/.test(value) && /\d/.test(value)
}

function normalizeLoginIdentifier(value: string) {
  const trimmed = value.trim()
  if (trimmed.includes('@')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 9) return `+998${digits}`
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`
  return trimmed
}

function authErrorText(caught: unknown, fallback: string, errors: Record<string, string>) {
  if (caught instanceof RequestError) return errors[caught.code] ?? caught.message ?? fallback
  return fallback
}

function errorText(caught: unknown, fallback: string, errors: Record<string, string>) {
  if (caught instanceof RequestError) return errors[caught.code] ?? caught.message ?? fallback
  return fallback
}

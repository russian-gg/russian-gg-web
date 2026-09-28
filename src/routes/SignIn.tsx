import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GoogleMark } from '../components/GoogleMark'
import { OtpInput } from '../components/OtpInput'
import { BrandMark, WelcomeArt } from './auth/AuthArt'
import { FlagUz } from './settings/choices'
import { Button, ErrorNote, Field } from '../components/ui'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { Reveal, Sequence } from '../components/motion'
import { collapse, stagger } from '../lib/motion'
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

/**
 * Returning learners sign in by phone and password; Google is the alternative below. The
 * password field is hidden until a full number is entered, then rises into view — so the first
 * thing anyone sees is a single phone box.
 */
export function SignIn() {
  const t = useT()
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = typeof location.state?.from === 'string' ? location.state.from : undefined
  const [local, setLocal] = useState('')
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

  const phoneComplete = local.length === 9

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !phoneComplete || !password) return
    setBusy(true)
    setError(null)
    try {
      const user = await signIn('+998' + local, password)
      const destination = postAuthDestination(user, returnTo)
      navigate(destination, { replace: destination !== '/link-phone' })
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
      const destination = postAuthDestination(user, returnTo)
      navigate(destination, { replace: destination !== '/link-phone' })
    } catch (caught) {
      setError(authErrorText(caught, t.auth.googleFailed, {}))
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t.auth.signInTitle}
      subtitle={t.auth.signInSubtitle}
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
        <PhoneNumberInput label={t.auth.phone.label} value={local} onChange={setLocal} />

        {/*
          Progressive disclosure: the password half of the form appears once there is a phone
          number to attach it to. It already rose in; what it could not do was leave, so
          clearing the phone field made half a form vanish between two frames.

          `collapse` animates the height as well as the opacity, so the button underneath
          travels rather than jumping - which matters here more than anywhere, because that
          button is the one a thumb is already moving towards.
        */}
        <AnimatePresence initial={false}>
        {phoneComplete && (
          <m.div
            key="password-step"
            variants={collapse}
            initial="hidden"
            animate="shown"
            exit="exit"
            className="overflow-hidden"
          >
          <div className="space-y-4 pt-4">
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
            <Button type="submit" size="lg" block disabled={busy || !password}>
              {busy ? t.auth.signingIn : t.auth.signInAction}
            </Button>
          </div>
          </m.div>
        )}
        </AnimatePresence>
      </form>

      <Divider />
      <GoogleContinueButton busy={googleBusy} text="continue_with" onCredential={handleGoogleCredential} />
    </AuthLayout>
  )
}

/** New learners register by phone. Google is the alternative below; there is no email path. */
export function SignUp() {
  const t = useT()
  const {
    abandonPendingOnboarding,
    completePhoneRegistration,
    confirmPhoneCode,
    isPendingOnboarding,
    requestPhoneCode,
    signInWithGoogle,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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
      const destination = postAuthDestination(user)
      navigate(destination, { replace: destination !== '/link-phone' })
    } catch (caught) {
      setError(authErrorText(caught, t.auth.googleFailed, {}))
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t.auth.signUpTitle}
      subtitle={t.auth.phone.registrationSubtitle}
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

      <PhoneCredentialSetupFlow
        requestCode={requestPhoneCode}
        confirmCode={confirmPhoneCode}
        completeSetup={async (verificationToken, name, newPassword) => {
          const user = await completePhoneRegistration(verificationToken, name, newPassword)
          track('signup_completed')
          navigate(postAuthDestination(user), { replace: true })
        }}
        submitLabel={t.auth.phone.completeRegistration}
      />

      <Divider />
      <GoogleContinueButton busy={googleBusy} text="signup_with" onCredential={handleGoogleCredential} />
    </AuthLayout>
  )
}

/** Existing email/Google learners verify a phone once and set its reusable password. */
export function LinkPhonePage() {
  const t = useT()
  const { user, requestPhoneLink, confirmPhoneLinkCode, completePhoneLink, signOut } = useAuth()

  async function finishAndLeave() {
    try {
      sessionStorage.setItem(JUST_LINKED_KEY, '1')
    } catch {
      // The banner is optional.
    }
    await signOut()
  }

  return (
    <AuthLayout title={t.auth.phone.linkTitle} subtitle={t.auth.phone.linkSubtitle}>
      <PhoneCredentialSetupFlow
        requestCode={requestPhoneLink}
        confirmCode={confirmPhoneLinkCode}
        initialDisplayName={user?.displayName ?? ''}
        completeSetup={async (verificationToken, name, newPassword) => {
          await completePhoneLink(verificationToken, name, newPassword)
          await finishAndLeave()
        }}
        submitLabel={t.auth.phone.savePhonePassword}
      />
    </AuthLayout>
  )
}

function PhoneCredentialSetupFlow({
  requestCode,
  confirmCode,
  completeSetup,
  initialDisplayName = '',
  submitLabel,
}: {
  requestCode: (phoneE164: string) => Promise<{ resendInSeconds: number }>
  confirmCode: (phoneE164: string, code: string) => Promise<{ verificationToken: string }>
  completeSetup: (verificationToken: string, displayName: string, password: string) => Promise<void>
  initialDisplayName?: string
  submitLabel: string
}) {
  const t = useT()
  const tp = t.auth.phone
  const [step, setStep] = useState<'phone' | 'code' | 'credentials'>('phone')
  const [local, setLocal] = useState('')
  const [code, setCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
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
      setVerificationToken('')
      setStep('code')
      setResendIn(challenge.resendInSeconds)
    } catch (caught) {
      setError(errorText(caught, tp.errors.default, tp.errors))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    if (code.length !== 4 || busy) return
    setBusy(true)
    setError(null)
    try {
      const confirmation = await confirmCode(e164, code)
      setVerificationToken(confirmation.verificationToken)
      setStep('credentials')
    } catch (caught) {
      setError(errorText(caught, tp.errors.default, tp.errors))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  async function submitCredentials(event: FormEvent) {
    event.preventDefault()
    if (!verificationToken || !canSubmit || busy) return
    setBusy(true)
    setError(null)
    try {
      await completeSetup(verificationToken, displayName.trim(), password)
    } catch (caught) {
      setError(errorText(caught, tp.errors.default, tp.errors))
      if (caught instanceof RequestError && caught.code === 'otp_verification_expired') {
        setVerificationToken('')
        setCode('')
        setStep('phone')
      }
    } finally {
      setBusy(false)
    }
  }

  if (step === 'code') {
    return (
      <form onSubmit={submitCode} className="space-y-5">
        <div>
          <h2 className="text-base font-extrabold text-ink">{tp.codeTitle}</h2>
          <p className="text-support mt-1">{fill(tp.codeSentTo, { phone: e164 })}</p>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={setCode}
          disabled={busy}
          ariaLabel={tp.codeTitle}
        />
        <Button type="submit" size="lg" block disabled={busy || code.length !== 4}>
          {busy ? tp.verifying : tp.verify}
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

  if (step === 'credentials') {
    return (
      <form onSubmit={submitCredentials} className="space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-ink">{tp.setupTitle}</h2>
          <p className="text-support mt-1">{tp.setupSubtitle}</p>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <label className="block" htmlFor="verifiedPhone">
          <span className="mb-1.5 block text-sm font-medium text-ink">{tp.label}</span>
          <input
            id="verifiedPhone"
            value={e164}
            disabled
            className="h-12 w-full cursor-not-allowed rounded-xl border-2 border-hairline bg-ground-sunken px-4 text-base text-ink-faint opacity-70"
          />
        </label>
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
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      {/* The line saying what this screen is for now belongs to `AuthLayout`, directly under
          the heading, so it sits in the same place on all four auth screens. It used to be
          printed here as well, which put it twice on the sign-up page. */}
      <PhoneNumberInput label={tp.label} value={local} onChange={setLocal} />
      <Button type="submit" size="lg" block disabled={!canRequest || busy}>
        {busy ? tp.sending : tp.getCode}
      </Button>
    </form>
  )
}

/**
 * Every auth screen in the product: sign in, sign up, password reset and phone linking.
 *
 * One card, split. The left half is the welcome — a picture and a sentence, and nothing to do;
 * the right half is the entire job. That division is the point of the layout rather than
 * decoration: an account form is short, and a short form alone in the middle of a wide screen
 * reads as an interruption. Giving it a companion panel makes it a destination.
 *
 * Below `lg` the left half is gone entirely, not stacked. On a phone the form is the screen,
 * and a welcome picture above it is one scroll between the learner and the keyboard.
 *
 * These screens sit outside the app shell, so they get no page transition of their own — this
 * beat is the only thing standing between a learner and a form that snaps into existence.
 */
function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  /** One line under the heading saying what this screen is for. */
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="auth-page relative isolate min-h-dvh px-4 py-8 sm:px-6 sm:py-12">
      <AuthBackdrop />

      <Sequence
        className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center"
        gap={stagger.base}
      >
        <Reveal className="w-full">
          <div className="overflow-hidden rounded-[2rem] border border-hairline bg-ground-raised shadow-[0_32px_80px_-40px_rgb(31_111_224/0.35)] lg:grid lg:grid-cols-2">
            <AuthAside />

            <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
              <BrandLockup />

              <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                {title}
              </h1>
              {subtitle && <p className="text-support mt-2 leading-relaxed">{subtitle}</p>}

              <div className="mt-7">{children}</div>

              {footer && <p className="text-support mt-7 text-sm">{footer}</p>}
            </div>
          </div>
        </Reveal>
      </Sequence>
    </div>
  )
}

/**
 * The product's name, and the way back out.
 *
 * It is a link to the landing page rather than an arrow captioned "back", and never
 * `navigate(-1)`. What sits behind an auth screen is very often a protected one — the learner
 * signed out on `/home`, or a guard sent them here — and stepping back onto it only bounced
 * them straight back to sign-in, so the control did nothing. A wordmark that goes home is both
 * the exit and the thing the screen ought to be signed with anyway.
 */
function BrandLockup() {
  const t = useT()

  return (
    <Link
      to="/"
      aria-label={t.common.back}
      className="inline-flex items-center gap-2.5 self-start rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
    >
      <BrandMark className="size-9" />
      <span className="text-lg font-semibold tracking-tight text-ink">
        russian<span className="text-signal">.gg</span>
      </span>
    </Link>
  )
}

/** The welcome half. Decorative throughout, so none of it is announced. */
function AuthAside() {
  const t = useT()

  return (
    <aside className="auth-aside relative hidden flex-col justify-between px-10 py-12 lg:flex">
      <div className="flex flex-1 items-center justify-center">
        <WelcomeArt className="w-full max-w-[26rem]" />
      </div>

      <div>
        <p className="text-3xl font-extrabold tracking-tight text-ink">{t.auth.welcomeTitle}</p>
        <p className="text-support mt-2 leading-relaxed">{t.auth.welcomeBody}</p>
      </div>
    </aside>
  )
}

/**
 * The page behind the card.
 *
 * Two very large, very soft blooms at opposite corners. They are `-z-10` under an `isolate`
 * parent so they can never land on top of a form control, and they are marked decorative
 * because they are: the screen reads identically on a flat background.
 */
function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="auth-bloom absolute -top-40 -right-32 size-[34rem] rounded-full" />
      <div className="auth-bloom absolute -bottom-48 -left-40 size-[38rem] rounded-full" />
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
      <Eye aria-hidden="true" strokeWidth={1.8} className="size-5" />
    )
  }
  return (
    <EyeOff aria-hidden="true" strokeWidth={1.8} className="size-5" />
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
      {/*
        Google's own button is the one that is actually pressed — it is rendered into the div
        below and held at `opacity-0`, because Google's terms do not allow their sign-in to be
        driven from a control of our own. What the learner sees is the overlay on top of it,
        which is `pointer-events-none` so every press lands on the real thing underneath.

        That makes the overlay purely a costume, and it has to match the height of the button
        it is covering or the hit area drifts away from what is drawn. `min-h-12` on both is
        what keeps them in register.
      */}
      <div className="relative">
        <div
          ref={buttonRef}
          className={`min-h-12 ${busy ? 'pointer-events-none opacity-70' : 'opacity-0'}`}
        />
        <div className="pointer-events-none absolute inset-0 flex min-h-12 items-center justify-center gap-3 rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-5 text-[15px] font-bold text-ink transition-colors">
          <GoogleMark className="size-6" />
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

/** Groups the 9 local digits the way an Uzbek number is read: 90 123 45 67. */
function formatUzPhone(digits: string) {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)]
    .filter(Boolean)
    .join(' ')
}

/** A full Uzbek number in digits: country code 998 plus nine local ones. */
const UZ_INTERNATIONAL_LENGTH = 12

/**
 * Reduces whatever was typed, pasted or autofilled to the nine local digits the box holds.
 *
 * The country code is already printed beside the field, so anybody pasting a number they
 * copied from somewhere — or letting the browser autofill one — arrives with it twice.
 * Simply keeping the first nine digits turned +998974437767 into 99 897 44 37: the code was
 * counted as the number and the last three digits fell off the end, which reads as a typo
 * the learner did not make and sends the code to a number that does not exist.
 *
 * It cannot just drop a leading "998" though: 99 is a real operator code here, so a local
 * number may genuinely start with those digits. The prefix is only removed once the string is
 * long enough that it cannot be anything else — a local number is nine digits, and reaching
 * twelve means a country code is in there too.
 */
function toUzLocalDigits(raw: string) {
  let digits = raw.replace(/\D/g, '')

  // An international prefix dialled rather than typed as "+".
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('998') && digits.length >= UZ_INTERNATIONAL_LENGTH) {
    digits = digits.slice(3)
  }

  return digits.slice(0, 9)
}

/**
 * The country code sits fixed to the left and the caller keeps the 9 raw local digits; the box
 * shows them grouped as they are typed. Used everywhere a phone is entered so the shape is the
 * same on every screen.
 */
function PhoneNumberInput({
  label,
  value,
  onChange,
  id = 'phone',
}: {
  label: string
  value: string
  onChange: (digits: string) => void
  id?: string
}) {
  const t = useT()
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm font-bold text-ink">{label}</span>
      <div className="flex items-center rounded-2xl border-2 border-hairline bg-ground-raised transition-colors focus-within:border-signal">
        {/*
          The flag and the country code are a label, not a control. Uzbekistan is the only
          country this product takes numbers from — `toUzLocalDigits` is built around a nine
          digit local number and a 998 prefix — so a picker here would open onto a list with
          one entry in it. It is drawn to look like the rest of the field and nothing more.
        */}
        <span aria-hidden="true" className="flex items-center gap-2 py-3 pr-3 pl-4">
          <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full border border-hairline">
            <FlagUz />
          </span>
          <span className="text-base font-bold text-ink-muted">+998</span>
        </span>

        <input
          id={id}
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={t.auth.phone.placeholder}
          value={formatUzPhone(value)}
          onChange={(event) => onChange(toUzLocalDigits(event.target.value))}
          className="h-12 w-full min-w-0 rounded-r-2xl bg-transparent pr-4 text-base tracking-[0.02em] text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
        />
      </div>
    </label>
  )
}

function authErrorText(caught: unknown, fallback: string, errors: Record<string, string>) {
  if (caught instanceof RequestError) return errors[caught.code] ?? caught.message ?? fallback
  return fallback
}

function errorText(caught: unknown, fallback: string, errors: Record<string, string>) {
  if (caught instanceof RequestError) return errors[caught.code] ?? caught.message ?? fallback
  return fallback
}

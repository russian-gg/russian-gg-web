import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import googleGIcon from '../assets/google-g-official.svg'
import { RequestError, track } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { isLikelyUzbekistan, needsPhone } from '../lib/country'
import { onboardingDraft } from '../lib/onboardingDraft'
import { fill, useT } from '../lib/i18n'
import {
  loadGoogleIdentityScript,
  renderGoogleButton,
  type GoogleCredentialResponse,
} from '../lib/google-auth'
import { OtpInput } from '../components/OtpInput'
import { Button, ErrorNote } from '../components/ui'
import type { UserProfile } from '../lib/types'

const DEFAULT_GOOGLE_CLIENT_ID =
  '718388409500-ljra0b5j8j3dpubieljmd228gd1c55p3.apps.googleusercontent.com'

const JUST_LINKED_KEY = 'rgg.justLinked'

/**
 * Both /signin and /signup render the same thing now: sign-in and sign-up are one act with a
 * one-time code. A returning phone is logged in; a new one gets an account.
 */
export function SignIn() {
  return <AuthPage />
}

export function SignUp() {
  return <AuthPage />
}

/**
 * Where to land after authenticating. A learner who still owes a verified phone is sent to link
 * one before anything else; a placement run taken while signed out outranks the rest.
 */
function postAuthDestination(user: UserProfile, from?: string) {
  if (needsPhone(user)) return '/link-phone'
  if (onboardingDraft.exists()) return '/onboarding'
  if (!user.hasCompletedDiagnostic) return '/onboarding'
  return from ?? '/home'
}

function AuthPage() {
  const t = useT()
  const tp = t.auth.phone
  const { requestPhoneCode, verifyPhoneCode, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = typeof location.state?.from === 'string' ? location.state.from : undefined

  // Set by the phone-link step after it signs the learner out; survives the redirect.
  const [justLinked] = useState(() => {
    try {
      if (sessionStorage.getItem(JUST_LINKED_KEY)) {
        sessionStorage.removeItem(JUST_LINKED_KEY)
        return true
      }
    } catch {
      // no-op
    }
    return false
  })

  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uz = isLikelyUzbekistan()

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
      setError(errorText(caught, t.auth.googleFailed, tp.errors))
    } finally {
      setGoogleBusy(false)
    }
  }

  const google = (
    <GoogleContinueButton busy={googleBusy} text="continue_with" onCredential={handleGoogleCredential} />
  )

  return (
    <AuthLayout title={tp.title}>
      {justLinked && (
        <p className="mb-5 rounded-xl bg-milestone-soft px-4 py-3 text-sm font-medium text-milestone">
          {tp.linkedBanner}
        </p>
      )}
      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <PhoneCodeFlow
        subtitle={tp.subtitle}
        requestCode={requestPhoneCode}
        onVerified={async (phone, code) => {
          const user = await verifyPhoneCode(phone, code)
          if (!user.hasCompletedDiagnostic && !needsPhone(user)) track('signup_completed')
          navigate(postAuthDestination(user, returnTo), { replace: true })
        }}
        secondary={
          // Abroad, Google leads; in Uzbekistan the phone leads and Google is the fallback.
          <>
            <Divider />
            {!uz && <p className="text-support mb-3 text-center">{tp.googlePrimaryNote}</p>}
            {google}
          </>
        }
        secondaryFirst={!uz}
      />
    </AuthLayout>
  )
}

/**
 * The one-time migration for accounts that came in through Google: confirm a phone, then get
 * signed out and sent to the phone door. Mounted behind RequireAuth, which forces every UZ
 * learner without a confirmed phone here.
 */
export function LinkPhonePage() {
  const t = useT()
  const tp = t.auth.phone
  const { requestPhoneLink, verifyPhoneLink, signOut } = useAuth()

  async function finishAndLeave() {
    try {
      sessionStorage.setItem(JUST_LINKED_KEY, '1')
    } catch {
      // no-op; the banner is a nicety, not load-bearing
    }
    // Signing out drops the learner; RequireAuth then routes them to the phone sign-in, where
    // the banner explains what happened.
    await signOut()
  }

  return (
    <AuthLayout title={tp.linkTitle}>
      <PhoneCodeFlow
        subtitle={tp.linkSubtitle}
        requestCode={requestPhoneLink}
        onVerified={async (phone, code) => {
          await verifyPhoneLink(phone, code)
          await finishAndLeave()
        }}
      />
    </AuthLayout>
  )
}

/* ------------------------------------------------------------------ phone + code flow */

/**
 * The shared two-step flow: enter a phone, then the code texted to it. The caller supplies how a
 * code is requested and what a verified code means (sign in, or link), so this component owns
 * only the form, the resend timer and the error copy.
 */
function PhoneCodeFlow({
  subtitle,
  requestCode,
  onVerified,
  secondary,
  secondaryFirst = false,
}: {
  subtitle: string
  requestCode: (phoneE164: string) => Promise<{ resendInSeconds: number }>
  onVerified: (phoneE164: string, code: string) => Promise<void>
  secondary?: ReactNode
  secondaryFirst?: boolean
}) {
  const t = useT()
  const tp = t.auth.phone
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [local, setLocal] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  const e164 = '+998' + local
  const canRequest = local.length >= 9

  useEffect(() => {
    if (resendIn <= 0) return
    const id = window.setTimeout(() => setResendIn(resendIn - 1), 1000)
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
      setStep('code')
      setResendIn(challenge.resendInSeconds)
    } catch (caught) {
      setError(errorText(caught, tp.errors.default, tp.errors))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(finalCode: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await onVerified(e164, finalCode)
    } catch (caught) {
      setError(errorText(caught, tp.errors.default, tp.errors))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  if (step === 'code') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-extrabold text-ink">{tp.codeTitle}</h2>
          <p className="text-support mt-1">{fill(tp.codeSentTo, { phone: e164 })}</p>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={submitCode}
          disabled={busy}
          ariaLabel={tp.codeTitle}
        />

        <Button size="lg" block disabled={busy || code.length < 4} onClick={() => submitCode(code)}>
          {busy ? tp.verifying : tp.verify}
        </Button>

        <div className="flex items-center justify-between text-sm">
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
            onClick={() => sendCode()}
            className="font-semibold text-signal-ink disabled:text-ink-faint"
          >
            {resendIn > 0 ? fill(tp.resendIn, { seconds: resendIn }) : tp.resend}
          </button>
        </div>
      </div>
    )
  }

  const phoneForm = (
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

  return (
    <div className="space-y-1">
      {secondaryFirst ? (
        <>
          {secondary}
          {phoneForm}
        </>
      ) : (
        <>
          {phoneForm}
          {secondary}
        </>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------- helpers */

function errorText(
  caught: unknown,
  fallback: string,
  errors: Record<string, string>,
): string {
  if (caught instanceof RequestError) {
    return errors[caught.code] ?? caught.message ?? fallback
  }
  return fallback
}

function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="text-sm font-medium text-ink-faint">
        ← russian.gg
      </Link>
      <h1 className="mt-6 mb-7 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      {children}
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
  const buttonLabel = t.auth.phone.googleSecondary

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

  if (!clientId || status === 'unavailable') {
    return null
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

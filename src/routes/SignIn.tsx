import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RequestError, track } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import {
  loadGoogleIdentityScript,
  renderGoogleButton,
  type GoogleCredentialResponse,
} from '../lib/google-auth'
import { Button, ErrorNote, Field } from '../components/ui'

const DEFAULT_GOOGLE_CLIENT_ID =
  '718388409500-ljra0b5j8j3dpubieljmd228gd1c55p3.apps.googleusercontent.com'

export function SignIn() {
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
      navigate(user.hasCompletedDiagnostic ? '/home' : '/onboarding', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof RequestError ? caught.message : 'Kirishda xatolik. Qayta urinib ko‘ring.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    if (!response.credential) {
      setError('Google orqali kirishda token kelmadi.')
      return
    }

    setGoogleBusy(true)
    setError(null)

    try {
      const user = await signInWithGoogle(response.credential)
      navigate(user.hasCompletedDiagnostic ? '/home' : '/onboarding', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof RequestError
          ? caught.message
          : 'Google orqali kirishda xatolik. Qayta urinib ko‘ring.',
      )
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Kirish"
      footer={
        <>
          Hisobingiz yo‘qmi?{' '}
          <Link to="/signup" className="font-semibold text-signal-ink">
            Ro‘yxatdan o‘ting
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
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          label="Parol"
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
          {busy ? 'Kirilmoqda…' : 'Kirish'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export function SignUp() {
  const { signInWithGoogle, signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await signUp(email, password, displayName || undefined)
      track('signup_completed')
      navigate('/onboarding', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof RequestError
          ? caught.message
          : 'Ro‘yxatdan o‘tishda xatolik. Qayta urinib ko‘ring.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleCredential(response: GoogleCredentialResponse) {
    if (!response.credential) {
      setError('Google orqali ro‘yxatdan o‘tishda token kelmadi.')
      return
    }

    setGoogleBusy(true)
    setError(null)

    try {
      const user = await signInWithGoogle(response.credential, displayName || undefined)
      track('signup_completed')
      navigate(user.hasCompletedDiagnostic ? '/home' : '/onboarding', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof RequestError
          ? caught.message
          : 'Google orqali ro‘yxatdan o‘tishda xatolik. Qayta urinib ko‘ring.',
      )
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Ro‘yxatdan o‘tish"
      footer={
        <>
          Hisobingiz bormi?{' '}
          <Link to="/signin" className="font-semibold text-signal-ink">
            Kiring
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
          label="Ism"
          name="displayName"
          autoComplete="given-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="Ixtiyoriy."
        />

        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          label="Parol"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Kamida 8 belgi, harf va raqam bilan."
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((value) => !value)}
        />

        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Yaratilmoqda…' : 'Bepul boshlash'}
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
      <h1 className="mb-7 mt-6 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
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
  const id = props.id ?? props.name ?? label

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <div className="relative">
        <input
          {...props}
          id={id}
          className="h-12 w-full rounded-xl border border-hairline bg-ground-raised px-4 pr-14 text-base text-ink placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute top-1/2 right-3 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
          aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
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
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID
  const buttonLabel =
    text === 'signup_with' ? "Google bilan ro'yxatdan o'tish" : 'Google bilan davom etish'

  useEffect(() => {
    if (!clientId || !buttonRef.current) return

    let cancelled = false

    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return
        renderGoogleButton(
          buttonRef.current,
          clientId,
          (response) => {
            void onCredentialEvent(response)
          },
          text,
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (buttonRef.current) {
        buttonRef.current.innerHTML = ''
      }
    }
  }, [clientId, onCredentialEvent, text])

  if (!clientId) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={buttonRef}
          className={`min-h-[44px] ${busy ? 'pointer-events-none opacity-70' : 'opacity-0'}`}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full border border-hairline bg-white px-5 text-[15px] font-medium text-ink shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="mr-3 text-lg leading-none" aria-hidden="true">
            G
          </span>
          <span>{buttonLabel}</span>
        </div>
      </div>
      {busy && <p className="text-support text-center">Google bilan kirilmoqda…</p>}
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-hairline" />
      <span className="text-support">yoki</span>
      <div className="h-px flex-1 bg-hairline" />
    </div>
  )
}

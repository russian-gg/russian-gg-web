import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RequestError, track } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { Button, ErrorNote, Field } from '../components/ui'

export function SignIn() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const user = await signIn(email, password)
      navigate(user.hasCompletedDiagnostic ? '/home' : '/onboarding', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof RequestError ? caught.message : 'Kirishda xatolik. Qayta urinib ko’ring.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Kirish" footer={<>Hisobingiz yo’qmi? <Link to="/signup" className="font-semibold text-signal-ink">Ro’yxatdan o’ting</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}

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
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
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
          : 'Ro’yxatdan o’tishda xatolik. Qayta urinib ko’ring.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Ro’yxatdan o’tish"
      footer={<>Hisobingiz bormi? <Link to="/signin" className="font-semibold text-signal-ink">Kiring</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}

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
  children: React.ReactNode
  footer: React.ReactNode
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
}: React.InputHTMLAttributes<HTMLInputElement> & {
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
          aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
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

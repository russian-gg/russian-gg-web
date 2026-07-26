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

        <Field
          label="Parol"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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

        <Field
          label="Parol"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Kamida 8 belgi, harf va raqam bilan."
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

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
          <GoogleGlyph />
          <span>{buttonLabel}</span>
        </div>
      </div>
      {busy && <p className="text-support text-center">Google bilan kirilmoqda…</p>}
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="12 10 20 20" aria-hidden="true" className="mr-3 size-5 shrink-0">
      <mask id="google-g-mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="12" y="10" width="20" height="20">
        <path d="M31.3987 18.1814H21.9849V22.0445H27.3598C27.1286 23.294 26.4294 24.3596 25.3676 25.0712C24.4746 25.6716 23.3266 26.0211 21.9849 26.0211C19.3864 26.0211 17.1823 24.2666 16.3947 21.9004C16.1952 21.2989 16.0853 20.6599 16.0853 19.9983C16.0853 19.3367 16.1952 18.6966 16.3947 18.0962C17.1823 15.7311 19.3864 13.9755 21.9849 13.9755C23.4524 13.9755 24.767 14.4816 25.8039 15.4713L28.6653 12.6057C26.936 10.9908 24.6786 10 21.9849 10C18.0832 10 14.705 12.2414 13.0618 15.5076C12.383 16.8592 12 18.3834 12 19.9994C12 21.6155 12.383 23.1396 13.0618 24.4913C14.705 27.7597 18.0832 30 21.9849 30C24.6797 30 26.9485 29.1137 28.6018 27.5861C30.4887 25.8452 31.5732 23.2702 31.5732 20.2275C31.5732 19.5182 31.5131 18.835 31.3987 18.1825V18.1814Z" fill="#E94FFF" />
      </mask>
      <g mask="url(#google-g-mask)">
        <g filter="url(#google-g-blur-main)">
          <g clipPath="url(#google-g-clip)" data-figma-skip-parse="true">
            <g transform="matrix(0.00804129 -0.00805186 0.00804128 0.00805186 21.6819 19.7927)">
              <foreignObject x="-2105.64" y="-2105.64" width="4211.29" height="4211.29">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ background: 'conic-gradient(from 90deg,rgba(255, 70, 65, 1) 0deg,rgba(255, 70, 65, 1) 4.14555deg,rgba(49, 134, 255, 1) 39.154deg,rgba(49, 134, 255, 1) 72.0044deg,rgba(0, 165, 183, 1) 96.7463deg,rgba(14, 188, 95, 1) 120.897deg,rgba(14, 188, 95, 1) 154.722deg,rgba(108, 196, 0, 1) 179.136deg,rgba(255, 204, 0, 1) 203.588deg,rgba(255, 211, 20, 1) 226.915deg,rgba(255, 204, 0, 1) 251.688deg,rgba(255, 106, 43, 1) 273.129deg,rgba(253, 70, 65, 1) 289.305deg,rgba(255, 70, 65, 1) 359.593deg,rgba(255, 70, 65, 1) 360deg)', height: '100%', width: '100%', opacity: 1 }} />
              </foreignObject>
            </g>
          </g>
          <path d="M9.25923 19.7927C9.25923 12.6759 15.0209 6.90668 22.1283 6.90668C29.2357 6.90668 34.9973 12.6759 34.9973 19.7927C34.9973 26.9094 29.2357 32.6786 22.1283 32.6786C15.0209 32.6786 9.25923 26.9094 9.25923 19.7927Z" />
        </g>
        <g filter="url(#google-g-blur-blue-small)">
          <ellipse cx="22.0496" cy="20.2413" rx="5.39634" ry="2.83537" transform="rotate(24.4473 22.0496 20.2413)" fill="#3186FF" />
        </g>
        <g filter="url(#google-g-blur-blue-wide)">
          <ellipse cx="35.3538" cy="18.2155" rx="7.43918" ry="3.09357" fill="#3186FF" />
        </g>
        <g filter="url(#google-g-blur-red)">
          <ellipse cx="27.2744" cy="16.2195" rx="7.40854" ry="2.37805" fill="#FF4641" />
        </g>
        <g filter="url(#google-g-blur-pink)">
          <ellipse cx="31.5427" cy="12.9268" rx="7.40854" ry="2.37805" fill="#FF5B8B" />
        </g>
        <g filter="url(#google-g-blur-blue-mid)">
          <ellipse cx="26.4817" cy="19.878" rx="8.5061" ry="3.10976" fill="#3186FF" />
        </g>
        <g filter="url(#google-g-blur-red-small)">
          <ellipse cx="27.1842" cy="14.0197" rx="4.53882" ry="2.37805" transform="rotate(-28.6599 27.1842 14.0197)" fill="#FF4641" />
        </g>
      </g>
      <defs>
        <filter id="google-g-blur-main" x="7.25922" y="4.90668" width="29.7381" height="29.772" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur" />
        </filter>
        <clipPath id="google-g-clip">
          <path d="M9.25923 19.7927C9.25923 12.6759 15.0209 6.90668 22.1283 6.90668C29.2357 6.90668 34.9973 12.6759 34.9973 19.7927C34.9973 26.9094 29.2357 32.6786 22.1283 32.6786C15.0209 32.6786 9.25923 26.9094 9.25923 19.7927Z" />
        </clipPath>
        <filter id="google-g-blur-blue-small" x="14.9977" y="14.828" width="14.1037" height="10.8265" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur" />
        </filter>
        <filter id="google-g-blur-blue-wide" x="25.9146" y="13.1219" width="18.8784" height="10.1871" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur" />
        </filter>
        <filter id="google-g-blur-red" x="17.8658" y="11.8415" width="18.8171" height="8.7561" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur" />
        </filter>
        <filter id="google-g-blur-pink" x="22.1342" y="8.54878" width="18.8171" height="8.7561" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur" />
        </filter>
        <filter id="google-g-blur-blue-mid" x="15.9756" y="14.7683" width="21.0122" height="10.2195" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur" />
        </filter>
        <filter id="google-g-blur-red-small" x="21.0403" y="9.0042" width="12.2878" height="10.0309" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
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

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, ErrorNote, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'

/**
 * Consumes the opaque link sent by the sales bot. An authenticated learner can claim it
 * immediately; everyone else carries it through sign-up or sign-in, where the same database
 * transaction that authenticates them attaches the Telegram conversation.
 */
export function TelegramConnect() {
  const { user, isLoading } = useAuth()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const token = search.get('token')?.trim() ?? ''

  useEffect(() => {
    if (isLoading) return

    if (!token) {
      navigate('/signup', { replace: true })
      return
    }

    if (!user) {
      navigate(`/signup?telegramLink=${encodeURIComponent(token)}`, { replace: true })
      return
    }

    let cancelled = false
    void api
      .post('/auth/telegram-link', { token })
      .then(() => {
        if (!cancelled) {
          navigate(user.hasCompletedDiagnostic ? '/home' : '/onboarding', { replace: true })
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [isLoading, navigate, token, user])

  if (failed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
        <ErrorNote>Telegram chatni akkauntga bog'lab bo'lmadi. Qayta urinib ko'ring.</ErrorNote>
        <Button block onClick={() => window.location.reload()}>
          Qayta urinish
        </Button>
      </main>
    )
  }

  return (
    <main className="grid min-h-dvh place-items-center">
      <Spinner />
    </main>
  )
}

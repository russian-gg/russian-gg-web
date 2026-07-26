import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useTheme, type Theme } from '../lib/theme'
import type { ConsentKind, ConsentState } from '../lib/types'
import { Button, Card, ErrorNote, SectionHeading, Spinner, UzHint } from '../components/ui'
import { cx } from '../lib/cx'

/**
 * Consent is granular and withdrawable, and account deletion is reachable without contacting
 * support (PRD §12).
 */
const CONSENTS: Array<{ kind: ConsentKind; title: string; body: string }> = [
  {
    kind: 'AudioRetention',
    title: 'Ovoz yozuvlarini saqlash',
    body: 'Mashq tugagach ovozingiz saqlanadi, shunda keyin qayta tinglashingiz mumkin. Ruxsat bermasangiz, ovoz faqat izoh uchun ishlatiladi va saqlanmaydi.',
  },
  {
    kind: 'AudioHumanReview',
    title: 'Sifat nazorati uchun tinglash',
    body: 'Muharrir tanlangan yozuvlarni izoh sifatini tekshirish uchun tinglashi mumkin.',
  },
  {
    kind: 'ProductReminders',
    title: 'Eslatmalar',
    body: 'Mashqni o’tkazib yuborsangiz, o’z vaqt mintaqangizda eslatma yuboramiz.',
  },
  {
    kind: 'ProductAnalytics',
    title: 'Mahsulot statistikasi',
    body: 'Qaysi mashqlar foydali ekanini tushunish uchun anonim foydalanish ma’lumotlari.',
  },
]

export function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: consents, isLoading } = useQuery({
    queryKey: ['consents'],
    queryFn: () => api.get<ConsentState[]>('/auth/consents'),
  })

  async function toggle(kind: ConsentKind, granted: boolean) {
    setError(null)
    try {
      await api.put<ConsentState[]>('/auth/consents', { kind, granted })
      await queryClient.invalidateQueries({ queryKey: ['consents'] })
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : 'Saqlashda xatolik.')
    }
  }

  async function deleteAccount() {
    const confirmation = prompt(
      'Hisobingiz va barcha yozuvlaringiz o’chiriladi. Tasdiqlash uchun O‘CHIRISH deb yozing.',
    )
    if (confirmation !== 'O‘CHIRISH') return

    setBusy(true)
    try {
      await api.post('/auth/delete-account')
      await signOut()
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : 'O’chirishda xatolik.')
      setBusy(false)
    }
  }

  if (isLoading) return <Spinner />

  const granted = new Map(consents?.map((consent) => [consent.kind, consent.granted]) ?? [])

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Sozlamalar</h1>
        <p className="text-support mt-1">{user?.email}</p>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section>
        <SectionHeading>Ko’rinish</SectionHeading>
        <ThemeChoice />
      </section>

      <section>
        <SectionHeading>Maxfiylik va ruxsatlar</SectionHeading>
        <div className="space-y-3">
          {CONSENTS.map((consent) => (
            <Card key={consent.kind} as="article">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-ink">{consent.title}</h3>
                  <UzHint>{consent.body}</UzHint>
                </div>

                <label className="flex shrink-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={granted.get(consent.kind) ?? false}
                    onChange={(event) => void toggle(consent.kind, event.target.checked)}
                    className="size-5 accent-[var(--color-signal)]"
                  />
                  <span className="text-sm font-medium text-ink-muted">
                    {granted.get(consent.kind) ? 'Yoqilgan' : 'O’chiq'}
                  </span>
                </label>
              </div>
            </Card>
          ))}
        </div>

        <p className="text-support mt-3">
          Ruxsat bermasangiz ham mashqlar ishlaydi. Ovoz yozuvlari faqat siz ruxsat bergan
          taqdirdagina saqlanadi.
        </p>
      </section>

      <section>
        <SectionHeading>Obuna</SectionHeading>
        <Button variant="secondary" onClick={() => navigate('/paywall')}>
          Obunani boshqarish
        </Button>
      </section>

      <section>
        <SectionHeading>Hisob</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => void signOut().then(() => navigate('/'))}>
            Chiqish
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void deleteAccount()}>
            Hisobni o’chirish
          </Button>
        </div>
        <p className="text-support mt-3">
          Hisobni o’chirsangiz, barcha yozuvlar, transkriptlar va progress o’chiriladi. Buni
          qaytarib bo’lmaydi.
        </p>
      </section>
    </div>
  )
}

/**
 * Light is the product default. Dark is a deliberate choice, remembered only once it is
 * made — the operating system setting is intentionally not consulted.
 */
function ThemeChoice() {
  const { theme, setTheme } = useTheme()

  const options: Array<{ value: Theme; label: string; hint: string }> = [
    { value: 'light', label: 'Yorug’', hint: 'Standart ko’rinish' },
    { value: 'dark', label: 'Qorong’i', hint: 'Kechqurun mashq uchun' },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Ko’rinish">
      {options.map((option) => {
        const isActive = theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(option.value)}
            className={cx(
              'rounded-[var(--radius-card)] border p-4 text-left transition-colors',
              isActive
                ? 'border-signal bg-signal-soft'
                : 'border-hairline bg-ground-raised hover:border-ink-faint',
            )}
          >
            <span className="flex items-center gap-2">
              {/* Swatch plus a word: the choice is never conveyed by colour alone. */}
              <span
                aria-hidden="true"
                className={cx(
                  'size-4 rounded-full border',
                  option.value === 'light'
                    ? 'border-hairline bg-white'
                    : 'border-transparent bg-[#101216]',
                )}
              />
              <span className="text-base font-semibold text-ink">{option.label}</span>
              {isActive && <span className="text-sm font-medium text-signal-ink">Tanlangan</span>}
            </span>
            <span className="text-support mt-1 block">{option.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

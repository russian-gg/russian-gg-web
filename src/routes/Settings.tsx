import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useTheme, type Theme } from '../lib/theme'
import type { ConsentKind, ConsentState } from '../lib/types'
import { Button, Card, ErrorNote, RadioOption, SectionHeading, Spinner, UzHint } from '../components/ui'
import { cx } from '../lib/cx'

const CONSENTS: Array<{ kind: ConsentKind; title: string; body: string }> = [
  {
    kind: 'AudioRetention',
    title: 'Ovoz yozuvlarini saqlash',
    body: "Mashq tugagach ovozingiz saqlanadi, shunda keyin qayta tinglashingiz mumkin. Ruxsat bermasangiz, ovoz faqat izoh uchun ishlatiladi va saqlanmaydi.",
  },
  {
    kind: 'AudioHumanReview',
    title: 'Sifat nazorati uchun tinglash',
    body: 'Muharrir tanlangan yozuvlarni izoh sifatini tekshirish uchun tinglashi mumkin.',
  },
  {
    kind: 'ProductReminders',
    title: 'Eslatmalar',
    body: "Mashqni o'tkazib yuborsangiz, o'z vaqt mintaqangizda eslatma yuboramiz.",
  },
  {
    kind: 'ProductAnalytics',
    title: 'Mahsulot statistikasi',
    body: "Qaysi mashqlar foydali ekanini tushunish uchun anonim foydalanish ma'lumotlari.",
  },
]

export function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackBusy, setFeedbackBusy] = useState(false)

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
      "Hisobingiz va barcha yozuvlaringiz o'chiriladi. Tasdiqlash uchun O'CHIRISH deb yozing.",
    )
    if (confirmation !== "O'CHIRISH") return

    setBusy(true)
    try {
      await api.post('/auth/delete-account')
      await signOut()
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : "O'chirishda xatolik.")
      setBusy(false)
    }
  }

  async function submitComment() {
    const message = feedbackMessage.trim()
    if (message.length < 8) {
      setError('Xabarni biroz batafsilroq yozing.')
      return
    }

    setFeedbackBusy(true)
    setError(null)
    try {
      await api.post('/auth/feedback', {
        source: 'comment',
        message,
      })
      setFeedbackMessage('')
      setFeedbackOpen(false)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : "Xabarni yuborib bo'lmadi.")
    } finally {
      setFeedbackBusy(false)
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
        <SectionHeading>Ko'rinish</SectionHeading>
        <ThemeChoice />
      </section>

      <section>
        <SectionHeading>Maxfiylik va ruxsatlar</SectionHeading>
        <div className="space-y-3">
          {CONSENTS.map((consent) => {
            const isGranted = granted.get(consent.kind) ?? false

            return (
              <Card key={consent.kind} as="article">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-ink">{consent.title}</h3>
                    <UzHint>{consent.body}</UzHint>
                  </div>

                  <button
                    type="button"
                    aria-pressed={isGranted}
                    onClick={() => void toggle(consent.kind, !isGranted)}
                    className="flex shrink-0 items-center gap-3"
                  >
                    <span
                      className={cx(
                        'relative inline-flex h-7 w-12 rounded-full border transition-colors',
                        isGranted ? 'border-signal bg-signal' : 'border-hairline bg-ground-sunken',
                      )}
                    >
                      <span
                        className={cx(
                          'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
                          isGranted ? 'translate-x-6' : 'translate-x-0.5',
                        )}
                      />
                    </span>
                    <span className="text-sm font-medium text-ink-muted">
                      {isGranted ? 'Yoqilgan' : "O'chiq"}
                    </span>
                  </button>
                </div>
              </Card>
            )
          })}
        </div>

        <p className="text-support mt-3">
          Ruxsat bermasangiz ham mashqlar ishlaydi. Ovoz yozuvlari faqat siz ruxsat bergan
          taqdirdagina saqlanadi.
        </p>
      </section>

      <section>
        <SectionHeading>Obuna</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => navigate('/paywall')}>
            Obunani boshqarish
          </Button>
          <Button variant="secondary" onClick={() => setFeedbackOpen(true)}>
            Fikr yuborish
          </Button>
        </div>
      </section>

      <section>
        <SectionHeading>Hisob</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => void signOut().then(() => navigate('/'))}>
            Chiqish
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void deleteAccount()}>
            Hisobni o'chirish
          </Button>
        </div>
        <p className="text-support mt-3">
          Hisobni o'chirsangiz, barcha yozuvlar, transkriptlar va progress o'chiriladi. Buni
          qaytarib bo'lmaydi.
        </p>
      </section>

      {feedbackOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4"
          onClick={() => setFeedbackOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-ink">Fikr yuborish</h2>
            <p className="text-support mt-1">
              O'zingizning fikringizni shu yerga yozib qoldirsangiz bo'ladi. Taklif, e'tiroz va
              izohlaringiz bizga yetib boradi.
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Xabar</span>
              <textarea
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                rows={6}
                className="w-full rounded-xl border border-hairline bg-ground-raised px-4 py-3 text-base text-ink placeholder:text-ink-faint"
                placeholder="Holatingizni to'liq yozing"
              />
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setFeedbackOpen(false)} disabled={feedbackBusy}>
                Bekor qilish
              </Button>
              <Button type="button" onClick={() => void submitComment()} disabled={feedbackBusy}>
                {feedbackBusy ? 'Yuborilmoqda...' : 'Yuborish'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ThemeChoice() {
  const { theme, setTheme } = useTheme()

  const options: Array<{ value: Theme; label: string; hint: string }> = [
    { value: 'light', label: "Yorug'", hint: "Standart ko'rinish" },
    { value: 'dark', label: "Qorong'i", hint: 'Kechqurun mashq uchun' },
  ]

  /*
   * A real radio carries the selection. The previous cards signalled it only with a tinted
   * border, while the dark option always drew a solid black swatch — the boldest mark on the
   * row belonged to the option that was not chosen, which read as "dark is on".
   */
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Ko'rinish">
      {options.map((option) => (
        <RadioOption
          key={option.value}
          name="theme"
          checked={theme === option.value}
          onChange={() => setTheme(option.value)}
          label={
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cx(
                  'size-4 shrink-0 rounded-full border border-hairline',
                  option.value === 'light' ? 'bg-white' : 'bg-[#101216]',
                )}
              />
              <span>
                <span className="block font-semibold text-ink">{option.label}</span>
                <span className="text-support block">{option.hint}</span>
              </span>
            </span>
          }
        />
      ))}
    </div>
  )
}

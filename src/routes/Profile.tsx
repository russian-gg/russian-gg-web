import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { formatDate, levelDescriptionUz, phaseLabelUz } from '../lib/format'
import type { EntitlementView, ProgressView, SubscriptionStatus } from '../lib/types'
import { Badge, Button, Card, Rule, SectionHeading, Spinner, UzHint } from '../components/ui'

const STATUS_LABEL_UZ: Record<SubscriptionStatus, string> = {
  None: 'Obuna yo‘q',
  Trialing: 'Sinov davri',
  Active: 'Faol',
  PastDue: 'To‘lov kutilmoqda',
  Cancelled: 'Bekor qilingan',
  Expired: 'Muddati tugagan',
}

/**
 * The learner's own record: who they are, where they stand, what they have paid for. Kept
 * separate from Settings, which is switches and consents — this page answers "who am I here",
 * not "what do I want changed".
 */
export function Profile() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
  })

  if (progressLoading) return <Spinner />

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Talaba'
  const initials = name.trim().slice(0, 2).toUpperCase()

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-signal text-xl font-semibold text-on-signal"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{name}</h1>
          <p className="text-support truncate">{user?.email}</p>
        </div>
      </header>

      <section>
        <SectionHeading>Darajangiz</SectionHeading>
        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <LevelStat label="Tushunish" level={progress?.comprehensionLevel} />
            <LevelStat label="Gapirish" level={progress?.speakingLevel} />
          </div>
          <UzHint>
            Bu dastlabki baho, rasmiy til sertifikati emas. Har bir ovozli mashqdan keyin
            yangilanadi.
          </UzHint>
        </Card>
      </section>

      <section>
        <SectionHeading>Kursdagi o‘rningiz</SectionHeading>
        <Card>
          <dl className="grid gap-5 sm:grid-cols-3">
            <Stat
              label="Bugungi kun"
              value={progress ? `${progress.currentDay}/90` : null}
              hint={progress ? `${phaseLabelUz[progress.phase]} bosqichi` : undefined}
            />
            <Stat label="Bajarilgan mashqlar" value={progress?.totalMissionsCompleted ?? null} />
            <Stat
              label="Ketma-ket kunlar"
              value={progress?.streakDays ?? null}
              hint={progress && progress.streakDays > 0 ? 'Shu maromda davom eting' : undefined}
            />
          </dl>
        </Card>
      </section>

      <section>
        <SectionHeading>Obuna</SectionHeading>
        <Card>
          {entitlement ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-semibold text-ink">{entitlement.tier}</span>
                <Badge tone={entitlement.hasProAccess ? 'signal' : 'neutral'}>
                  {STATUS_LABEL_UZ[entitlement.status]}
                </Badge>
                {entitlement.paymentProcessing && <Badge tone="caution">To‘lov tekshirilmoqda</Badge>}
              </div>

              <Rule className="my-4" />

              <dl className="grid gap-5 sm:grid-cols-2">
                <Stat label="Ochilgan kunlar" value={`${entitlement.maxUnlockedDay}/90`} />
                <Stat
                  label={entitlement.cancelAtPeriodEnd ? 'Amal qiladi' : 'Keyingi to‘lov'}
                  value={
                    entitlement.currentPeriodEnd
                      ? formatDate(entitlement.currentPeriodEnd)
                      : entitlement.trialEndsAt
                        ? formatDate(entitlement.trialEndsAt)
                        : null
                  }
                />
              </dl>
            </>
          ) : (
            <p className="text-support">Obuna ma‘lumotini hozir yuklab bo‘lmadi.</p>
          )}

          <Button variant="secondary" className="mt-5" onClick={() => navigate('/paywall')}>
            Obunani boshqarish
          </Button>
        </Card>
      </section>

      <section>
        <SectionHeading>Hisob</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => navigate('/settings')}>
            Sozlamalar
          </Button>
          <Button variant="ghost" onClick={() => void signOut().then(() => navigate('/'))}>
            Chiqish
          </Button>
        </div>
        <p className="text-support mt-3">
          Hisobni o‘chirish va maxfiylik ruxsatlari Sozlamalar sahifasida.
        </p>
      </section>
    </div>
  )
}

function LevelStat({ label, level }: { label: string; level?: ProgressView['speakingLevel'] }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">{label}</p>
      {/* Unmeasured is never rendered as a zero or a bottom level (PRD §7). */}
      {level ? (
        <>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">{level}</p>
          <p className="text-support">{levelDescriptionUz[level]}</p>
        </>
      ) : (
        <p className="mt-1 text-3xl font-semibold tracking-tight text-ink-faint">Hali yo‘q</p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number | null
  hint?: string
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ink">
        {value === null || value === undefined ? <span className="text-ink-faint">—</span> : value}
      </dd>
      {hint && <p className="text-support">{hint}</p>}
    </div>
  )
}

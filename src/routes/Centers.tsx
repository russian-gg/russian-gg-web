import { useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react'
import { CalendarDays, ClipboardCheck, Mic, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Button, ErrorNote, Field } from '../components/ui'
import { Select } from '../components/forms/Select'
import { Reveal, Sequence, SequenceInView } from '../components/motion'
import { LocaleSwitch, Wordmark } from '../components/landing/chrome'
import { api, RequestError } from '../lib/api'
import { cx } from '../lib/cx'
import { fill, useT, type Dictionary } from '../lib/i18n'
import { rise, stagger } from '../lib/motion'
import type { CenterLeadRequest, CenterStudentBand } from '../lib/types'

const DEMO_ID = 'demo'

/**
 * The page for language centers, at /markazlar.
 *
 * One reader: the owner or the head teacher of a center, deciding whether this is worth a
 * call. Every section answers one question they ask in order — what is it, how does it start,
 * what do I get to see, what do my students get, and the four things they always ask — and
 * the page ends in the call itself. There is no price on it on purpose: a center's price is
 * agreed in the demo, and a number here would be the only thing anybody remembered.
 *
 * Public and not behind `PublicOnly`, so a signed-in learner who forwards it to their center
 * can open it too. The copy is in the locale dictionaries, like the landing page's.
 */
export function Centers() {
  const formRef = useRef<HTMLElement>(null)

  /** The hero's button and the header's both land on the form, and put the caret in it. */
  function toDemo() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    formRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    formRef.current?.querySelector<HTMLInputElement>('input:not([tabindex="-1"])')?.focus({ preventScroll: true })
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-ground text-ink">
      <TopBar onDemo={toDemo} />
      <main>
        <Hero onDemo={toDemo} />
        <Steps />
        <AdminPreview />
        <StudentOffer />
        <Faq />
        <DemoForm ref={formRef} />
      </main>
      <Footer />
    </div>
  )
}

/* -------------------------------------------------------------------------- chrome */

function TopBar({ onDemo }: { onDemo: () => void }) {
  const t = useT().centers
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-ground/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link to="/" className="flex items-center" aria-label="russian.gg">
          <Wordmark className="text-xl" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitch className="hidden sm:inline-flex" />
          <Button size="md" className="max-sm:px-4" onClick={onDemo}>
            {t.nav.demo}
          </Button>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  const t = useT()
  return (
    <footer className="border-t border-hairline bg-ground-sunken/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-4">
          <Wordmark className="text-lg" />
          <Link to="/" className="text-sm font-bold text-ink-muted transition-colors hover:text-ink">
            {t.centers.nav.home}
          </Link>
        </div>
        <LocaleSwitch className="self-start sm:self-auto" />
        <p className="text-xs text-ink-faint">{t.landing.footer.rights}</p>
      </div>
    </footer>
  )
}

/* ---------------------------------------------------------------------------- hero */

function Hero({ onDemo }: { onDemo: () => void }) {
  const t = useT().centers.hero
  return (
    <section className="relative overflow-hidden">
      {/* The landing page's soft brand field, so the two pages read as one site. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[48rem] -translate-x-1/2 rounded-full bg-signal-soft opacity-70 blur-3xl" />
      </div>

      <Sequence className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-5 lg:py-24" gap={stagger.wide}>
        <Reveal>
          <p className="inline-flex items-center rounded-[var(--radius-control)] border border-hairline bg-ground-raised px-3.5 py-1.5 text-xs font-extrabold tracking-[0.06em] text-signal-ink uppercase">
            {t.eyebrow}
          </p>
        </Reveal>
        <Reveal>
          <h1 className="mt-6 text-3xl leading-[1.1] font-extrabold tracking-tight text-ink sm:text-5xl">
            {t.title}
          </h1>
        </Reveal>
        <Reveal>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">{t.body}</p>
        </Reveal>
        <Reveal className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" block className="sm:w-auto" onClick={onDemo}>
            {t.cta}
          </Button>
          <a
            href="#how"
            className="inline-flex h-14 items-center justify-center rounded-[var(--radius-control)] px-7 text-base font-extrabold text-ink-muted transition-colors hover:text-ink"
          >
            {t.secondary}
          </a>
        </Reveal>
      </Sequence>
    </section>
  )
}

/* --------------------------------------------------------------------------- steps */

function Steps() {
  const t = useT().centers.steps
  return (
    <section id="how" className="scroll-mt-16 border-t border-hairline bg-ground-sunken/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-20">
        <SectionHead eyebrow={t.eyebrow} title={t.title} />

        {/* Numbered, because the order is the content: nobody adds students before the center
            is connected. Two by two on a tablet, one row from `lg`. */}
        <SequenceInView as="ol" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={stagger.wide}>
          {t.items.map((step, index) => (
            <Reveal
              key={step.title}
              as="li"
              variants={rise}
              className="h-full rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-6"
            >
                <span className="flex size-10 items-center justify-center rounded-full bg-signal text-base font-extrabold text-on-signal tabular-nums">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-extrabold leading-snug text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </Reveal>
          ))}
        </SequenceInView>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------- admin */

type SampleStatus = 'active' | 'idle' | 'new'

/*
  Invented students for the mock. Names and group codes read the same in every language; the
  rest — "today", "4 days ago", the status words — comes from the dictionary.
*/
const SAMPLE_STUDENTS: Array<{
  name: string
  group: string
  day: number
  last: { kind: 'today' } | { kind: 'yesterday' } | { kind: 'daysAgo'; days: number }
  status: SampleStatus
}> = [
  { name: 'Madina Karimova', group: 'A1-2', day: 24, last: { kind: 'today' }, status: 'active' },
  { name: 'Jasur Aliyev', group: 'A1-2', day: 11, last: { kind: 'daysAgo', days: 4 }, status: 'idle' },
  { name: 'Dilnoza Rahimova', group: 'A2-1', day: 38, last: { kind: 'yesterday' }, status: 'active' },
  { name: 'Sardor Tursunov', group: 'A1-3', day: 2, last: { kind: 'today' }, status: 'new' },
]

function lastActive(last: (typeof SAMPLE_STUDENTS)[number]['last'], t: Dictionary['centers']['admin']) {
  if (last.kind === 'today') return t.today
  if (last.kind === 'yesterday') return t.yesterday
  return fill(t.daysAgo, { days: last.days })
}

function StatusBadge({ status, t }: { status: SampleStatus; t: Dictionary['centers']['admin'] }) {
  if (status === 'active') return <Badge tone="milestone">{t.statusActive}</Badge>
  if (status === 'idle') return <Badge tone="caution">{t.statusIdle}</Badge>
  return <Badge tone="signal">{t.statusNew}</Badge>
}

/**
 * What the center admin sees, drawn rather than screenshotted.
 *
 * Built from the same tokens as the product, so it follows the theme and never shows a
 * dashboard that has since changed. On a phone each student is two lines — name and status,
 * then the three facts — because five columns at 360px are five truncated words; from `sm`
 * it is the table it stands for. Decorative as a whole: the paragraph beside it says what it
 * shows, so it is hidden from screen readers rather than read out as a fake table.
 */
function AdminPreview() {
  const t = useT().centers.admin
  const columns = 'sm:grid sm:grid-cols-[1.7fr_0.8fr_0.9fr_1.1fr_auto] sm:items-center sm:gap-4'

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHead eyebrow={t.eyebrow} title={t.title} align="left" />
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-muted">{t.body}</p>
        </div>

        <Reveal variants={rise}>
          <div aria-hidden="true" className="rounded-[var(--radius-card)] border border-hairline bg-ground-raised shadow-[0_24px_50px_-30px_rgb(45_118_221/0.45)]">
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-ink">{t.mockTitle}</span>
                <Badge size="sm">{t.mockCount}</Badge>
              </div>
              <span className="flex size-8 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
                <Plus strokeWidth={2.4} className="size-4" />
              </span>
            </div>

            <div className={cx('hidden px-5 py-2.5 text-[11px] font-extrabold tracking-[0.1em] text-ink-faint uppercase', columns)}>
              <span>{t.name}</span>
              <span>{t.group}</span>
              <span>{t.day}</span>
              <span>{t.lastActive}</span>
              <span>{t.status}</span>
            </div>

            <ul className="divide-y divide-hairline border-t border-hairline sm:border-t-0">
              {SAMPLE_STUDENTS.map((student) => (
                <li key={student.name} className={cx('px-5 py-3.5', columns)}>
                  <div className="flex items-center justify-between gap-3 sm:contents">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ground-sunken text-xs font-extrabold text-ink-muted">
                        {student.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')}
                      </span>
                      <span className="truncate text-sm font-bold text-ink">{student.name}</span>
                    </span>
                    <span className="sm:hidden">
                      <StatusBadge status={student.status} t={t} />
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-11 text-xs text-ink-muted sm:contents sm:text-sm">
                    <span>{student.group}</span>
                    <span className="tabular-nums">{fill(t.dayValue, { day: student.day })}</span>
                    <span>{lastActive(student.last, t)}</span>
                  </div>
                  <span className="hidden sm:block">
                    <StatusBadge status={student.status} t={t} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-center text-xs text-ink-faint">{t.mockNote}</p>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------------ students */

/** One mark per card, in the order of `students.items`; the first also shows the characters. */
const STUDENT_ICONS = [Mic, CalendarDays, ClipboardCheck] as const

function StudentOffer() {
  const t = useT().centers.students
  return (
    <section className="border-t border-hairline bg-ground-sunken/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-20">
        <SectionHead eyebrow={t.eyebrow} title={t.title} />

        <SequenceInView className="mt-10 grid gap-4 md:grid-cols-3" gap={stagger.wide}>
          {t.items.map((item, index) => {
            const Icon = STUDENT_ICONS[index] ?? Mic
            return (
              <Reveal key={item.title} variants={rise}>
                <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-6">
                  <span className="flex size-11 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
                    <Icon aria-hidden="true" strokeWidth={2.2} className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold text-ink">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{item.body}</p>
                  {index === 0 && (
                    <div aria-hidden="true" className="mt-5 flex -space-x-3">
                      {['pingvin', 'pero', 'panda'].map((name) => (
                        <img
                          key={name}
                          src={`/characters/${name}.webp`}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-14 rounded-full border-2 border-ground-raised bg-ground-sunken object-cover object-top"
                        />
                      ))}
                    </div>
                  )}
                </article>
              </Reveal>
            )
          })}
        </SequenceInView>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------------------- faq */

/**
 * `<details>` rather than a hand-built accordion: the browser already makes it a button,
 * announces it as expanded or collapsed, and opens it on Enter and Space. Find-in-page opens
 * it too, which is how somebody looking for "narx" gets to the answer.
 */
function Faq() {
  const t = useT().centers.faq
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-5 sm:py-20">
      <SectionHead eyebrow={t.eyebrow} title={t.title} />
      <div className="mt-8 space-y-3">
        {t.items.map((item) => (
          <details
            key={item.q}
            className="group rounded-[var(--radius-card)] border border-hairline bg-ground-raised open:border-signal-soft"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-extrabold text-ink [&::-webkit-details-marker]:hidden">
              {item.q}
              <Plus
                aria-hidden="true"
                strokeWidth={2.4}
                className="size-5 shrink-0 text-signal-ink transition-transform duration-200 group-open:rotate-45"
              />
            </summary>
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------- form */

const EMPTY_LEAD: Omit<CenterLeadRequest, 'studentBand'> & { studentBand: CenterStudentBand | '' } = {
  centerName: '',
  city: '',
  contactName: '',
  phone: '',
  studentBand: '',
  website: '',
}

/**
 * The demo request.
 *
 * Five things, all required, because a sales call needs every one of them and a form that
 * lets somebody skip the phone number has collected nothing. The server checks them again and
 * normalises the phone; its message is shown as it comes, in the visitor's language.
 *
 * `website` is a honeypot. It is in the DOM for a bot that fills every field it finds, and out
 * of reach for a person: off screen, out of the tab order, hidden from screen readers and
 * from autofill. A request that arrives with it filled is dropped by the server.
 */
function DemoForm({ ref }: { ref: Ref<HTMLElement> }) {
  const t = useT().centers.form
  const [lead, setLead] = useState(EMPTY_LEAD)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const set = (key: keyof typeof EMPTY_LEAD) => (value: string) =>
    setLead((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    const trimmed = {
      centerName: lead.centerName.trim(),
      city: lead.city.trim(),
      contactName: lead.contactName.trim(),
      phone: lead.phone.trim(),
    }
    if (!trimmed.centerName || !trimmed.city || !trimmed.contactName || !trimmed.phone || !lead.studentBand) {
      setError(t.required)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.post<void>('/public/center-leads', {
        ...trimmed,
        studentBand: lead.studentBand,
        website: lead.website,
      } satisfies CenterLeadRequest)
      setSent(true)
    } catch (caught) {
      // A rate limit arrives without a message of the app's own, so it gets ours.
      if (caught instanceof RequestError && caught.status === 429) setError(t.rateLimited)
      else setError(caught instanceof RequestError ? caught.message : t.failed)
    } finally {
      setBusy(false)
    }
  }

  const bands: Array<{ value: CenterStudentBand; label: string }> = [
    { value: 'under-50', label: t.bandUnder50 },
    { value: '50-200', label: t.band50to200 },
    { value: 'over-200', label: t.bandOver200 },
  ]

  return (
    <section ref={ref} id={DEMO_ID} className="scroll-mt-16 border-t border-hairline bg-ground-sunken/40">
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-5 sm:py-20">
        <SectionHead eyebrow={t.eyebrow} title={t.title} />
        <p className="mx-auto mt-3 max-w-md text-center text-base text-ink-muted">{t.body}</p>

        <div className="mt-8 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-5 sm:p-7">
          {sent ? (
            <div role="status" className="py-6 text-center">
              <h3 className="text-xl font-extrabold text-ink">{t.successTitle}</h3>
              <p className="mt-2 text-sm text-ink-muted">{t.successBody}</p>
            </div>
          ) : (
            <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
              <Field
                name="centerName"
                label={t.centerName}
                value={lead.centerName}
                onChange={(event) => set('centerName')(event.target.value)}
                autoComplete="organization"
                maxLength={200}
                required
              />
              <Field
                name="city"
                label={t.city}
                value={lead.city}
                onChange={(event) => set('city')(event.target.value)}
                autoComplete="address-level2"
                maxLength={100}
                required
              />
              <Field
                name="contactName"
                label={t.contactName}
                value={lead.contactName}
                onChange={(event) => set('contactName')(event.target.value)}
                autoComplete="name"
                maxLength={200}
                required
              />
              <Field
                name="phone"
                type="tel"
                inputMode="tel"
                label={t.phone}
                placeholder={t.phonePlaceholder}
                value={lead.phone}
                onChange={(event) => set('phone')(event.target.value)}
                autoComplete="tel"
                maxLength={32}
                required
              />

              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink">{t.students}</span>
                <Select
                  size="lg"
                  block
                  label={t.students}
                  placeholder={t.studentsPlaceholder}
                  value={lead.studentBand}
                  onChange={set('studentBand')}
                  options={bands}
                />
              </div>

              {/* The honeypot. See the note on this component. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  {t.website}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={lead.website}
                    onChange={(event) => set('website')(event.target.value)}
                  />
                </label>
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}

              <Button type="submit" size="lg" block disabled={busy}>
                {busy ? t.sending : t.submit}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- shared */

function SectionHead({
  eyebrow,
  title,
  align = 'center',
}: {
  eyebrow: string
  title: ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <div className={align === 'center' ? 'text-center' : undefined}>
      <p className="text-xs font-extrabold tracking-[0.14em] text-signal-ink uppercase">{eyebrow}</p>
      <h2
        className={cx(
          'mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl',
          align === 'center' && 'mx-auto max-w-2xl',
        )}
      >
        {title}
      </h2>
    </div>
  )
}

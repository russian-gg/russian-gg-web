import { useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react'
import { ArrowRight, Building2, CalendarDays, Check, ClipboardCheck, Mic, Plus } from 'lucide-react'
import { Badge, Button, ErrorNote, Field } from '../ui'
import { Select } from '../forms/Select'
import { Reveal, SequenceInView } from '../motion'
import { Spotlight, Stars, WordsIn } from './alive'
import { Aurora } from './effects'
import { api, RequestError } from '../../lib/api'
import { cx } from '../../lib/cx'
import { fill, useT, type Dictionary } from '../../lib/i18n'
import { rise, stagger } from '../../lib/motion'
import type { CenterLeadRequest, CenterStudentBand } from '../../lib/types'

const DEMO_ID = 'centers-demo'

/**
 * Everything a language center needs to know, as one section of the landing page (`#centers`).
 *
 * One reader: the owner or the head teacher of a center, deciding whether this is worth a
 * call. The blocks answer what they ask, in order — what is it, how does it start, what do I
 * get to see, what do my students get — and it ends in the call itself. There is no price here on purpose: a center's price is agreed in the demo, and
 * a number would be the only thing anybody remembered.
 *
 * It used to be a page of its own at /markazlar; that address now lands here.
 */
export function CentersSection() {
  const t = useT()
  const hero = t.centers.hero
  const formRef = useRef<HTMLDivElement>(null)

  /** The button under the heading lands on the form, and puts the caret in it. */
  function toDemo() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    formRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    formRef.current?.querySelector<HTMLInputElement>('input:not([tabindex="-1"])')?.focus({ preventScroll: true })
  }

  return (
    <section id="centers" className="relative isolate scroll-mt-20 overflow-hidden py-16 sm:py-24">
      <Aurora blobs={2} grid={false} className="opacity-50" />
      <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <p className="glass inline-flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-xs font-extrabold tracking-[0.06em] text-signal-ink uppercase">
              <span className="grid size-6 place-items-center rounded-full bg-signal text-on-signal">
                <Building2 aria-hidden="true" strokeWidth={2.2} className="size-3.5" />
              </span>
              {hero.eyebrow}
            </p>
            <h2 className="mt-5 text-3xl leading-[1.12] font-black tracking-tight text-balance text-ink sm:text-4xl">
              <WordsIn text={hero.title} />
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">{hero.body}</p>
            <Button size="lg" block className="mt-7 gap-2 sm:w-auto" onClick={toDemo}>
              {hero.cta}
              <ArrowRight aria-hidden="true" strokeWidth={2.2} className="size-[18px]" />
            </Button>
          </div>

          {/* How it starts, beside what the center then sees. */}
          <div className="mt-12 grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <Steps />
            <AdminPreview />
          </div>

          <StudentOffer />

          {/* The call itself. */}
          <DemoForm ref={formRef} />
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------- steps */

function Steps() {
  const t = useT().centers.steps
  return (
    <div>
      <BlockTitle>{t.title}</BlockTitle>
      {/* Numbered, because the order is the content: nobody adds students before the center
          is connected. A line joins the numbers, so it reads as one path. */}
      <SequenceInView as="ol" className="mt-6" gap={stagger.wide}>
        {t.items.map((step, index) => (
          <Reveal key={step.title} as="li" variants={rise} className="relative flex gap-4 pb-6 last:pb-0">
            {index < t.items.length - 1 && (
              <span aria-hidden="true" className="absolute top-10 bottom-0 left-5 w-0.5 -translate-x-1/2 rounded-full bg-signal/20" />
            )}
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-signal text-base font-extrabold text-on-signal tabular-nums shadow-[0_3px_0_var(--color-signal-depth)]">
              {index + 1}
            </span>
            <div className="min-w-0 pt-1.5">
              <h4 className="text-base leading-snug font-extrabold text-ink">{step.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </SequenceInView>
    </div>
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
    <div>
      <div>
        <div>
          <BlockTitle>{t.title}</BlockTitle>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">{t.body}</p>
        </div>

        <Reveal variants={rise} className="mt-6">
          <div className="alive-beam rounded-3xl">
          <div aria-hidden="true" className="overflow-hidden rounded-3xl border border-hairline bg-ground-raised shadow-[0_24px_50px_-30px_rgb(45_118_221/0.45)]">
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
          </div>
          <p className="mt-3 text-center text-xs text-ink-faint">{t.mockNote}</p>
        </Reveal>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ students */

/** One mark per card, in the order of `students.items`; the first also shows the characters. */
const STUDENT_ICONS = [Mic, CalendarDays, ClipboardCheck] as const

function StudentOffer() {
  const t = useT().centers.students
  return (
    <div className="mt-12 sm:mt-16">
      <div>
        <BlockTitle center>{t.title}</BlockTitle>

        <SequenceInView className="mt-6 grid gap-4 md:grid-cols-3" gap={stagger.wide}>
          {t.items.map((item, index) => {
            const Icon = STUDENT_ICONS[index] ?? Mic
            return (
              <Reveal key={item.title} variants={rise}>
                <Spotlight className="alive-lift h-full rounded-3xl">
                <article className="glass sheen flex h-full flex-col rounded-3xl p-6">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-[image:var(--spectrum)] text-white shadow-[0_10px_20px_-10px_var(--color-signal-depth)]">
                    <Icon aria-hidden="true" strokeWidth={2.2} className="size-5" />
                  </span>
                  <h4 className="mt-4 text-lg font-extrabold text-ink">{item.title}</h4>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-muted">{item.body}</p>
                </article>
                </Spotlight>
              </Reveal>
            )
          })}
        </SequenceInView>
      </div>
    </div>
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
function DemoForm({ ref }: { ref: Ref<HTMLDivElement> }) {
  const t = useT().centers.form
  const band = useT().landing.centersBand
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
    <div
      ref={ref}
      id={DEMO_ID}
      className="mt-12 scroll-mt-24 overflow-hidden rounded-[2rem] border border-hairline bg-ground-raised shadow-[0_30px_70px_-30px_rgb(15_27_61/0.45)] sm:mt-16"
    >
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="landing-night flex flex-col p-7 sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <span className="aurora__blob -top-24 -left-16 h-72 w-80 bg-[#3b6fe0] [--aurora-opacity:0.3]" />
            <span className="aurora__blob -right-20 -bottom-24 h-72 w-80 bg-[#13a8c8] [--aurora-opacity:0.18] [--drift-delay:-8s]" />
          </div>
          <Stars />
          <div className="relative z-10 flex flex-1 flex-col">
            <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15">
              <Building2 strokeWidth={2} className="size-6" />
            </span>
            <h3 className="mt-5 text-2xl leading-tight font-black tracking-tight text-white sm:text-3xl">{t.title}</h3>
            <p className="mt-3 max-w-md text-base leading-relaxed text-[var(--night-ink-muted)]">{t.body}</p>
            <ul className="mt-6 space-y-3">
              {[band.fact1, band.fact2, band.fact3].map((fact) => (
                <li key={fact} className="flex items-center gap-3 text-sm font-bold text-white">
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--night-accent)]/20 text-[var(--night-accent)]">
                    <Check strokeWidth={3} className="size-3.5" />
                  </span>
                  {fact}
                </li>
              ))}
            </ul>
            {/* The three characters the students will be talking to. */}
            <div aria-hidden="true" className="mt-auto flex -space-x-3 pt-8">
              {['pingvin', 'pero', 'panda'].map((name) => (
                <img
                  key={name}
                  src={`/characters/${name}.webp`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-14 rounded-full border-2 border-[var(--night)] bg-white/10 object-cover object-top"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          {sent ? (
            <div role="status" className="py-6 text-center">
              <h4 className="text-xl font-extrabold text-ink">{t.successTitle}</h4>
              <p className="mt-2 text-sm text-ink-muted">{t.successBody}</p>
            </div>
          ) : (
            <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
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
    </div>
  )
}

/* -------------------------------------------------------------------------- shared */

/** The title of one block of the section. */
function BlockTitle({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <h3 className={cx('text-xl font-black tracking-tight text-ink sm:text-2xl', center && 'text-center')}>{children}</h3>
  )
}

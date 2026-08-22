import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LinkButton } from '../components/ui'
import {
  HomeScreenMock,
  ProductPreview,
  ReelThumb,
  RunnerArt,
  SawArt,
  StepMark,
} from '../components/landing/visuals'
import { cx } from '../lib/cx'
import { fill, LOCALES, useLocale, useT } from '../lib/i18n'
import { SUPPORT_TELEGRAM_URL } from '../lib/support'

/**
 * The public face of Russian.gg. Two audiences read this page: a learner deciding whether to
 * speak into a microphone, and an investor deciding whether this is a business. Both are served
 * by the same thing — showing the real product and the real numbers, not adjectives about them.
 *
 * The hero leads into the product; every section after it answers one honest question an
 * investor asks in order (does anyone use it, how does it work, is it sticky, does it earn),
 * and the last word is the PRD's own promise: this is practice, not a certificate.
 */
export function Landing() {
  const t = useT().landing

  return (
    <div className="min-h-dvh bg-ground text-ink">
      <TopBar />
      <main>
        <Hero />
        {/* A full-bleed reels strip right after the hero: the first proof that real people use
            this, before a single claim about it. */}
        <ReelMarquee />
        <StatBand />
        <Method />
        <Games />
        <Mobile />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />

      {/* Said plainly, as the PRD requires: no certification, no replacement for a teacher. */}
      <p className="mx-auto max-w-6xl px-5 pb-16 text-center text-xs leading-relaxed text-ink-faint">
        {t.disclaimer}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- chrome */

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('font-extrabold tracking-tight text-ink', className)}>
      russian<span className="text-signal">.gg</span>
    </span>
  )
}

function LocaleSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <div
      className={cx(
        'inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border border-hairline p-0.5',
        className,
      )}
      role="group"
      aria-label="Til / Язык / Language"
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={cx(
            'rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-extrabold uppercase transition-colors',
            locale === code ? 'bg-signal text-on-signal' : 'text-ink-muted hover:text-ink',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )
}

function TopBar() {
  const t = useT().landing
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-ground/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <a href="#top" className="flex items-center" aria-label="russian.gg">
          <Wordmark className="text-xl" />
        </a>

        <nav className="hidden items-center gap-7 text-sm font-bold text-ink-muted md:flex">
          <a className="transition-colors hover:text-ink" href="#method">
            {t.nav.method}
          </a>
          <a className="transition-colors hover:text-ink" href="#games">
            {t.nav.games}
          </a>
          <a className="transition-colors hover:text-ink" href="#pricing">
            {t.nav.pricing}
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitch className="hidden sm:inline-flex" />
          <LinkButton to="/signin" variant="ghost" size="md" className="hidden sm:inline-flex">
            {t.nav.signIn}
          </LinkButton>
          <LinkButton to="/signup" size="md">
            {t.nav.getStarted}
          </LinkButton>
        </div>
      </div>
    </header>
  )
}

/* ---------------------------------------------------------------------------- hero */

function Hero() {
  const t = useT().landing
  return (
    <section id="top" className="relative overflow-hidden">
      {/* A single soft field of the brand tint. Reads as a glow in light, a deep wash in dark,
          because signal-soft is a token that flips with the theme. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[38rem] w-[54rem] -translate-x-1/2 rounded-full bg-signal-soft opacity-70 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <p className="inline-flex items-center rounded-[var(--radius-control)] border border-hairline bg-ground-raised px-3.5 py-1.5 text-xs font-extrabold tracking-[0.06em] text-signal-ink uppercase">
            {t.hero.eyebrow}
          </p>

          <h1 className="mt-6 text-4xl leading-[1.08] font-extrabold tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
            {t.headline}
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">{t.body}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <LinkButton to="/signup" className="w-full sm:w-auto">
              {t.hero.primaryCta}
            </LinkButton>
            <LinkButton to="/onboarding" variant="secondary" className="w-full sm:w-auto">
              {t.hero.secondaryCta}
            </LinkButton>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-bold text-ink">{t.hero.socialProof}</span>
            <span className="inline-flex items-center gap-1.5 text-ink-faint">
              <Tick />
              {t.hero.trustNote}
            </span>
          </div>
        </div>

        <div className="lg:pl-6">
          <ProductPreview
            day={t.hero.mockDay}
            objective={t.hero.mockObjective}
            hint={t.hero.mockHint}
            action={t.hero.mockAction}
          />
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------- stats */

/**
 * The numbers are real, taken from the admin panel's last-30-days view, and rounded down with a
 * "+" so the page does not go stale between reads. They are the honest ones an investor checks:
 * how many use it, how many keep using it, how well it converts to an install, how often it is
 * opened. Kept as figures here — a stat value is not language, only its label is.
 */
const STATS = [
  { value: '2 500+', key: 'learners' as const },
  { value: '2 400+', key: 'active' as const },
  { value: '25%', key: 'installRate' as const },
  { value: '11 800+', key: 'opens' as const },
]

function StatBand() {
  const t = useT().landing
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <SectionEyebrow>{t.stats.eyebrow}</SectionEyebrow>
      <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        {t.stats.title}
      </h2>
      <p className="mt-3 max-w-xl text-base text-ink-muted">{t.stats.subtitle}</p>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-hairline lg:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.key} className="bg-ground-raised px-6 py-8">
            <dd className="text-4xl font-extrabold tracking-tight text-signal-ink tabular-nums sm:text-[2.75rem]">
              {stat.value}
            </dd>
            <dt className="mt-2 text-sm leading-snug font-semibold text-ink-muted">
              {t.stats[stat.key]}
            </dt>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-ink-faint">{t.stats.note}</p>
    </section>
  )
}

/* --------------------------------------------------------------------------- method */

function Method() {
  const dict = useT()
  const t = dict.landing
  const dayTemplate = dict.common.day
  const steps = [
    { title: t.method.step1Title, body: t.method.step1Body },
    { title: t.method.step2Title, body: t.method.step2Body },
    { title: t.method.step3Title, body: t.method.step3Body },
  ]
  const milestones = [
    { day: 7, text: t.milestone7 },
    { day: 30, text: t.milestone30 },
    { day: 90, text: t.milestone90 },
  ]
  return (
    <section id="method" className="border-t border-hairline bg-ground-sunken/40">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionEyebrow>{t.method.eyebrow}</SectionEyebrow>
        <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {t.method.title}
        </h2>
        <p className="mt-3 max-w-xl text-base text-ink-muted">{t.method.subtitle}</p>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-6"
            >
              <StepMark n={index + 1} />
              <h3 className="mt-4 text-lg font-extrabold text-ink">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-6 sm:p-8">
          <h3 className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
            {t.method.milestonesTitle}
          </h3>
          <ul className="mt-5 space-y-5">
            {milestones.map((milestone) => (
              <li key={milestone.day} className="flex gap-5">
                <span className="w-16 shrink-0 text-sm font-extrabold tracking-[0.08em] whitespace-nowrap text-signal-ink uppercase">
                  {fill(dayTemplate, { day: milestone.day })}
                </span>
                <span className="text-base text-ink">{milestone.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------- games */

function Games() {
  const t = useT().landing
  const games = [
    { title: t.games.runnerTitle, body: t.games.runnerBody, art: <RunnerArt /> },
    { title: t.games.sawTitle, body: t.games.sawBody, art: <SawArt /> },
  ]
  return (
    <section id="games" className="mx-auto max-w-6xl px-5 py-20">
      <SectionEyebrow>{t.games.eyebrow}</SectionEyebrow>
      <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        {t.games.title}
      </h2>
      <p className="mt-3 max-w-xl text-base text-ink-muted">{t.games.subtitle}</p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {games.map((game) => (
          <article
            key={game.title}
            className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-ground-raised"
          >
            <div className="relative h-44 overflow-hidden border-b border-hairline bg-gradient-to-br from-signal-soft via-ground-raised to-ground-raised">
              {game.art}
            </div>
            <div className="p-6">
              <h3 className="text-lg font-extrabold text-ink">{game.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{game.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- creators */

/**
 * The real creators who ran the Instagram campaigns. `title` is a neutral, topical caption for
 * each reel — deliberately not an invented first-person testimonial put in a real person's
 * mouth. The card links to the reel; the thumbnail stays an abstract field rather than a
 * portrait. To use a reel's own wording, replace `title` with its caption.
 */
type Creator = { handle: string; title: string; url: string; cover: string }

const CREATORS: Creator[] = [
  { handle: '@fateemajan__', title: '90 kunda rus tilida gapirishni boshlash', url: 'https://www.instagram.com/reel/DbpH5-BhAzP/', cover: '/reels/fateemajan__.jpg' },
  { handle: '@with_jeren', title: 'Ruscha gapirsam, inglizcha aralashib ketadimi?', url: 'https://www.instagram.com/reel/Dbv8Qpooa-p/', cover: '/reels/with_jeren.jpg' },
  { handle: '@the_sakinaa', title: 'Har kuni 15 daqiqa ovozli mashq', url: 'https://www.instagram.com/reel/DbzrlaWsxcW/', cover: '/reels/the_sakinaa.jpg' },
  { handle: '@1bonuyem', title: "Rus tilini tez gapirishning yo'li", url: 'https://www.instagram.com/reel/Dbthm3zxbs8/', cover: '/reels/1bonuyem.jpg' },
  { handle: '@abdulxoliq.ustoz', title: "Rus tilini o'rganishning amaliy usuli", url: 'https://www.instagram.com/reel/DbyOkbvNA29/', cover: '/reels/abdulxoliq.ustoz.jpg' },
  { handle: '@blog_rano', title: 'Ish uchun rus tili: qayerdan boshlash', url: 'https://www.instagram.com/reel/DbtLqBPNJZt/', cover: '/reels/blog_rano.jpg' },
  { handle: '@yasina_nadirbekovna', title: 'Rus tilida ishonch bilan gapiring', url: 'https://www.instagram.com/reel/Db3EzzVMynp/', cover: '/reels/yasina_nadirbekovna.jpg' },
]

/**
 * The reels strip. A contained header carries the words; the strip itself is full-bleed — it
 * runs edge to edge with no page gutter, and loops by rendering the cards twice and translating
 * the track by exactly one half. The second copy is `aria-hidden` so a screen reader reads each
 * reel once.
 */
function ReelMarquee() {
  const t = useT().landing
  return (
    <section className="overflow-hidden border-b border-hairline bg-ground-sunken/40 py-12">
      <div className="mx-auto mb-8 flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5">
        <div>
          <SectionEyebrow>{t.creators.eyebrow}</SectionEyebrow>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t.creators.title}
          </h2>
        </div>
        <p className="text-sm font-semibold text-ink-muted">
          <span className="font-extrabold text-signal-ink tabular-nums">480+</span>{' '}
          {t.creators.channelStat}
        </p>
      </div>

      {/* Full-bleed: no max-width, no horizontal padding — the strip fills the viewport width. */}
      <div className="reel-viewport w-full overflow-hidden">
        <div
          className="reel-track flex w-max hover:[animation-play-state:paused]"
          style={{ animation: 'var(--animate-marquee)' }}
        >
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
              {CREATORS.map((creator, index) => (
                <li key={`${copy}-${creator.handle}`} className="mr-5 w-[15rem] shrink-0">
                  <CreatorCard creator={creator} index={index} watch={t.creators.watch} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  )
}

/** One creator card. A link that opens the reel in Instagram when a `url` is set; otherwise a
 *  plain figure, so the placeholder state renders without a dead link. */
function CreatorCard({
  creator,
  index,
  watch,
}: {
  creator: Creator
  index: number
  watch: string
}) {
  const cardClass =
    'flex h-full w-full flex-col rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-4'
  const inner = (
    <>
      <ReelThumb seed={index} watch={watch} cover={creator.cover} />
      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-sm font-extrabold text-signal-ink">
          {creator.handle}
          {creator.url && <ExternalGlyph />}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-snug font-semibold text-ink">
          {creator.title}
        </p>
      </div>
    </>
  )

  if (!creator.url) {
    return <figure className={cardClass}>{inner}</figure>
  }

  return (
    <a
      href={creator.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${creator.handle} — Instagram`}
      className={cx(
        cardClass,
        'transition-[transform,border-color,box-shadow] duration-150',
        'hover:-translate-y-0.5 hover:border-ink-faint hover:shadow-[0_10px_24px_-16px_rgb(45_118_221/0.55)]',
      )}
    >
      {inner}
    </a>
  )
}

/* ---------------------------------------------------------------------------- mobile */

function Mobile() {
  const t = useT().landing
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 flex justify-center lg:order-1">
          <HomeScreenMock installedLabel={`1 100+ ${t.mobile.installedStat}`} />
        </div>

        <div className="order-1 lg:order-2">
          <SectionEyebrow>{t.mobile.eyebrow}</SectionEyebrow>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t.mobile.title}
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-muted">{t.mobile.body}</p>

          <div className="mt-8 space-y-3">
            <div className="flex items-start gap-4 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-5">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-signal-soft">
                <Tick />
              </span>
              <div>
                <div className="text-base font-extrabold text-ink">{t.mobile.pwaTitle}</div>
                <p className="mt-1 text-sm text-ink-muted">{t.mobile.pwaBody}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-5">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-ground-sunken">
                <PhoneGlyph />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-ink">{t.mobile.nativeTitle}</span>
                  <span className="rounded-[var(--radius-control)] bg-caution-soft px-2 py-0.5 text-[11px] font-extrabold text-caution">
                    {t.mobile.nativeBadge}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{t.mobile.nativeBody}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------- pricing */

function Pricing() {
  const t = useT().landing
  return (
    <section id="pricing" className="border-t border-hairline bg-ground-sunken/40">
      <div className="mx-auto max-w-5xl px-5 py-20">
        <div className="text-center">
          <SectionEyebrow center>{t.pricing.eyebrow}</SectionEyebrow>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t.pricing.title}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-ink-muted">{t.pricing.subtitle}</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
          <PlanCard
            title={t.pricing.freeTitle}
            price={t.pricing.freePrice}
            unit={t.pricing.freeUnit}
            body={t.pricing.freeBody}
            features={t.pricing.freeFeatures}
            cta={<LinkButton to="/signup" variant="secondary" block>{t.pricing.freeCta}</LinkButton>}
          />
          <PlanCard
            featured
            badge={t.pricing.proBadge}
            title={t.pricing.proTitle}
            price={t.pricing.proPrice}
            unit={t.pricing.proUnit}
            body={t.pricing.proBody}
            features={t.pricing.proFeatures}
            note={t.pricing.proAlt}
            cta={<LinkButton to="/signup" block>{t.pricing.proCta}</LinkButton>}
          />
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">{t.pricing.payNote}</p>
      </div>
    </section>
  )
}

function PlanCard({
  title,
  price,
  unit,
  body,
  features,
  cta,
  note,
  badge,
  featured = false,
}: {
  title: string
  price: string
  unit: string
  body: string
  features: string[]
  cta: ReactNode
  note?: string
  badge?: string
  featured?: boolean
}) {
  return (
    <div
      className={cx(
        'flex flex-col rounded-[var(--radius-card)] bg-ground-raised p-7',
        featured ? 'border-2 border-signal' : 'border border-hairline',
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-ink">{title}</h3>
        {badge && (
          <span className="rounded-[var(--radius-control)] bg-signal px-3 py-1 text-xs font-extrabold text-on-signal">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tracking-tight text-ink tabular-nums">{price}</span>
        <span className="text-sm font-bold text-ink-muted">{unit}</span>
      </div>
      {note && <p className="mt-1 text-sm font-semibold text-signal-ink">{note}</p>}

      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-[15px] text-ink">
            <span className="mt-0.5">
              <Tick />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-7">{cta}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- final cta */

function FinalCta() {
  const t = useT().landing
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-signal-soft px-6 py-14 text-center sm:px-12">
        <h2 className="mx-auto max-w-2xl text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {t.final.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-ink-muted">{t.final.body}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <LinkButton to="/signup" className="w-full sm:w-auto">
            {t.final.cta}
          </LinkButton>
          <Link to="/signin" className="text-sm font-bold text-signal-ink hover:underline">
            {t.final.signIn}
          </Link>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- footer */

function Footer() {
  const t = useT().landing
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <Wordmark className="text-xl" />
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.footer.tagline}</p>
          <p className="mt-2 text-xs text-ink-faint">{t.footer.madeIn}</p>
        </div>

        <div className="flex flex-col gap-5 sm:items-end">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink-muted">
            <a className="hover:text-ink" href="#method">
              {t.nav.method}
            </a>
            <a className="hover:text-ink" href="#games">
              {t.nav.games}
            </a>
            <a className="hover:text-ink" href="#pricing">
              {t.nav.pricing}
            </a>
            <Link className="hover:text-ink" to="/signin">
              {t.nav.signIn}
            </Link>
            <a
              className="hover:text-ink"
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
            >
              Telegram
            </a>
          </nav>
          <LocaleSwitch />
        </div>
      </div>
      <div className="border-t border-hairline">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-ink-faint">{t.footer.rights}</p>
      </div>
    </footer>
  )
}

/* --------------------------------------------------------------------------- shared */

function SectionEyebrow({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <p
      className={cx(
        'text-xs font-extrabold tracking-[0.14em] text-signal-ink uppercase',
        center && 'text-center',
      )}
    >
      {children}
    </p>
  )
}

/** A small signal-ink check, for feature lists and trust marks. */
function Tick() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-signal-ink stroke-[2.4]">
      <path d="m4 10.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-ink-muted stroke-[2]">
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 18h2" strokeLinecap="round" />
    </svg>
  )
}

/** The small "opens elsewhere" arrow beside a linked handle. */
function ExternalGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-3.5 fill-none stroke-signal-ink stroke-[2.4]"
    >
      <path d="M9 6h9v9M18 6 7 17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

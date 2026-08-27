import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LinkButton } from '../components/ui'
import { ProductPreview, ReelThumb } from '../components/landing/visuals'
import { cx } from '../lib/cx'
import { fill, LOCALES, useLocale, useT } from '../lib/i18n'
import { SUPPORT_INSTAGRAM_URL, SUPPORT_TELEGRAM_URL } from '../lib/support'

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
  return (
    <div className="min-h-dvh bg-ground text-ink">
      <TopBar />
      <main>
        <Hero />
        {/* A full-bleed reels strip right after the hero: the first proof that real people use
            this, before a single claim about it. */}
        <ReelMarquee />
        {/* The problem-and-solution narrative, told by the three characters. */}
        <Characters />
        <Games />
        <Mobile />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

/* -------------------------------------------------------------------------- chrome */

/**
 * `onSignal` is the variant for a signal-filled surface, where the mark's own accent colour is
 * the background it sits on. The two-tone reading survives by dropping `.gg` to a lighter tint
 * of the label instead — the mark stays the mark rather than flattening to one solid word.
 */
function Wordmark({ className, onSignal = false }: { className?: string; onSignal?: boolean }) {
  return (
    <span
      className={cx('font-extrabold tracking-tight', onSignal ? 'text-on-signal' : 'text-ink', className)}
    >
      russian<span className={onSignal ? 'text-on-signal/70' : 'text-signal'}>.gg</span>
    </span>
  )
}

function LocaleSwitch({ className, onSignal = false }: { className?: string; onSignal?: boolean }) {
  const { locale, setLocale } = useLocale()
  return (
    <div
      className={cx(
        'inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border p-0.5',
        onSignal ? 'border-on-signal/35' : 'border-hairline',
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
            // On a signal fill the selected pill inverts: the label colour becomes the fill and
            // the hue moves to the text, which is what `signal-ink` exists for.
            locale === code
              ? onSignal
                ? 'bg-on-signal text-signal-ink'
                : 'bg-signal text-on-signal'
              : onSignal
                ? 'text-on-signal/80 hover:text-on-signal'
                : 'text-ink-muted hover:text-ink',
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

/* ------------------------------------------------------------------------ characters */

/** The three product characters carry the pitch: Panda names the problem every learner feels,
 *  the Penguin and Pero answer it. The image and colour of each are fixed here; the words are
 *  localised. Reuses id="method" so the nav's "how it works" link still lands here. */
type CharacterKey = 'panda' | 'pingvin' | 'pero'

const CHARACTERS: Array<{
  key: CharacterKey
  n: string
  status: 'problem' | 'solution'
  image: string
  accent: string
  bubble: string
}> = [
  // `bubble` is a vibrant Duolingo-style fill (white text on it); `accent` is the soft same-hue
  // card border. Both are fixed brand illustration colours, not theme tokens.
  { key: 'panda', n: '01', status: 'problem', image: '/characters/panda.png', accent: '#f3a9cb', bubble: '#e83e8c' },
  { key: 'pingvin', n: '02', status: 'solution', image: '/characters/pingvin.png', accent: '#9cc3f7', bubble: '#1c8fe0' },
  { key: 'pero', n: '03', status: 'solution', image: '/characters/pero.png', accent: '#f3d178', bubble: '#e08a0a' },
]

function Characters() {
  const t = useT().landing.characters
  return (
    <section id="method" className="border-t border-hairline bg-ground-sunken/40">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-signal-soft px-4 py-1.5 text-xs font-extrabold tracking-[0.12em] text-signal-ink uppercase">
            <SparkleGlyph />
            {t.eyebrow}
          </span>
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-[1.15] tracking-tight text-ink sm:text-4xl">
            {t.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
            {t.subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CHARACTERS.map((character) => (
            <CharacterCard key={character.key} character={character} />
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-6 rounded-[var(--radius-card)] border border-hairline bg-ground-raised px-6 py-7 sm:flex-row sm:items-center sm:px-9">
          <div>
            <h3 className="text-lg font-extrabold text-ink sm:text-xl">{t.ctaTitle}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t.ctaBody}</p>
          </div>
          <LinkButton to="/signup" className="w-full shrink-0 sm:w-auto">
            {t.ctaButton}
          </LinkButton>
        </div>
      </div>
    </section>
  )
}

function CharacterCard({ character }: { character: (typeof CHARACTERS)[number] }) {
  const t = useT().landing.characters
  const name = t.names[character.key]
  const { quote, caption } = t[character.key]
  const isProblem = character.status === 'problem'

  return (
    <article
      className="flex flex-col rounded-[var(--radius-card)] border-2 bg-ground-raised p-5"
      style={{ borderColor: character.accent }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-[var(--radius-control)] bg-ground-sunken px-3 py-1 text-[11px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
          {fill(t.stage, { n: character.n })} · {name}
        </span>
        {isProblem ? (
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-danger-soft px-2.5 py-1 text-[11px] font-extrabold text-danger">
            <AlertGlyph />
            {t.statusProblem}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-milestone-soft px-2.5 py-1 text-[11px] font-extrabold text-milestone">
            <CheckGlyph />
            {t.statusSolution}
          </span>
        )}
      </div>

      {/* The character's line, in a vibrant Duolingo-style bubble with a tail. The colour is the
          character's own; white text sits on it. */}
      <div className="relative mt-4">
        <div
          className="rounded-2xl p-4 shadow-[0_12px_30px_-14px_rgb(17_24_39/0.4)]"
          style={{ backgroundColor: character.bubble }}
        >
          <p className="text-[15px] leading-relaxed font-medium text-white">«{quote}»</p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/25 pt-3">
            <span className="text-xs font-semibold text-white/80">
              {t.voicePrefix}: {name}
            </span>
            <ListenButton label={t.listen} text={quote} />
          </div>
        </div>
        <span
          className="absolute -bottom-1.5 left-8 size-4 rotate-45 rounded-[2px]"
          style={{ backgroundColor: character.bubble }}
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-1 items-end justify-center py-6">
        <img
          src={character.image}
          alt={name}
          loading="lazy"
          className="h-40 w-auto object-contain drop-shadow-[0_14px_22px_rgb(17_24_39/0.16)]"
        />
      </div>

      <div className="border-t border-hairline pt-5">
        <p className="text-[15px] leading-relaxed text-ink-muted">{caption}</p>
      </div>
    </article>
  )
}

/** Reads the line aloud with the browser's speech engine — a stand-in until real character-voice
 *  audio is dropped in. Silent where speech synthesis is unavailable. */
function ListenButton({ label, text }: { label: string; text: string }) {
  function speak() {
    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
    } catch {
      // No speech synthesis; the button simply does nothing.
    }
  }
  return (
    <button
      type="button"
      onClick={speak}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-white/10 px-3 py-1.5 text-xs font-extrabold text-white transition-colors hover:bg-white/20"
    >
      <SpeakerGlyph />
      {label}
    </button>
  )
}

function SparkleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
      <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2Z" />
    </svg>
  )
}

function AlertGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3 fill-none stroke-current stroke-[2.4]">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6" strokeLinecap="round" />
      <path d="M12 16.5v.5" strokeLinecap="round" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3 fill-none stroke-current stroke-[2.6]">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpeakerGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
      <path d="M4 9v6h3l5 4V5L7 9H4Z" />
      <path
        d="M16 8.5a4 4 0 0 1 0 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ---------------------------------------------------------------------------- games */

function Games() {
  const t = useT().landing
  const games = [
    { title: t.games.runnerTitle, body: t.games.runnerBody, image: '/games/rod-runner.jpg' },
    { title: t.games.sawTitle, body: t.games.sawBody, image: '/games/lazer.jpg' },
  ]

  return (
    <section id="games" className="mx-auto max-w-6xl px-5 py-20">
      <SectionEyebrow>{t.games.eyebrow}</SectionEyebrow>
      <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        {t.games.title}
      </h2>
      <p className="mt-3 max-w-xl text-base text-ink-muted">{t.games.subtitle}</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {games.map((game) => (
          <article
            key={game.title}
            className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-3"
          >
            <div className="overflow-hidden rounded-[1.15rem]">
              <img
                src={game.image}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
            <div className="px-3 pt-5 pb-4">
              <h3 className="text-lg font-extrabold text-ink">{game.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{game.body}</p>
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
          <img
            src="/mobile/app-home.png"
            alt=""
            aria-hidden="true"
            className="w-full max-w-[19rem] drop-shadow-[0_34px_60px_-26px_rgb(45_118_221/0.45)]"
          />
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
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div
        className="relative overflow-hidden rounded-[2rem] shadow-[0_22px_54px_-18px_rgb(28_140_230/0.55)]"
        style={{ background: 'linear-gradient(180deg,#5cb6f7 0%,#3f9dee 58%,#2f92e7 100%)' }}
      >
        <SkyScene />
        <div className="relative grid items-center gap-2 px-8 py-12 sm:px-12 sm:py-14 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-[2.4rem]">
              {t.final.title}
            </h2>
            <p className="mt-3 max-w-md text-base text-white/90">{t.final.body}</p>
            <div className="mt-7 flex flex-col items-start gap-3">
              <Link
                to="/signup"
                className="inline-flex h-14 items-center justify-center rounded-[var(--radius-control)] bg-white px-9 text-base font-extrabold text-[#1c8fe0] shadow-[0_5px_0_0_rgb(19_120_205/0.28)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
              >
                {t.final.cta}
              </Link>
              <Link to="/signin" className="text-sm font-bold text-white hover:underline">
                {t.final.signIn}
              </Link>
            </div>
          </div>
          <div className="hidden justify-end lg:flex">
            <img
              src="/characters/panda.png"
              alt=""
              aria-hidden="true"
              className="h-64 w-auto drop-shadow-[0_20px_30px_rgb(18_54_110/0.28)]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/** The sky behind the closing band: clouds, a faint onion-dome skyline, and green hills. All
 *  decorative and fixed-colour — it is a blue billboard, not a themed surface. */
function SkyScene() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Clouds live only in the upper-right sky, above the panda — the left half is left clear
          for the heading. A gaussian blur keeps their edges soft rather than cut-out. */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="cloudSoft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
        </defs>
        <g fill="#ffffff" filter="url(#cloudSoft)">
          <g opacity="0.9">
            <CloudPuff cx={618} cy={60} s={1} />
          </g>
          <g opacity="0.65">
            <CloudPuff cx={742} cy={104} s={0.72} />
          </g>
          <g opacity="0.5">
            <CloudPuff cx={548} cy={34} s={0.8} />
          </g>
        </g>
      </svg>
      <div className="absolute bottom-9 left-5 opacity-[0.16] sm:left-9">
        <OnionDomes />
      </div>
      <svg className="absolute inset-x-0 bottom-0 w-full" viewBox="0 0 800 120" preserveAspectRatio="none">
        <path d="M0 72 Q200 36 400 60 T800 56 V120 H0Z" fill="#95d271" />
        <path d="M0 94 Q240 66 500 84 T800 80 V120 H0Z" fill="#7cc457" />
      </svg>
    </div>
  )
}

/** A soft, fluffy cloud: a flat-ish base ellipse topped with a run of overlapping puffs. */
function CloudPuff({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <ellipse cx="0" cy="10" rx="62" ry="18" />
      <circle cx="-36" cy="6" r="17" />
      <circle cx="-14" cy="-6" r="23" />
      <circle cx="14" cy="-9" r="26" />
      <circle cx="40" cy="-1" r="19" />
    </g>
  )
}

/** A simplified St. Basil's cluster — three onion-domed towers, drawn as a flat silhouette. */
function OnionDomes() {
  return (
    <svg viewBox="0 0 160 130" className="h-24 w-auto" fill="#ffffff" aria-hidden="true">
      <g>
        <rect x="70" y="58" width="20" height="62" />
        <path d="M70 60 C66 42 74 38 80 24 C86 38 94 42 90 60 Z" />
        <rect x="79" y="12" width="2" height="12" />
        <circle cx="80" cy="10" r="3" />
      </g>
      <g>
        <rect x="34" y="78" width="16" height="42" />
        <path d="M34 80 C31 66 39 62 42 52 C45 62 53 66 50 80 Z" />
        <rect x="41" y="45" width="2" height="7" />
      </g>
      <g>
        <rect x="110" y="82" width="15" height="38" />
        <path d="M110 84 C107 70 115 66 117.5 57 C120 66 128 70 125 84 Z" />
        <rect x="116.5" y="50" width="2" height="7" />
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------------- footer */

function Footer() {
  const t = useT().landing
  const columns = [
    {
      title: t.footer.platform,
      links: [
        { label: t.nav.method, href: '#method' },
        { label: t.nav.games, href: '#games' },
        { label: t.nav.pricing, href: '#pricing' },
        { label: t.footer.help, href: SUPPORT_TELEGRAM_URL },
      ],
    },
    {
      title: t.footer.useful,
      links: [
        { label: t.footer.blog, href: '#' },
        { label: t.footer.test, href: '#' },
        { label: t.footer.words, href: '#' },
        { label: t.footer.grammar, href: '#' },
      ],
    },
    {
      title: t.footer.company,
      links: [
        { label: t.footer.about, href: '#' },
        { label: t.footer.contact, href: SUPPORT_TELEGRAM_URL },
        { label: t.footer.privacyPolicy, href: '#' },
        { label: t.footer.terms, href: '#' },
      ],
    },
  ]

  return (
    <footer className="relative overflow-hidden border-t border-hairline bg-ground-sunken/50">
      {/* A faint Moscow skyline watermark in the corner, the way the reference closes the page. */}
      <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-0 text-signal opacity-[0.09]">
        <Skyline />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <div className="max-w-xs">
            <Wordmark className="text-xl" />
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.footer.tagline}</p>
            <div className="mt-5 flex gap-2.5">
              <SocialLink href={SUPPORT_TELEGRAM_URL} label="Telegram">
                <TelegramIcon />
              </SocialLink>
              <SocialLink href={SUPPORT_INSTAGRAM_URL} label="Instagram">
                <InstagramIcon />
              </SocialLink>
              <SocialLink href="https://youtube.com/@russian_gg" label="YouTube">
                <YouTubeIcon />
              </SocialLink>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-extrabold text-ink">{col.title}</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {col.links.map((link) => {
                  const external = link.href.startsWith('http')
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                        className="text-ink-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-sm font-extrabold text-ink">{t.footer.language}</h3>
            <div className="mt-4">
              <LocaleSwitch />
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">{t.footer.rights}</p>
          <p className="flex items-start gap-2 text-xs text-ink-muted sm:max-w-md">
            <span className="mt-0.5 shrink-0 text-milestone">
              <ShieldIcon />
            </span>
            {t.footer.privacy}
          </p>
        </div>
      </div>
    </footer>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full border border-hairline bg-ground-raised text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
    >
      {children}
    </a>
  )
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9L18 6.6c.4-.3-.1-.5-.6-.2L6.7 13.2l-4.7-1.5c-1-.3-1-1 .2-1.5L20.6 2.9c.9-.3 1.6.2 1.3 1.4Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[2]">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1.1" className="fill-current stroke-none" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M23 12s0-3.3-.4-4.9a2.5 2.5 0 0 0-1.8-1.8C19.2 5 12 5 12 5s-7.2 0-8.8.3A2.5 2.5 0 0 0 1.4 7.1C1 8.7 1 12 1 12s0 3.3.4 4.9a2.5 2.5 0 0 0 1.8 1.8C4.8 19 12 19 12 19s7.2 0 8.8-.3a2.5 2.5 0 0 0 1.8-1.8C23 15.3 23 12 23 12ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[2]">
      <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A faint Moscow skyline for the footer corner: hills, trees, onion domes and a starred tower. */
function Skyline() {
  return (
    <svg viewBox="0 0 440 170" className="h-40 w-auto sm:h-48" fill="currentColor" aria-hidden="true">
      {/* Kremlin tower with a star */}
      <g>
        <rect x="150" y="60" width="34" height="90" />
        <path d="M148 60 h38 l-19 -22 Z" />
        <rect x="166" y="26" width="2" height="12" />
        <path d="M167 18 l4 5 -4 5 -4 -5 Z" />
        <rect x="152" y="54" width="4" height="6" />
        <rect x="162" y="54" width="4" height="6" />
        <rect x="172" y="54" width="4" height="6" />
        <rect x="178" y="54" width="4" height="6" />
      </g>
      {/* onion-dome cluster */}
      <g>
        <rect x="228" y="86" width="16" height="64" />
        <path d="M228 88 C225 72 233 68 236 56 C239 68 247 72 244 88 Z" />
        <rect x="235" y="48" width="2" height="8" />
        <rect x="258" y="98" width="13" height="52" />
        <path d="M258 100 C255.5 87 262.5 84 264.5 74 C266.5 84 273.5 87 271 100 Z" />
        <rect x="205" y="100" width="13" height="50" />
        <path d="M205 102 C202.5 89 209.5 86 211.5 76 C213.5 86 220.5 89 218 102 Z" />
      </g>
      {/* trees */}
      <g>
        <rect x="330" y="120" width="4" height="30" />
        <circle cx="332" cy="116" r="14" />
        <rect x="360" y="128" width="3" height="22" />
        <circle cx="361.5" cy="124" r="10" />
      </g>
      {/* hills */}
      <path d="M0 150 Q110 128 250 146 T440 140 V170 H0Z" opacity="0.7" />
    </svg>
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

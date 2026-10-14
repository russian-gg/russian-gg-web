import { useRef, useState } from 'react'
import {
  ArrowRight,
  BellRing,
  Gem,
  Maximize2,
  WifiOff,
  ArrowUpRight,
  AudioLines,
  Check,
  CircleAlert,
  CircleCheck,
  Crown,
  Plus,
  Mic,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sprout,
  TrendingUp,
  Volume2,
  WandSparkles,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LinkButton } from '../components/ui'
import { Reveal, Sequence } from '../components/motion'
import { collapse, ease, fadeIn, rise, stagger, useCountUp } from '../lib/motion'
import * as m from 'motion/react-m'
import { AnimatePresence, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { AiTutorScene, ProductPreview, ReelThumb } from '../components/landing/visuals'
import { Aurora, FloatingProp, LandingVideo, Stage, Tilt, VIEW_MARGIN } from '../components/landing/effects'
import { BrowserFrame, IPhoneFrame } from '../components/landing/devices'
import { VoiceSignal } from '../components/VoiceSignal'
import { SampleReport } from '../components/landing/report'
import { cx } from '../lib/cx'
import { fill, LOCALES, useLocale, useT } from '../lib/i18n'
import { playLandingCharacterVoice } from '../lib/liveVoice'
import { SUPPORT_INSTAGRAM_URL, SUPPORT_TELEGRAM_URL } from '../lib/support'
import targetArt from '../assets/images/progress_main_card_2.webp'
import missionsArt from '../assets/images/missions_main_card.webp'
import starArt from '../assets/images/progress_icon_3.webp'
import orbArt from '../assets/images/progress_icon_1.webp'

/**
 * The public face of Russian.gg. Two audiences read this page: a learner deciding whether to
 * speak into a microphone, and an investor deciding whether this is a business. Both are served
 * by the same thing — showing the real product and the real numbers, not adjectives about them.
 *
 * The look is soft 3D and frosted glass over a drifting aurora field (`.landing` in
 * `styles.css`), built from the signed-in app's own clay-blue 3D artwork and its live voice
 * orb, so the first impression and the product read as one thing. Every loop on the page is
 * stilled under reduced motion.
 */
export function Landing() {
  return (
    <div className="landing min-h-dvh text-ink">
      <TopBar />
      <main>
        <Hero />
        {/* The four numbers worth knowing, in one band, before any section asks to be read. */}
        <ProofBand />
        {/* A full-bleed reels strip right after the hero: the first proof that real people use
            this, before a single claim about it. */}
        <ReelMarquee />
        {/* What a session actually is: the AI tutor turn, as a video or its live stand-in. */}
        <Showcase />
        {/* The problem-and-solution narrative, told by the three characters. */}
        <Characters />
        {/* What the learner gets back: the progress screen, as a sample. */}
        <Report />
        <Games />
        <Mobile />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

/**
 * Product clips for the page, produced separately (Motion) and served from `public/landing/`.
 *
 * A slot left `null` renders its animated stand-in instead — see `LandingVideo`. Fill in a
 * path once the file is in `public/` and the section starts playing it, with no other change.
 */
const LANDING_VIDEOS: { showcase: string | null; showcasePoster?: string } = {
  showcase: null,
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

/** A floating glass pill rather than a full-width bar: the aurora runs up behind it. */
/**
 * The navigation. Full width and flush to the top while the page is at rest; past the first
 * few pixels of scroll it gathers into a floating glass pill (`.landing-nav` in `styles.css`
 * does the drawing, so the change is one continuous transition rather than two components).
 * Fixed rather than sticky: its height changes as it floats, and a sticky element changing
 * height would push the whole page down by the difference every time it did.
 */
function TopBar() {
  const t = useT().landing
  const { scrollY } = useScroll()
  const [floating, setFloating] = useState(() => typeof window !== 'undefined' && window.scrollY > 40)
  useMotionValueEvent(scrollY, 'change', (y) => setFloating(y > 40))

  return (
    <m.header
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: ease.enter }}
      className="landing-nav-wrap fixed inset-x-0 top-0 z-40"
      data-floating={floating}
    >
      <div className="landing-nav">
        <div
          className={cx(
            'mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 transition-[height,padding] duration-500 sm:gap-4',
            floating ? 'h-14 pr-2' : 'h-16',
          )}
        >
          <a href="#top" className="flex items-center" aria-label="russian.gg">
            <Wordmark className="text-xl" />
          </a>

          <nav className="hidden items-center gap-1 text-sm font-bold whitespace-nowrap text-ink-muted lg:flex">
            {[
              { href: '#method', label: t.nav.method },
              { href: '#games', label: t.nav.games },
              { href: '#pricing', label: t.nav.pricing },
            ].map((link) => (
              <a
                key={link.href}
                className="rounded-full px-3.5 py-2 transition-colors hover:bg-signal-soft hover:text-ink"
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* `max-sm:hidden` rather than `hidden sm:inline-flex`: both of these carry their own
                `inline-flex`, which wins the cascade over `hidden` and kept them on screen on phones. */}
            <LocaleSwitch className="max-sm:hidden" />
            <LinkButton to="/signin" variant="ghost" size="md" className="max-sm:hidden">
              {t.nav.signIn}
            </LinkButton>
            <LinkButton to="/signin" size="md" className="max-sm:px-4">
              {t.nav.getStarted}
            </LinkButton>
          </div>
        </div>
      </div>
    </m.header>
  )
}

/* ---------------------------------------------------------------------------- hero */

/**
 * Paints the "90 days" phrase of a headline in the spectrum gradient. The number is the
 * promise, and it sits in a different place in each locale ("90 kunda…", "За 90 дней…",
 * "…in 90 days"), so it is found rather than hard-coded. No number, no accent.
 */
function Accented({ text }: { text: string }) {
  // A number, or a range like "15–20", and the word after it.
  const match = /\d+(?:[–-]\d+)?\s+\p{L}+/u.exec(text)
  if (!match) return <>{text}</>
  const start = match.index
  const end = start + match[0].length
  return (
    <>
      {text.slice(0, start)}
      <span className="text-spectrum">{match[0]}</span>
      {text.slice(end)}
    </>
  )
}

function Hero() {
  const t = useT().landing
  return (
    /* The nav is fixed over the top of the page, so the hero clears its height and the aurora
       runs up behind it. */
    <section id="top" className="relative isolate overflow-hidden pt-16">
      <Aurora />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        {/*
          The hero is the only block on this page that animates on load rather than on scroll,
          because it is the only one already on screen when the page arrives.

          A wide beat here, not the ordinary one. These are five separate claims - a label, a
          promise, an explanation, a way in, a reason to trust it - and they are meant to be
          read in that order rather than taken in as a block.
        */}
        <Sequence className="min-w-0" gap={stagger.wide}>
          <Reveal>
            <p className="glass inline-flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-xs font-extrabold tracking-[0.06em] text-signal-ink uppercase">
              <span className="grid size-6 place-items-center rounded-full bg-[image:var(--spectrum)] text-white">
                <Sparkles aria-hidden="true" strokeWidth={0} className="size-3.5 fill-current" />
              </span>
              {t.hero.eyebrow}
            </p>
          </Reveal>

          <Reveal>
            <h1 className="mt-6 text-4xl leading-[1.06] font-black tracking-tight text-balance text-ink sm:text-5xl lg:text-[3.6rem]">
              <Accented text={t.headline} />
            </h1>
          </Reveal>

          <Reveal>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">{t.body}</p>
          </Reveal>

          <Reveal className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <LinkButton to="/signin" className="w-full gap-2 sm:w-auto">
              {t.hero.primaryCta}
              <ArrowRight aria-hidden="true" strokeWidth={2.2} className="size-[18px]" />
            </LinkButton>
            <LinkButton to="/onboarding" variant="secondary" className="w-full max-sm:h-auto max-sm:min-h-14 max-sm:px-5 max-sm:py-3 max-sm:text-center max-sm:whitespace-normal sm:w-auto">
              {t.hero.secondaryCta}
            </LinkButton>
          </Reveal>

          <Reveal className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-bold text-ink">
              <span className="grid size-5 place-items-center rounded-full bg-milestone-soft">
                <Check aria-hidden="true" strokeWidth={3} className="size-3 text-milestone" />
              </span>
              {t.hero.socialProof}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <Tick />
              {t.hero.trustNote}
            </span>
          </Reveal>
        </Sequence>

        {/*
          The mock arrives from the right, a beat behind the column it belongs to, so it reads
          as the evidence for the claim rather than a second thing competing with it. The 3D
          props and the two glass chips around it are the signed-in app's own artwork and its
          own two promises — speak, get corrected.
        */}
        <Reveal variants={fadeIn('right', 24)} delay={0.3} className="relative lg:pl-6">
          <div aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 size-[26rem] -translate-1/2 rounded-full bg-[image:var(--spectrum)] opacity-25 blur-3xl" />

          <FloatingProp src={targetArt} className="-top-6 -left-4 w-32 sm:w-40 lg:-left-10" duration={7} tilt={-4} />
          <FloatingProp src={missionsArt} className="-right-2 -bottom-6 w-32 sm:w-40 lg:-right-8" duration={6.5} delay={-2} tilt={3} />
          <FloatingProp src={starArt} className="top-10 right-2 hidden w-14 sm:block lg:-right-4" duration={5} delay={-1} lift={-16} />
          <FloatingProp src={orbArt} className="bottom-24 -left-2 hidden w-12 sm:block lg:-left-8" duration={5.5} delay={-3} lift={-10} />

          <Tilt className="relative z-10 mx-auto w-[15.5rem] sm:w-[17.5rem]">
            <ProductPreview
              day={t.hero.mockDay}
              objective={t.hero.mockObjective}
              hint={t.hero.mockHint}
              action={t.hero.mockAction}
            />
          </Tilt>

          <HeroChip className="top-[38%] -left-2 lg:-left-14" delay={-1.5} icon={<Mic aria-hidden="true" strokeWidth={1.9} className="size-4" />}>
            {t.method.step1Title}
          </HeroChip>
          <HeroChip className="right-0 bottom-[30%] lg:-right-12" delay={-3.5} icon={<CircleCheck aria-hidden="true" strokeWidth={1.9} className="size-4" />} tone="milestone">
            {t.method.step2Title}
          </HeroChip>
        </Reveal>
      </div>
    </section>
  )
}

/** A small glass label hanging beside the hero mock. Decorative: the copy says the same. */
function HeroChip({
  children,
  icon,
  className,
  delay = 0,
  tone = 'signal',
}: {
  children: ReactNode
  icon: ReactNode
  className?: string
  delay?: number
  tone?: 'signal' | 'milestone'
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'glass glass-strong float absolute z-20 hidden items-center gap-2 rounded-2xl py-2 pr-3.5 pl-2 text-sm font-extrabold whitespace-nowrap text-ink sm:inline-flex',
        className,
      )}
      style={{ '--float-delay': `${delay}s`, '--float-lift': '-8px' } as CSSProperties}
    >
      <span
        className={cx(
          'grid size-7 place-items-center rounded-xl text-white',
          tone === 'signal' ? 'bg-[image:var(--spectrum)]' : 'bg-milestone',
        )}
      >
        {icon}
      </span>
      {children}
    </span>
  )
}

/* --------------------------------------------------------------------------- proof */

/**
 * The stats band under the hero: four figures, each one already claimed elsewhere on the page
 * (the learner count in the hero, the creators' reach in the reels strip) or a fact of the
 * course itself. The figures rise in one after another and count up once the band is on screen.
 */
function ProofBand() {
  const t = useT().landing
  const figures = [
    { value: 2500, suffix: '+', label: t.proof.learners },
    { value: 90, label: t.proof.days },
    { text: '15–20', label: t.proof.minutes },
    { value: 480, suffix: '+', label: t.creators.channelStat },
  ]

  return (
    <section className="relative z-10 mx-auto -mt-6 max-w-6xl px-5">
      <Stage className="glass glass-strong grid grid-cols-2 rounded-[2rem] lg:grid-cols-4" gap={stagger.wide}>
        {figures.map((figure, index) => (
          <Reveal
            key={figure.label}
            variants={rise}
            className={cx(
              'px-5 py-6 text-center sm:py-7',
              index % 2 === 1 && 'border-l border-hairline',
              index >= 2 && 'border-t border-hairline lg:border-t-0',
              index === 2 && 'lg:border-l',
            )}
          >
            <div className="text-spectrum text-3xl font-black tracking-tight tabular-nums sm:text-4xl">
              {figure.text ?? <CountTo value={figure.value ?? 0} />}
              {figure.suffix}
            </div>
            <p className="mx-auto mt-1.5 max-w-[14rem] text-xs leading-snug font-bold text-ink-muted sm:text-sm">
              {figure.label}
            </p>
          </Reveal>
        ))}
      </Stage>
    </section>
  )
}

/** Grouped the way the current locale writes numbers: "2 500" in uz/ru, "2,500" in en. */
function useNumberFormat() {
  const { locale } = useLocale()
  return (value: number) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU').format(Math.round(value))
}

/** Counts up to `value` once it has come up into the screen. */
function CountTo({ value, ms = 1200 }: { value: number; ms?: number }) {
  const format = useNumberFormat()
  const ref = useRef<HTMLSpanElement>(null)
  // Half of the figure on screen, not the section trigger: a figure that is visible must never
  // sit at zero waiting for a stricter line further up the screen.
  const seen = useInView(ref, { once: true, amount: 0.5 })
  const shown = useCountUp(seen ? value : 0, ms)
  return <span ref={ref}>{format(shown)}</span>
}

/* -------------------------------------------------------------------------- report */

/** The sample progress report, with a strip under it that sends the reader to measure their own. */
function Report() {
  const t = useT().landing
  return (
    <section className="relative isolate overflow-hidden py-20">
      <Aurora blobs={2} grid={false} className="opacity-60" />
      <span aria-hidden="true" className="dot-grid absolute top-24 left-0 -z-10 h-64 w-64" />
      <div className="mx-auto max-w-6xl px-5">
        <Stage>
          <Reveal>
            <SectionEyebrow>{t.report.eyebrow}</SectionEyebrow>
          </Reveal>
          <Reveal>
            <h2 className="mt-4 max-w-3xl text-3xl leading-[1.12] font-black tracking-tight text-ink sm:text-4xl">
              {t.report.title}
            </h2>
          </Reveal>
          <Reveal>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{t.report.subtitle}</p>
          </Reveal>
        </Stage>

        <div className="mt-10">
          <SampleReport />
        </div>

        <Stage className="mt-4">
          <Reveal
            variants={rise}
            className="glass sheen flex flex-col items-start justify-between gap-5 rounded-[1.75rem] px-6 py-5 sm:flex-row sm:items-center"
          >
            <p className="flex items-center gap-3 text-base font-extrabold text-ink">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[image:var(--spectrum)] text-white">
                <TrendingUp aria-hidden="true" strokeWidth={1.9} className="size-5" />
              </span>
              {t.report.ctaBody}
            </p>
            <LinkButton to="/onboarding" className="w-full shrink-0 gap-2 max-sm:h-auto max-sm:min-h-14 max-sm:whitespace-normal sm:w-auto">
              {t.hero.secondaryCta}
              <ArrowRight aria-hidden="true" strokeWidth={2.2} className="size-[18px]" />
            </LinkButton>
          </Reveal>
        </Stage>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------------ showcase */

/**
 * How a session works, shown rather than listed: the three steps on the left, and on the
 * right one real tutor turn — the produced clip when there is one, otherwise the mission
 * screen's own voice orb playing the turn live. Carries id="method" so the nav's "how it
 * works" lands here.
 */
function Showcase() {
  const t = useT().landing
  const steps = [
    { title: t.method.step1Title, body: t.method.step1Body, icon: Mic },
    { title: t.method.step2Title, body: t.method.step2Body, icon: WandSparkles },
    { title: t.method.step3Title, body: t.method.step3Body, icon: TrendingUp },
  ]

  return (
    <section id="method" className="relative isolate scroll-mt-20 overflow-hidden py-24">
      <Aurora blobs={2} grid={false} className="opacity-60" />
      <span aria-hidden="true" className="dot-grid absolute right-0 bottom-16 -z-10 h-56 w-72" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Stage gap={stagger.wide}>
          <Reveal>
            <SectionEyebrow>{t.method.eyebrow}</SectionEyebrow>
          </Reveal>
          <Reveal>
            <h2 className="mt-4 text-3xl leading-[1.12] font-black tracking-tight text-ink sm:text-4xl">
              <Accented text={t.method.title} />
            </h2>
          </Reveal>
          <Reveal>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">{t.method.subtitle}</p>
          </Reveal>

          <ol className="relative mt-9 space-y-3">
            {/* The thread the three steps hang on. */}
            <span aria-hidden="true" className="absolute top-6 bottom-6 left-[1.85rem] w-px bg-gradient-to-b from-signal/50 via-signal/25 to-transparent" />
            {steps.map(({ title, body, icon: Icon }, index) => (
              <Reveal as="li" key={title} variants={rise}>
                <div className="glass sheen relative flex items-start gap-4 rounded-[1.25rem] p-4">
                  <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-[image:var(--spectrum)] text-white shadow-[0_10px_20px_-8px_rgb(45_118_221/0.7),inset_0_1px_0_rgb(255_255_255/0.4)]">
                    <Icon aria-hidden="true" strokeWidth={1.9} className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-ink-faint tabular-nums">0{index + 1}</span>
                      <h3 className="text-base font-extrabold text-ink">{title}</h3>
                    </div>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </Stage>

        <Stage className="relative">
        <Reveal variants={rise}>
          <div aria-hidden="true" className="absolute inset-8 -z-10 rounded-full bg-[image:var(--spectrum)] opacity-30 blur-3xl" />
          <Tilt max={4}>
            <div className="glass sheen relative min-h-[32rem] overflow-hidden rounded-[2rem]">
              <LandingVideo
                src={LANDING_VIDEOS.showcase}
                poster={LANDING_VIDEOS.showcasePoster}
                label={t.showcase.videoLabel}
                playLabel={t.showcase.play}
                pauseLabel={t.showcase.pause}
                className="absolute inset-0"
                fallback={
                  <AiTutorScene
                    liveLabel={t.showcase.live}
                    tutorName={t.characters.names.pingvin}
                    hint={t.hero.mockHint}
                    feedbackLabel={t.method.step2Title}
                  />
                }
              />
            </div>
          </Tilt>
        </Reveal>
        </Stage>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------------ characters */

/** The three product characters carry the pitch: Panda names the problem every learner feels,
 *  the Penguin and Pero answer it. The image and colour of each are fixed here; the words are
 *  localised. */
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
  // glow behind the character. Both are fixed brand illustration colours, not theme tokens.
  { key: 'panda', n: '01', status: 'problem', image: '/characters/panda.webp', accent: '#f3a9cb', bubble: '#e83e8c' },
  { key: 'pingvin', n: '02', status: 'solution', image: '/characters/pingvin.webp', accent: '#9cc3f7', bubble: '#1c8fe0' },
  { key: 'pero', n: '03', status: 'solution', image: '/characters/pero.webp', accent: '#f3d178', bubble: '#e08a0a' },
]

function Characters() {
  const t = useT().landing.characters
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <Stage className="text-center">
          <Reveal>
            <SectionEyebrow center>{t.eyebrow}</SectionEyebrow>
          </Reveal>
          <Reveal>
            <h2 className="mx-auto mt-5 max-w-3xl text-3xl leading-[1.15] font-black tracking-tight text-ink sm:text-4xl">
              {t.title}
            </h2>
          </Reveal>
          <Reveal>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              {t.subtitle}
            </p>
          </Reveal>
        </Stage>

        {/*
          The three characters carry the argument in order - the Panda names the problem, the
          other two answer it - so they arrive in that order too.
        */}
        <Stage className="mx-auto mt-12 grid max-w-md gap-6 lg:max-w-none lg:grid-cols-3" gap={stagger.wide}>
          {CHARACTERS.map((character, index) => (
            <Reveal key={character.key} variants={rise} className="h-full">
              <Tilt className="h-full">
                <CharacterCard character={character} index={index} />
              </Tilt>
            </Reveal>
          ))}
        </Stage>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: VIEW_MARGIN }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="glass sheen mt-8 flex flex-col items-start justify-between gap-6 rounded-[1.75rem] px-6 py-7 sm:flex-row sm:items-center sm:px-9"
        >
          <div>
            <h3 className="text-lg font-extrabold text-ink sm:text-xl">{t.ctaTitle}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t.ctaBody}</p>
          </div>
          <LinkButton to="/signin" className="w-full shrink-0 max-sm:h-auto max-sm:min-h-14 max-sm:px-5 max-sm:py-3 max-sm:text-center max-sm:whitespace-normal sm:w-auto">
            {t.ctaButton}
          </LinkButton>
        </m.div>
      </div>
    </section>
  )
}

function CharacterCard({ character, index }: { character: (typeof CHARACTERS)[number]; index: number }) {
  const t = useT().landing.characters
  const { locale } = useLocale()
  const name = t.names[character.key]
  const { quote, caption } = t[character.key]
  const isProblem = character.status === 'problem'

  return (
    <article className="glass sheen flex h-full flex-col rounded-[1.75rem] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-[var(--radius-control)] bg-ground-sunken/70 px-3 py-1 text-[11px] font-extrabold tracking-[0.06em] whitespace-nowrap text-ink-muted uppercase">
          {fill(t.stage, { n: character.n })} · {name}
        </span>
        {isProblem ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-control)] bg-danger-soft px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap text-danger">
            <AlertGlyph />
            {t.statusProblem}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-control)] bg-milestone-soft px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap text-milestone">
            <CheckGlyph />
            {t.statusSolution}
          </span>
        )}
      </div>

      {/* The character's line, in a vibrant bubble with a tail. The colour is the character's
          own; white text sits on it. */}
      <div className="relative mt-4">
        <div
          className="rounded-2xl p-4 shadow-[0_16px_34px_-16px_rgb(17_24_39/0.45),inset_0_1px_0_rgb(255_255_255/0.25)]"
          style={{ backgroundColor: character.bubble }}
        >
          <p className="text-[15px] leading-relaxed font-medium text-white">«{quote}»</p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/25 pt-3">
            <span className="text-xs font-semibold text-white/80">
              {t.voicePrefix}: {name}
            </span>
            <ListenButton label={t.listen} text={quote} character={character.key} isUzbek={locale === 'uz'} />
          </div>
        </div>
        <span
          className="absolute -bottom-1.5 left-8 size-4 rotate-45 rounded-[2px]"
          style={{ backgroundColor: character.bubble }}
          aria-hidden="true"
        />
      </div>

      {/* The character floats over a soft glow of its own colour — the 3D figure standing on
          light rather than pasted on a card. */}
      <div className="relative flex flex-1 items-end justify-center py-7">
        <span
          aria-hidden="true"
          className="absolute bottom-6 left-1/2 h-24 w-40 -translate-x-1/2 rounded-full opacity-60 blur-2xl"
          style={{ backgroundColor: character.accent }}
        />
        <img
          src={character.image}
          alt={name}
          loading="lazy"
          className="float relative h-40 w-auto object-contain drop-shadow-[0_18px_22px_rgb(17_24_39/0.2)]"
          style={{ '--float-delay': `${index * -1.6}s`, '--float-lift': '-8px' } as CSSProperties}
        />
      </div>

      <div className="border-t border-hairline pt-5">
        <p className="text-[15px] leading-relaxed text-ink-muted">{caption}</p>
      </div>
    </article>
  )
}

/**
 * In Uzbek, plays the real mascot voice (docs/lessons/tts_voice_instructions.md) via
 * LandingVoiceService — these characters speak Uzbek by design. In Russian/English the quote is
 * a translation of the pitch, not something the character would actually say, so this falls back
 * to the browser's own speech engine, same as before.
 */
function ListenButton({
  label,
  text,
  character,
  isUzbek,
}: {
  label: string
  text: string
  character: CharacterKey
  isUzbek: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle')

  function speak() {
    if (!isUzbek) {
      try {
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
      } catch {
        // No speech synthesis; the button simply does nothing.
      }
      return
    }

    void playLandingCharacterVoice(character, { onStateChange: setStatus }).catch(() => setStatus('idle'))
  }

  return (
    <button
      type="button"
      onClick={speak}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-white/15 px-3 py-1.5 text-xs font-extrabold text-white transition-colors hover:bg-white/25"
    >
      {status === 'loading' ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : status === 'playing' ? (
        <AudioLines aria-hidden="true" strokeWidth={2} className="size-3.5" />
      ) : (
        <SpeakerGlyph />
      )}
      {label}
    </button>
  )
}

function AlertGlyph() {
  return (
    <CircleAlert aria-hidden="true" strokeWidth={2.4} className="size-3" />
  )
}

function CheckGlyph() {
  return (
    <CircleCheck aria-hidden="true" strokeWidth={2.6} className="size-3" />
  )
}

function SpeakerGlyph() {
  return (
    <Volume2 aria-hidden="true" strokeWidth={2} className="size-3.5" />
  )
}

/* ---------------------------------------------------------------------------- games */

/**
 * The two games, shown as they actually run — screenshots of real play, not illustrations.
 * Each sits in the device it is built for: the runner is a landscape game and gets a browser
 * window, the voice game is a phone game and gets the phone, rising into its card.
 */
function Games() {
  const t = useT().landing

  return (
    <section id="games" className="relative isolate scroll-mt-20 overflow-hidden">
      <Aurora blobs={2} grid={false} className="opacity-50" />
      <div className="mx-auto max-w-6xl px-5 py-20">
        <Stage>
          <Reveal>
            <SectionEyebrow>{t.games.eyebrow}</SectionEyebrow>
          </Reveal>
          <Reveal>
            <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-ink sm:text-4xl">{t.games.title}</h2>
          </Reveal>
          <Reveal>
            <p className="mt-3 max-w-xl text-base text-ink-muted">{t.games.subtitle}</p>
          </Reveal>
        </Stage>

        <Stage className="mt-10 grid gap-6 lg:grid-cols-[1.45fr_1fr]" gap={stagger.wide}>
          <Reveal variants={rise} className="h-full">
            <Tilt max={4} className="h-full">
              <article className="glass sheen flex h-full flex-col rounded-[1.75rem] p-4 sm:p-5">
                <BrowserFrame url="russian.gg/games/rod-runner">
                  <div className="overflow-hidden">
                    {/* A slow push-in as the card arrives: the road is moving, so the shot does too. */}
                    <m.img
                      src="/games/rod-runner-play.webp"
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="aspect-[1600/891] w-full object-cover"
                      initial={{ scale: 1.14 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true, margin: VIEW_MARGIN }}
                      transition={{ duration: 1.6, ease: ease.enter }}
                    />
                  </div>
                </BrowserFrame>
                <GameText title={t.games.runnerTitle} body={t.games.runnerBody} />
              </article>
            </Tilt>
          </Reveal>

          <Reveal variants={rise} className="h-full">
            <Tilt max={4} className="h-full">
              <article className="glass sheen flex h-full flex-col rounded-[1.75rem] p-4 sm:p-5">
                <div className="relative h-[23rem] overflow-hidden rounded-[1.25rem] bg-[radial-gradient(120%_90%_at_50%_0%,var(--color-signal-soft),transparent_70%)]">
                  <span aria-hidden="true" className="dot-grid absolute inset-0 opacity-60" />
                  {/* The phone comes up out of the card's floor, the way it comes out of a pocket. */}
                  <m.div
                    className="absolute top-7 left-1/2 w-[13rem] -translate-x-1/2"
                    initial={{ y: 120, rotate: -4 }}
                    whileInView={{ y: 0, rotate: 0 }}
                    viewport={{ once: true, margin: VIEW_MARGIN }}
                    transition={{ type: 'spring', duration: 1, bounce: 0.25 }}
                  >
                    <IPhoneFrame tone="light" screenClassName="bg-[#f2f4f7]">
                      <img src="/games/arra-play.webp" alt="" aria-hidden="true" loading="lazy" className="absolute inset-x-0 top-[12cqw] w-full" />
                    </IPhoneFrame>
                  </m.div>
                  <span
                    aria-hidden="true"
                    className="glass glass-strong float absolute top-24 right-4 grid place-items-center rounded-2xl px-3 py-2.5"
                    style={{ '--float-lift': '-8px' } as CSSProperties}
                  >
                    <VoiceSignal state="listening" size="sm" labelled={false} />
                  </span>
                </div>
                <GameText title={t.games.sawTitle} body={t.games.sawBody} />
              </article>
            </Tilt>
          </Reveal>
        </Stage>
      </div>
    </section>
  )
}

function GameText({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-2 pt-5 pb-2">
      <h3 className="text-lg font-extrabold text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body}</p>
    </div>
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
  { handle: '@fateemajan__', title: '90 kunda rus tilida gapirishni boshlash', url: 'https://www.instagram.com/reel/DbpH5-BhAzP/', cover: '/reels/fateemajan__.webp' },
  { handle: '@with_jeren', title: 'Ruscha gapirsam, inglizcha aralashib ketadimi?', url: 'https://www.instagram.com/reel/Dbv8Qpooa-p/', cover: '/reels/with_jeren.webp' },
  { handle: '@the_sakinaa', title: 'Har kuni 15 daqiqa ovozli mashq', url: 'https://www.instagram.com/reel/DbzrlaWsxcW/', cover: '/reels/the_sakinaa.webp' },
  { handle: '@1bonuyem', title: "Rus tilini tez gapirishning yo'li", url: 'https://www.instagram.com/reel/Dbthm3zxbs8/', cover: '/reels/1bonuyem.webp' },
  { handle: '@abdulxoliq.ustoz', title: "Rus tilini o'rganishning amaliy usuli", url: 'https://www.instagram.com/reel/DbyOkbvNA29/', cover: '/reels/abdulxoliq.ustoz.webp' },
  { handle: '@blog_rano', title: 'Ish uchun rus tili: qayerdan boshlash', url: 'https://www.instagram.com/reel/DbtLqBPNJZt/', cover: '/reels/blog_rano.webp' },
  { handle: '@yasina_nadirbekovna', title: 'Rus tilida ishonch bilan gapiring', url: 'https://www.instagram.com/reel/Db3EzzVMynp/', cover: '/reels/yasina_nadirbekovna.webp' },
]

/**
 * The reels strip. A contained header carries the words; the strip itself is full-bleed — it
 * runs edge to edge with no page gutter, dissolving into the page at both ends, and loops by
 * rendering the cards twice and translating the track by exactly one half. The second copy is
 * `aria-hidden` so a screen reader reads each reel once.
 */
function ReelMarquee() {
  const t = useT().landing
  return (
    <section className="overflow-hidden py-14">
      <Stage className="mx-auto mb-8 max-w-6xl px-5">
        <Reveal>
          <SectionEyebrow>{t.creators.eyebrow}</SectionEyebrow>
        </Reveal>
        <Reveal>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-ink sm:text-3xl">{t.creators.title}</h2>
        </Reveal>
      </Stage>

      {/* Full-bleed: no max-width, no horizontal padding — the strip fills the viewport width. */}
      <m.div
        className="reel-viewport fade-edges w-full overflow-hidden py-3"
        initial={{ opacity: 0, x: 80 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: VIEW_MARGIN }}
        transition={{ duration: 0.9, ease: ease.enter }}
      >
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
      </m.div>
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
  const cardClass = 'glass flex h-full w-full flex-col rounded-[1.5rem] p-3'
  const inner = (
    <>
      <ReelThumb seed={index} watch={watch} cover={creator.cover} />
      <div className="mt-3 px-1 pb-1">
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
      className={cx(cardClass, 'transition-transform duration-200 hover:-translate-y-1')}
    >
      {inner}
    </a>
  )
}

/* ---------------------------------------------------------------------------- mobile */

/**
 * The app on a phone. The real home screen sits in the iPhone frame and turns toward the reader
 * as the section scrolls through — a scroll-linked lean, not a one-off entrance — while a
 * reminder slides down over it, which is the thing installing the web app actually buys you.
 * Under reduced motion the phone stands still and the notification is simply there.
 */
function Mobile() {
  const t = useT().landing
  const reduced = useReducedMotion()
  const stage = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start end', 'end start'] })
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-24, -6, 10])
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [14, 4, -6])
  const lift = useTransform(scrollYProgress, [0, 1], [70, -50])

  const features = [
    { icon: Maximize2, label: t.mobile.featureFullscreen },
    { icon: BellRing, label: t.mobile.featurePush },
    { icon: WifiOff, label: t.mobile.featureOffline },
  ]

  return (
    /* Clipped sideways only: the glass rings are wider than a phone screen, and would otherwise
       give the whole page a horizontal scroll. Vertically the tilting phone may overhang. */
    <section className="relative isolate mx-auto max-w-6xl overflow-x-clip px-5 py-24">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div ref={stage} className="relative order-2 flex min-h-[36rem] items-center justify-center [perspective:1400px] lg:order-1">
          {/* Concentric glass rings behind the phone: the device sitting in its own field. */}
          <div aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 -translate-1/2">
            <span className="absolute top-1/2 left-1/2 size-[24rem] -translate-1/2 rounded-full bg-[image:var(--spectrum)] opacity-20 blur-3xl" />
            <span className="glass absolute top-1/2 left-1/2 size-[30rem] -translate-1/2 rounded-full opacity-50" />
            <span className="glass absolute top-1/2 left-1/2 size-[21rem] -translate-1/2 rounded-full opacity-80" />
          </div>
          <FloatingProp src={starArt} className="top-10 right-[10%] w-16" duration={5} lift={-14} />
          <FloatingProp src={orbArt} className="bottom-16 left-[8%] w-14" duration={6} delay={-2} />

          <m.div
            style={reduced ? undefined : { rotateX, rotateY, y: lift }}
            className="relative w-[15.5rem] [transform-style:preserve-3d] sm:w-[17.5rem]"
          >
            <IPhoneFrame bare screenClassName="bg-white">
              <img src="/mobile/app-home-screen.webp" alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover object-top" />

              {/* A reminder arriving: the reason to put the app on the home screen at all. */}
              <m.div
                className="absolute inset-x-[3.5cqw] top-[14cqw] z-30 flex items-start gap-[3cqw] rounded-[5.5cqw] border border-white/60 bg-white/80 p-[3.2cqw] shadow-[0_12px_30px_-12px_rgb(22_40_90/0.45)] backdrop-blur-xl"
                initial={reduced ? false : { y: '-140%', opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true, margin: VIEW_MARGIN }}
                transition={{ delay: 0.7, type: 'spring', duration: 0.8, bounce: 0.3 }}
              >
                <img src="/icons/apple-touch-icon.png" alt="" aria-hidden="true" className="size-[9.5cqw] shrink-0 rounded-[2.4cqw]" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between text-[3.4cqw] font-bold text-[#111]">
                    russian.gg
                    <span className="font-semibold text-[#8a8f98]">{t.mobile.now}</span>
                  </span>
                  <span className="mt-[0.6cqw] block text-[3.3cqw] leading-snug text-[#30343a]">{t.mobile.notificationBody}</span>
                </span>
              </m.div>
            </IPhoneFrame>
          </m.div>
        </div>

        <Stage className="order-1 lg:order-2">
          <Reveal>
            <SectionEyebrow>{t.mobile.eyebrow}</SectionEyebrow>
          </Reveal>
          <Reveal>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">{t.mobile.title}</h2>
          </Reveal>
          <Reveal>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-muted">{t.mobile.body}</p>
          </Reveal>

          <Reveal className="mt-7 grid grid-cols-3 gap-3">
            {features.map(({ icon: Icon, label }, index) => (
              <m.div
                key={label}
                className="glass sheen flex flex-col items-center gap-2.5 rounded-[1.25rem] px-2 py-4 text-center"
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: VIEW_MARGIN }}
                transition={{ delay: 0.25 + index * 0.12, type: 'spring', duration: 0.6, bounce: 0.3 }}
              >
                <span className="grid size-10 place-items-center rounded-2xl bg-[image:var(--spectrum)] text-white shadow-[0_10px_20px_-8px_rgb(45_118_221/0.7)]">
                  <Icon aria-hidden="true" strokeWidth={1.9} className="size-5" />
                </span>
                <span className="text-xs leading-tight font-extrabold text-ink sm:text-sm">{label}</span>
              </m.div>
            ))}
          </Reveal>

          <Reveal className="mt-3 space-y-3">
            <div className="glass sheen flex items-start gap-4 rounded-[1.25rem] p-5">
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-milestone-soft text-milestone">
                <Check aria-hidden="true" strokeWidth={2.6} className="size-4" />
              </span>
              <div>
                <div className="text-base font-extrabold text-ink">{t.mobile.pwaTitle}</div>
                <p className="mt-1 text-sm text-ink-muted">{t.mobile.pwaBody}</p>
              </div>
            </div>

            <div className="glass sheen flex items-start gap-4 rounded-[1.25rem] p-5">
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-ground-sunken">
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
          </Reveal>
        </Stage>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------- pricing */

/** The digits of a localised price string: "119 000" and "119,000" are both 119000. */
const digits = (price: string) => Number(price.replace(/\D/g, '')) || 0

/**
 * All three ways in, side by side: free, Pro by the month, and Pro for the whole 90 days.
 *
 * The 90-day plan's saving and both per-day figures are computed from the two prices rather
 * than written into the copy, so they cannot drift from the prices printed above them — and
 * per day is the comparison the in-app plan picker makes too (`paywall/PlanSelector.tsx`).
 * Every price counts up from zero the first time the cards come into view.
 */
function Pricing() {
  const t = useT()
  const p = t.landing.pricing
  const format = useNumberFormat()
  const monthly = digits(p.proPrice)
  const ninety = digits(p.ninetyPrice)
  const threeMonths = monthly * 3
  const savePercent = Math.round((1 - ninety / threeMonths) * 100)
  const money = (value: number) => `${format(value)} ${p.freeUnit}`

  return (
    <section id="pricing" className="relative isolate scroll-mt-20 overflow-hidden">
      <Aurora blobs={3} grid className="opacity-60" />
      <div className="mx-auto max-w-6xl px-5 py-24">
        <Stage className="text-center">
          <Reveal>
            <SectionEyebrow center>{p.eyebrow}</SectionEyebrow>
          </Reveal>
          <Reveal>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">{p.title}</h2>
          </Reveal>
          <Reveal>
            <p className="mx-auto mt-3 max-w-md text-base text-ink-muted">{p.subtitle}</p>
          </Reveal>
        </Stage>

        {/*
          Free, then the two ways to pay for the same course. The order is the argument, so the
          beat is wide enough to be read: what you get for nothing, what Pro adds, what it costs
          if you commit to the whole path.
        */}
        <Stage className="mx-auto mt-12 grid max-w-md gap-6 lg:max-w-none lg:grid-cols-3" gap={stagger.wide}>
          <Reveal variants={rise} className="h-full">
            <Tilt max={4} className="h-full">
              <PlanCard
                icon={<Sprout aria-hidden="true" strokeWidth={1.8} className="size-6" />}
                iconTone="milestone"
                title={p.freeTitle}
                body={p.freeBody}
                amount={0}
                unit={p.freeUnit}
                features={p.freeFeatures}
                cta={<LinkButton to="/signin" variant="secondary" block>{p.freeCta}</LinkButton>}
              />
            </Tilt>
          </Reveal>
          <Reveal variants={rise} className="h-full">
            <Tilt max={4} className="h-full">
              <PlanCard
                featured
                badge={p.proBadge}
                icon={<Crown aria-hidden="true" strokeWidth={1.8} className="size-6" />}
                iconTone="spectrum"
                title={`${p.proTitle} · ${t.billing.periodLabel.Monthly}`}
                body={p.proBody}
                amount={monthly}
                unit={p.proUnit}
                note={fill(t.billing.perDay, { amount: money(monthly / 30) })}
                features={p.proFeatures}
                cta={<LinkButton to="/signin" block>{p.proCta}</LinkButton>}
              />
            </Tilt>
          </Reveal>
          <Reveal variants={rise} className="h-full">
            <Tilt max={4} className="h-full">
              <PlanCard
                badge={fill(p.saveBadge, { percent: savePercent })}
                badgeTone="milestone"
                icon={<Gem aria-hidden="true" strokeWidth={1.8} className="size-6" />}
                iconTone="coin"
                title={`${p.proTitle} · ${t.billing.periodLabel.NinetyDay}`}
                body={p.ninetyBody}
                amount={ninety}
                was={money(threeMonths)}
                unit={p.ninetyUnit}
                note={fill(t.billing.perDay, { amount: money(ninety / 90) })}
                features={p.proFeatures}
                cta={<LinkButton to="/signin" variant="secondary" block>{p.ninetyCta}</LinkButton>}
              />
            </Tilt>
          </Reveal>
        </Stage>

        <m.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: VIEW_MARGIN }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-6 text-center text-sm text-ink-muted"
        >
          {p.payNote}
        </m.p>
      </div>
    </section>
  )
}

function PlanCard({
  title,
  body,
  amount,
  unit,
  features,
  cta,
  icon,
  iconTone,
  note,
  was,
  badge,
  badgeTone = 'spectrum',
  featured = false,
}: {
  title: string
  body: string
  amount: number
  unit: string
  features: string[]
  cta: ReactNode
  icon: ReactNode
  iconTone: 'milestone' | 'spectrum' | 'coin'
  /** A line under the price — the per-day figure. */
  note?: string
  /** What the same time would cost month by month, struck through beside the price. */
  was?: string
  badge?: string
  badgeTone?: 'spectrum' | 'milestone'
  featured?: boolean
}) {
  return (
    <div
      className={cx(
        'glass sheen flex h-full flex-col rounded-[1.75rem] p-7',
        // The featured plan wears a slowly turning spectrum ring instead of a flat border.
        featured && 'glass-strong spectrum-ring',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cx(
            'grid size-12 place-items-center rounded-2xl',
            iconTone === 'spectrum' &&
              'bg-[image:var(--spectrum)] text-white shadow-[0_12px_24px_-10px_rgb(109_92_242/0.7),inset_0_1px_0_rgb(255_255_255/0.4)]',
            iconTone === 'milestone' && 'bg-milestone-soft text-milestone',
            iconTone === 'coin' && 'bg-coin-soft text-coin-ink',
          )}
        >
          {icon}
        </span>
        {badge && (
          <span
            className={cx(
              'inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-control)] px-3 py-1 text-xs font-extrabold whitespace-nowrap',
              badgeTone === 'spectrum' ? 'bg-[image:var(--spectrum)] text-white' : 'bg-milestone text-white',
            )}
          >
            <Sparkles aria-hidden="true" strokeWidth={0} className="size-3 fill-current" />
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-5 text-lg font-extrabold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
        <span className={cx('text-4xl font-black tracking-tight tabular-nums', featured ? 'text-spectrum' : 'text-ink')}>
          <CountTo value={amount} ms={1400} />
        </span>
        <span className="text-sm font-bold whitespace-nowrap text-ink-muted">{unit}</span>
      </div>
      <p className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 text-sm font-semibold">
        {was && <span className="text-ink-faint line-through decoration-danger/60 decoration-2">{was}</span>}
        {note && <span className="text-signal-ink">{note}</span>}
      </p>

      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-[15px] text-ink">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-signal-soft">
              <Check aria-hidden="true" strokeWidth={3} className="size-3 text-signal-ink" />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-7">{cta}</div>
    </div>
  )
}

/* ------------------------------------------------------------------------------ faq */

/**
 * The questions a learner asks before speaking into a microphone, answered from the product's
 * own copy wherever it already says it: the certificate answer is the PRD's disclaimer, the
 * price answer is assembled from the pricing strings so it can never drift from the cards
 * above, and the phone answer is the mobile section's.
 *
 * One open at a time. The answer's height animates open and shut (`collapse` measures the real
 * height, so it holds in all three languages) and the plus turns into a cross.
 */
function Faq() {
  const t = useT().landing
  const [open, setOpen] = useState<number | null>(0)
  const items = [
    { q: t.faq.levelQ, a: t.faq.levelA },
    { q: t.faq.tutorQ, a: t.faq.tutorA },
    { q: t.faq.timeQ, a: t.faq.timeA },
    { q: t.faq.certificateQ, a: t.disclaimer },
    {
      q: t.faq.payQ,
      a: fill(t.faq.payA, {
        price: t.pricing.proPrice,
        unit: t.pricing.proUnit,
        alt: t.pricing.proAlt,
        pay: t.pricing.payNote,
      }),
    },
    { q: t.faq.phoneQ, a: t.mobile.body },
  ]

  return (
    <section id="faq" className="relative isolate scroll-mt-20">
      <span aria-hidden="true" className="dot-grid absolute top-10 right-0 -z-10 h-56 w-72" />
      <span aria-hidden="true" className="dot-grid absolute bottom-10 left-0 -z-10 h-56 w-72" />
      <div className="mx-auto max-w-3xl px-5 py-20">
        <Stage className="text-center">
          <Reveal>
            <SectionEyebrow center>{t.faq.eyebrow}</SectionEyebrow>
          </Reveal>
          <Reveal>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">{t.faq.title}</h2>
          </Reveal>
        </Stage>

        <Stage className="mt-10 space-y-3" gap={stagger.base}>
          {items.map((item, index) => {
            const isOpen = open === index
            const panel = `faq-answer-${index}`
            return (
              <Reveal key={item.q} variants={rise}>
                <div className={cx('glass rounded-[1.25rem] transition-[background-color] duration-300', isOpen && 'glass-strong')}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panel}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-extrabold text-ink"
                  >
                    {item.q}
                    <m.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
                      className={cx(
                        'grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-300',
                        isOpen ? 'bg-signal text-on-signal' : 'bg-signal-soft text-signal-ink',
                      )}
                    >
                      <Plus aria-hidden="true" strokeWidth={2.2} className="size-4" />
                    </m.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <m.div
                        id={panel}
                        key="answer"
                        role="region"
                        variants={collapse}
                        initial="hidden"
                        animate="shown"
                        exit="exit"
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-muted">{item.a}</p>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            )
          })}
        </Stage>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- final cta */

/**
 * The closing line in two tones: everything before the last sentence slightly dimmed, the last
 * one — the instruction — at full strength. A headline with one sentence stays one tone.
 */
function TwoTone({ text }: { text: string }) {
  const parts = text.split(/(?<=[.!?])\s+/)
  if (parts.length < 2) return <>{text}</>
  const last = parts.pop()
  return (
    <>
      <span className="text-white/70">{parts.join(' ')}</span> {last}
    </>
  )
}


/**
 * The closing band: a deep blue-to-violet field with its own drifting light, a glass panel for
 * the words and the Panda floating beside it. Fixed colours rather than tokens — it is a lit
 * billboard in both themes, not a themed surface.
 */
function FinalCta() {
  const t = useT().landing
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <m.div
        initial={{ opacity: 0, y: 48, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: VIEW_MARGIN }}
        transition={{ type: 'spring', duration: 0.9, bounce: 0.2 }}
        className="relative isolate overflow-hidden rounded-[2.25rem] shadow-[0_30px_70px_-24px_rgb(45_80_200/0.6)]"
        style={{ background: 'linear-gradient(125deg,#1f5fd6 0%,#3d7cf0 38%,#6d5cf2 72%,#22a9cf 100%)' }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <span className="aurora__blob -top-24 -left-16 h-80 w-96 bg-[#8fd0ff] [--aurora-opacity:0.45]" />
          <span className="aurora__blob -right-20 -bottom-28 h-96 w-[28rem] bg-[#b59cff] [--aurora-opacity:0.5] [--drift-delay:-8s]" />
          <span className="aurora__grid [--grid-line:rgb(255_255_255/0.08)]" />
        </div>

        <div className="relative grid items-center gap-2 px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 className="text-3xl leading-tight font-black tracking-tight text-balance text-white sm:text-4xl lg:text-[2.6rem]">
              <TwoTone text={t.final.title} />
            </h2>
            <p className="mt-3 max-w-md text-base text-white/85">{t.final.body}</p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link
                to="/signin"
                className="raised inline-flex h-14 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-white px-7 text-base font-extrabold whitespace-nowrap text-[#1f5fd6] [--depth:rgb(19_60_160/0.35)] [--edge:5px] [--glow:rgb(19_60_160/0.3)] sm:px-9"
              >
                {t.final.cta}
                <ArrowRight aria-hidden="true" strokeWidth={2.2} className="size-[18px]" />
              </Link>
              <Link to="/signin" className="text-sm font-bold text-white/90 hover:text-white hover:underline">
                {t.final.signIn}
              </Link>
            </div>
          </div>
          <div className="relative hidden justify-center lg:flex">
            <span aria-hidden="true" className="absolute top-1/2 left-1/2 size-72 -translate-1/2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md" />
            <img
              src="/characters/panda.webp"
              alt=""
              aria-hidden="true"
              className="float relative h-64 w-auto drop-shadow-[0_24px_30px_rgb(18_30_90/0.4)]"
            />
          </div>
        </div>
      </m.div>
    </section>
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
        { label: t.footer.privacyPolicy, href: '/privacy.html' },
        { label: t.footer.terms, href: '#' },
      ],
    },
  ]

  return (
    <footer className="relative overflow-hidden border-t border-hairline bg-[var(--glass-bg)]">
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
      className="raised raised-sm flex size-9 items-center justify-center rounded-full border border-hairline bg-ground-raised text-ink-muted hover:border-ink-faint hover:text-ink"
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

function ShieldIcon() {
  return (
    <ShieldCheck aria-hidden="true" strokeWidth={2} className="size-4" />
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

/** A section's label: a small glass chip with a spark, so every section opens the same way. */
function SectionEyebrow({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <div className={cx('flex', center && 'justify-center')}>
      <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-extrabold tracking-[0.14em] text-signal-ink uppercase">
        <Sparkles aria-hidden="true" strokeWidth={0} className="size-3.5 fill-current" />
        {children}
      </p>
    </div>
  )
}

/** A small signal-ink check, for feature lists and trust marks. */
function Tick() {
  return (
    <Check aria-hidden="true" strokeWidth={2.4} className="size-4 text-signal-ink" />
  )
}

function PhoneGlyph() {
  return (
    <Smartphone aria-hidden="true" strokeWidth={2} className="size-4 text-ink-muted" />
  )
}

/** The small "opens elsewhere" arrow beside a linked handle. */
function ExternalGlyph() {
  return (
    <ArrowUpRight aria-hidden="true" strokeWidth={2.4} className="size-3.5 text-signal-ink" />
  )
}

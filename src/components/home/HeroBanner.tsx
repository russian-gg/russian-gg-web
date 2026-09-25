import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { PlayGlyph } from '../ui'
import heroBackdrop from '../../assets/images/landing_bg.webp'

/**
 * The top of the home screen.
 *
 * It is a banner rather than a dashboard header on purpose: the first thing a learner meets
 * each day should say what they are here for and give them the one door in, and the numbers
 * that used to sit in this position are all still on the screen — under the card below it and
 * on the progress screen, where somebody goes when they actually want them.
 *
 * The artwork is the supplied `landing_bg` rather than the drawn SVG that stood in for it.
 * It is a single wide picture with its subject on the right and open sky on the left, so it is
 * laid in as one covering layer and the copy sits over the empty half — no seam to line up and
 * nothing to keep in step as the banner resizes.
 *
 * It is a WebP at 1600px rather than the 2172px PNG it was delivered as: this is the largest
 * element on the first screen a returning learner sees, and 1.3 MB of it was the single
 * heaviest thing the product asked for. 1600 still clears the widest the banner is ever drawn.
 *
 * Everything else it is built from is already the product's: the pill geometry and press
 * physics come from `Button`, the radius from the card token, the type scale from the rest of
 * Home.
 */
export function HeroBanner({ to }: { to: string }) {
  const t = useT()

  return (
    <section
      /*
       * A card and a half. The reference is rounder than a content card, and deriving it from
       * the token keeps the banner in step if the card radius is ever retuned.
       */
      className="home-hero relative isolate overflow-hidden rounded-[calc(var(--radius-card)*1.5)] border border-hairline"
      style={{
        // Shows through while the picture loads, and fills any sliver cover leaves behind.
        background: 'linear-gradient(160deg, var(--hero-sky-top) 0%, var(--hero-sky-bottom) 100%)',
      }}
    >
      {/*
        The object-position is the whole trick. The picture is roughly 3:1 and the banner is
        wider than that on a desktop, so cover crops the top and bottom and the scene arrives
        intact. On a phone the banner is far squarer and cover crops the sides instead, which
        would leave a slab of empty sky — so the framing shifts onto the domes, which is the
        part worth keeping when there is only room for one.
      */}
      <img
        src={heroBackdrop}
        alt=""
        aria-hidden="true"
        /* Almost always the largest element in the viewport on arrival, so it is not lazy. */
        fetchPriority="high"
        decoding="async"
        className="pointer-events-none absolute inset-0 -z-10 size-full object-cover object-[72%_50%] md:object-[100%_50%]"
      />

      {/*
        Keeps the copy legible over whatever the crop happens to put behind it. Vertical on a
        phone, where the text sits above the domes; horizontal from `md`, where it sits beside
        them. In the dark theme it doubles as the dimmer that stops a daylit picture glowing
        out of a dark page.
      */}
      <div aria-hidden="true" className="home-hero__scrim pointer-events-none absolute inset-0 -z-10" />

      {/*
        A column with a floor, so the action sits at the bottom of the banner rather than
        halfway down it.

        The space under the button was previously just padding — `pb-32` — held open so the
        domes had somewhere to be. That put the one thing on this screen worth pressing in the
        middle of the picture, with a hand's width of empty sky beneath it. Now the block
        carries the height instead and the button is pushed to the floor of it, which is both
        nearer the thumb and where the eye ends up after reading the two lines above.

        From `md` the banner is side-by-side rather than stacked, the copy no longer sits over
        the artwork, and the button goes back into normal flow directly under the subtitle.
      */}
      <div className="relative flex min-h-[20rem] flex-col px-5 pt-7 pb-6 sm:min-h-[22rem] sm:px-8 sm:pt-8 sm:pb-8 md:min-h-0 md:max-w-[58%] md:py-9 lg:py-10 lg:pl-10">
        <p
          className="text-[11px] font-black tracking-[0.18em] uppercase sm:text-xs"
          style={{ color: 'var(--hero-script)' }}
        >
          {t.home.hero.eyebrow}
        </p>

        <h1
          className="mt-2.5 text-[1.6rem] leading-[1.14] font-black tracking-tight text-balance sm:text-[2rem] lg:text-[2.25rem]"
          style={{ color: 'var(--hero-ink)' }}
        >
          {t.home.hero.title}
        </h1>

        <p
          className="mt-2.5 max-w-md text-[14px] leading-relaxed sm:text-[15px]"
          style={{ color: 'var(--hero-ink-muted)' }}
        >
          {t.home.hero.subtitle}
        </p>

        {/*
          The product's own primary control, not a second one that looks like it: `LinkButton`
          is skipped only because this needs a size between `md` and `lg` and its own icons, so
          the variant's classes are borrowed directly rather than re-declared.

          Full width on a phone, hugging its label from `sm`. It used to be `inline-flex` at
          every size with `whitespace-nowrap`, and the label is translated: "Bugungi darsni
          boshlash" plus the play disc, the arrow and the padding comes to about 263px against
          roughly 248px of room inside the banner on a 320px screen. The banner clips its
          overflow, so the arrow was cut off — and the Russian label is longer still. Going
          full width is what this product already says a primary action does on a phone; see
          `block` on `Button` in `components/ui.tsx`.
        */}
        {/* `mt-auto` is what pins it to the floor; the padding guarantees a gap from the
            subtitle even on a screen short enough that the two would otherwise meet. */}
        <div className="mt-auto pt-8 md:mt-0 md:pt-5">
          <Link
            to={to}
            data-ui-sound="whoosh"
            className={
              'flex h-12 w-full items-center justify-center gap-2.5 rounded-[var(--radius-control)] ' +
              'sm:inline-flex sm:w-auto sm:justify-start ' +
              'border border-transparent bg-signal px-4 text-[15px] font-extrabold sm:pr-5 sm:pl-2 ' +
              'tracking-[0.01em] text-on-signal select-none ' +
              'shadow-[0_4px_0_0_var(--color-signal-depth)] ' +
              'transition-[background-color,box-shadow,transform] duration-150 ' +
              'hover:-translate-y-0.5 hover:bg-signal-hover hover:shadow-[0_6px_0_0_var(--color-signal-depth)] ' +
              'active:translate-y-1 active:shadow-none'
            }
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/22">
              <PlayGlyph />
            </span>
            <span className="truncate">{t.home.hero.cta}</span>
            <ArrowGlyph />
          </Link>
        </div>
      </div>
    </section>
  )
}

function ArrowGlyph() {
  return (
    <ArrowRight aria-hidden="true" strokeWidth={2.2} className="size-[18px] shrink-0" />
  )
}

import { fill, useT } from '../lib/i18n'
import heroBackdrop from '../assets/images/90_days_lesson_bg.webp'

/**
 * The top of the ninety-day path.
 *
 * It answers the two questions a learner opens this screen with — what is this, and how far am
 * I — before any of the ninety cards below it. The count used to be a small badge beside the
 * heading; here it is a ring, because "3 of 90" is a shape long before it is a number, and the
 * shape is the encouraging part on day three.
 *
 * The banner is a band rather than a picture with a caption: the copy, the ring and the note card
 * sit on one line across it, packed from the left so the two of them stay beside the heading
 * instead of drifting to the far edge on a wide display.
 *
 * The framing is high (`18%` down) because the hand-written line is painted into the top right
 * of the artwork, and the point of a band this short is that you can still read it. That is the
 * trade this asset forces: it is 3:1, the band is far wider than that, and a short window over it
 * can hold the painted line or the forest along the bottom, not both. A version of the picture
 * without the line burned in would free the framing to drop back onto the hills.
 *
 * From `xl` the row stops short of the right edge so the note card does not land on that line.
 *
 * The artwork is a 24 KB WebP at 1600px rather than the 1.1 MB PNG it was delivered as — the
 * same treatment `landing_bg` gets, and for the same reason: this audience pays for its data.
 */
export function CoursePathHero({
  completedDays,
  totalDays,
}: {
  completedDays: number
  totalDays: number
}) {
  const t = useT()
  const copy = t.path.hero

  return (
    <section
      className="home-hero relative isolate overflow-hidden rounded-[calc(var(--radius-card)*1.5)] border border-hairline"
      style={{
        // Shows through while the picture loads, and fills any sliver a crop leaves behind.
        background: 'linear-gradient(160deg, var(--hero-sky-top) 0%, var(--hero-sky-bottom) 100%)',
      }}
    >
      <img
        src={heroBackdrop}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className="block h-[200px] w-full object-cover object-[62%_40%] sm:h-[230px] md:h-[250px] md:object-[50%_18%] lg:h-[280px]"
      />

      {/* Keeps the copy legible over whatever is behind it — vertical on a phone, horizontal from `md`. */}
      <div aria-hidden="true" className="home-hero__scrim pointer-events-none absolute inset-0" />

      <div className="absolute inset-0 flex items-center px-5 sm:px-7 lg:px-10 xl:pr-[17%]">
        <div className="flex w-full items-center gap-4 sm:gap-8 lg:gap-12">
          <div className="min-w-0 max-w-xs shrink lg:max-w-sm">
            <p
              className="text-[10px] font-black tracking-[0.18em] uppercase sm:text-xs"
              style={{ color: 'var(--hero-script)' }}
            >
              {copy.eyebrow}
            </p>

            <h1
              className="mt-1.5 text-[1.5rem] leading-[1.1] font-black tracking-tight text-balance sm:text-[2rem] lg:text-[2.5rem]"
              style={{ color: 'var(--hero-ink)' }}
            >
              {t.path.title}
            </h1>

            <p
              className="mt-1.5 max-w-md text-[13px] leading-relaxed sm:text-[15px]"
              style={{ color: 'var(--hero-ink-muted)' }}
            >
              {copy.subtitle}
            </p>
          </div>

          <DayRing completed={completedDays} total={totalDays} unit={copy.dayUnit} />

          {/*
            Opaque rather than a tint of the sky: it is the one piece of running text out here,
            and running text over an illustration is where legibility goes.
          */}
          <div className="hidden w-64 shrink-0 rounded-2xl bg-ground-raised p-4 shadow-[0_8px_24px_rgb(22_24_29/0.08)] lg:block">
            <p className="text-sm font-black text-ink">{copy.noteTitle}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{copy.noteBody}</p>
          </div>

          {/*
            No hand-written line here: "Kichik qadamlardan katta natijalarga!" is painted into
            the artwork itself, and setting it again in HTML printed it twice.
          */}
        </div>
      </div>
    </section>
  )
}

/**
 * Days finished, as a ring. The track is the full ninety and the arc is what is behind the
 * learner — `strokeDasharray` on a rotated circle, so the arc starts at twelve o'clock rather
 * than at three where SVG puts zero degrees.
 */
function DayRing({ completed, total, unit }: { completed: number; total: number; unit: string }) {
  const t = useT()
  const safeTotal = Math.max(1, total)
  const safeCompleted = Math.min(safeTotal, Math.max(0, completed))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const progress = (safeCompleted / safeTotal) * circumference

  return (
    <div
      role="img"
      aria-label={fill(t.common.dayOfTotal, { day: safeCompleted, total: safeTotal })}
      className="relative grid size-[68px] shrink-0 place-items-center sm:size-[84px]"
    >
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="var(--color-ground-raised)" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--color-ground-sunken)"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--color-signal)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <span className="absolute grid place-items-center text-center">
        <span className="text-sm font-black text-ink tabular-nums sm:text-base">
          {safeCompleted}/{safeTotal}
        </span>
        <span className="text-[10px] font-bold text-ink-muted sm:text-[11px]">{unit}</span>
      </span>
    </div>
  )
}

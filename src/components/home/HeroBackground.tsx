import { useId } from 'react'

/**
 * The banner's illustration: a Russian skyline under a pale sky, drawn rather than shipped as
 * an image.
 *
 * SVG for three reasons that all matter on this particular screen. It is the first thing a
 * learner sees every day, so it must be on the page at first paint rather than a request
 * later. It has to survive from a 360px phone to a 1600px desktop without a second asset. And
 * every colour in it is a CSS variable, which is what lets the same drawing hold in the dark
 * theme instead of glowing in the middle of a dark page.
 *
 * Decorative throughout: the banner states its own meaning in text beside it, so the whole
 * drawing is hidden from assistive technology.
 */
export function HeroBackground() {
  /*
   * Gradient and filter ids live in one global namespace per document. The landing page draws
   * its own clouds, so anything fixed here could quietly re-point a filter on a screen this
   * file has never heard of.
   */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const sky = `${uid}sky`
  const dome = `${uid}dome`
  const glow = `${uid}glow`
  const tower = `${uid}tower`

  return (
    <svg
      viewBox="0 0 1200 340"
      /*
       * Cropped from the left as the banner narrows, never squashed. The cathedral sits at the
       * right of the frame, so what a phone loses is empty sky rather than the subject.
       */
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      className="absolute inset-0 size-full"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="var(--hero-sky-top)" />
          <stop offset="100%" stopColor="var(--hero-sky-bottom)" />
        </linearGradient>

        {/* Lit from the upper left, so every dome turns the same way and the cluster reads as
            one building rather than a row of separate ones. */}
        <linearGradient id={dome} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="var(--hero-dome-light)" />
          <stop offset="55%" stopColor="var(--hero-dome)" />
          <stop offset="100%" stopColor="var(--hero-dome-deep)" />
        </linearGradient>

        <linearGradient id={tower} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--hero-dome-light)" />
          <stop offset="100%" stopColor="var(--hero-dome)" />
        </linearGradient>

        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--hero-glow)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <rect width="1200" height="340" fill={`url(#${sky})`} />

      {/* Air behind the domes. It is what stops the skyline reading as a sticker on a flat
          panel, and it is the only soft-focus element in the drawing. */}
      <ellipse cx="880" cy="215" rx="330" ry="180" fill={`url(#${glow})`} />

      <Clouds />
      <Skyline />
      <StillBirds />
      <Cathedral domeFill={`url(#${dome})`} towerFill={`url(#${tower})`} />
      <Trees />

      {/* The ground is a single band, not a horizon line: the reference sits the buildings on
          a pale shelf, which keeps the bottom edge of the banner quiet. */}
      <path d="M0 296h1200v44H0z" fill="var(--hero-far)" opacity=".55" />

      <Script />
    </svg>
  )
}

/**
 * One dome, drawn from its base rather than from a template. `r` is the half-width at the
 * widest point; the silhouette bulges past it and closes to a point at `1.85r` above, which is
 * the proportion that separates an onion dome from a semicircle.
 */
function Dome({ cx, baseY, r, fill }: { cx: number; baseY: number; r: number; fill: string }) {
  const tip = baseY - r * 1.85
  return (
    <>
      <path
        d={
          `M${cx - r} ${baseY}` +
          `C${cx - r * 1.16} ${baseY - r * 0.62} ${cx - r * 0.92} ${baseY - r * 1.3} ${cx} ${tip}` +
          `C${cx + r * 0.92} ${baseY - r * 1.3} ${cx + r * 1.16} ${baseY - r * 0.62} ${cx + r} ${baseY}Z`
        }
        fill={fill}
      />
      {/* The cross is what names the building. Kept as a hairline so it survives at phone
          scale without turning into a blob. */}
      <path
        d={`M${cx} ${tip - 2}v-${r * 0.62}M${cx - r * 0.2} ${tip - r * 0.4}h${r * 0.4}`}
        stroke="var(--hero-line)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  )
}

/**
 * A tower: the dome, the cornice it lands on, and the shaft under it.
 *
 * The shaft is narrower than the dome's half-width, so the dome overhangs the wall it sits on.
 * That overhang is the whole illusion — a dome the same width as its tower reads as a roof,
 * and the building stops being this one.
 */
function Tower({
  cx,
  shaftTop,
  r,
  groundY,
  domeFill,
  towerFill,
}: {
  cx: number
  shaftTop: number
  r: number
  groundY: number
  domeFill: string
  towerFill: string
}) {
  const half = r * 0.72
  const cornice = r * 0.3

  return (
    <g>
      <path d={`M${cx - half} ${groundY}V${shaftTop}h${half * 2}V${groundY}Z`} fill={towerFill} />

      {/* Slightly wider than the wall, which is what a cornice is: the ledge the dome lands on. */}
      <rect x={cx - half - 3} y={shaftTop} width={half * 2 + 6} height={cornice} fill="var(--hero-dome-deep)" />

      {/* One arched window, cut in the sky's own colour rather than painted, so the opening
          stays an opening in both themes. */}
      <path
        d={`M${cx - r * 0.26} ${groundY - 14}v-${r * 0.6}a${r * 0.26} ${r * 0.26} 0 0 1 ${r * 0.52} 0v${r * 0.6}Z`}
        fill="var(--hero-sky-top)"
        opacity=".55"
      />

      <Dome cx={cx} baseY={shaftTop} r={r} fill={domeFill} />
    </g>
  )
}

/**
 * The cluster: four domed towers stepped up toward a central tent roof, on one shared plinth.
 *
 * Two proportions carry it. The domes are large against short shafts — the reverse reads as a
 * row of chimneys — and the whole group is tight enough that the silhouette resolves into a
 * single mass rather than five separate buildings. The stepping is deliberately uneven: the
 * inner pair is taller than the outer pair by more than the outer pair differs from each
 * other, which is what gives the outline its lean rather than a symmetrical staircase.
 */
function Cathedral({ domeFill, towerFill }: { domeFill: string; towerFill: string }) {
  const ground = 300

  return (
    <g>
      <Tower cx={752} shaftTop={222} r={30} groundY={ground} domeFill={domeFill} towerFill={towerFill} />
      <Tower cx={1068} shaftTop={226} r={29} groundY={ground} domeFill={domeFill} towerFill={towerFill} />
      <Tower cx={824} shaftTop={200} r={36} groundY={ground} domeFill={domeFill} towerFill={towerFill} />
      <Tower cx={998} shaftTop={196} r={38} groundY={ground} domeFill={domeFill} towerFill={towerFill} />

      {/*
        The centre. A tent roof, not a dome, and the one element that is slim rather than round:
        it is what the four domes are arranged around, and it only works as a peak if it stays
        narrower than any of them.
      */}
      <g>
        <path d={`M877 ${ground}V198h66v102Z`} fill={towerFill} />
        <rect x="872" y="192" width="76" height="12" fill="var(--hero-dome-deep)" />
        <path d="M910 96 948 192H872Z" fill={domeFill} />
        <Dome cx={910} baseY={96} r={15} fill={domeFill} />
        <path
          d={`M898 ${ground}v-54a12 12 0 0 1 24 0v54Z`}
          fill="var(--hero-sky-top)"
          opacity=".55"
        />
      </g>

      {/*
        The plinth, drawn over the shafts rather than behind them. It cuts every tower off at
        the same line, so five separate walls end as one building standing on one footing.
      */}
      <path d={`M714 ${ground}v-30h392v30Z`} fill={towerFill} />
      <rect x="714" y="266" width="392" height="6" fill="var(--hero-dome-deep)" opacity=".55" />
    </g>
  )
}

/** Soft banks rather than outlined puffs — the sky should read as weather, not as clip art. */
function Clouds() {
  return (
    <g fill="var(--hero-cloud)">
      <path d="M96 118q14-26 38-16 8-24 34-20 22 3 26 24 20-2 24 14 2 12-14 12H110q-20 0-14-14Z" />
      <path d="M470 76q11-20 30-13 6-19 27-16 17 3 20 19 16-2 19 11 2 9-11 9H481q-16 0-11-10Z" />
      <path d="M1008 66q9-17 25-11 5-16 22-13 14 2 17 15 13-1 16 9 1 8-9 8h-77q-13 0-11-8Z" opacity=".75" />
      <path d="M258 218q12-21 31-13 7-20 28-16 18 3 21 19 16-1 19 11 2 10-11 10H269q-17 0-11-11Z" opacity=".5" />
    </g>
  )
}

/** The city behind the cathedral, flattened to one pale silhouette. It exists to give the
    domes something to stand in front of, so it carries no detail of its own. */
function Skyline() {
  return (
    <g fill="var(--hero-far)">
      {/*
        The haze first, then the buildings on top of it. Drawn the other way round the band
        covered their lower two thirds and the whole horizon disappeared into it.
      */}
      <path d="M0 274h1200v26H0z" opacity=".45" />

      {/*
        Low and even. It is the horizon the cathedral rises out of, so the moment any of it
        competes for height the composition has two subjects instead of one.
      */}
      <path
        d="M96 300v-44h34v-14h22v14h28v44Zm128 0v-36h56v36Zm76 0v-52h30v-13h20v13h28v52Zm100 0v-30h46v30Zm70 0v-48h32v-14h20v14h26v48Zm90 0v-34h52v34Z"
        opacity=".9"
      />

      {/* A second row, paler and shorter, tucked behind the cathedral so the cluster has
          something to stand in front of rather than sitting on bare sky. */}
      <path
        d="M700 300v-30h34v-12h18v12h26v30Zm120 0v-22h44v22Zm180 0v-26h40v26Zm70 0v-34h28v-12h16v46Z"
        opacity=".55"
      />
    </g>
  )
}

/**
 * Birds painted into the drawing.
 *
 * Distinct from the four that fly over it: these belong to the illustration and never move, so
 * a learner who has asked for reduced motion still gets a sky with birds in it rather than an
 * empty one.
 */
function StillBirds() {
  return (
    <g
      fill="none"
      stroke="var(--hero-bird)"
      strokeWidth="2"
      strokeLinecap="round"
      opacity=".38"
    >
      <path d="M612 128q9-11 18 0M630 128q9-11 18 0" />
      <path d="M690 96q7-9 14 0M704 96q7-9 14 0" opacity=".8" />
      <path d="M1130 144q6-7 12 0M1142 144q6-7 12 0" opacity=".7" />
    </g>
  )
}

/** Two stands of trees at the foot of the cluster, to stop the buildings meeting the ground
    edge-on. Blue like everything else here: the palette is the sky's, not a landscape's. */
function Trees() {
  return (
    <g>
      {/*
        Outside the footprint, never in front of it. They exist to soften the two corners where
        the building meets the ground; a tree overlapping a wall would read as a mistake at this
        level of detail, because nothing else in the drawing overlaps anything.
      */}
      {/* Trunks first, so each canopy lands on top of its own and the join is never a seam. */}
      <g stroke="var(--hero-tree-deep)" strokeWidth="6" strokeLinecap="round">
        <path d="M646 300v-24M1132 300v-21M672 300v-17M1162 300v-15" />
      </g>
      <g fill="var(--hero-tree-deep)" opacity=".6">
        <path d="M672 286q-19 0-19-18 0-16 13-23 2-20 19-20t19 20q13 7 13 23 0 18-19 18Z" />
        <path d="M1162 284q-16 0-16-15 0-13 11-19 2-17 16-17t16 17q11 6 11 19 0 15-16 15Z" />
      </g>
      <g fill="var(--hero-tree)">
        <path d="M646 278q-24 0-24-23 0-20 16-29 2-25 24-25t24 25q16 9 16 29 0 23-24 23Z" />
        <path d="M1132 280q-21 0-21-20 0-17 14-25 2-22 21-22t21 22q14 8 14 25 0 20-21 20Z" />
      </g>
    </g>
  )
}

/**
 * The two handwritten greetings from the reference.
 *
 * A generic `cursive` stack rather than a web font: this is four decorative words, and the
 * stylesheet's own rule is that nothing on a page a learner opens daily costs a third-party
 * request. Every desktop and mobile platform resolves `cursive` to something handwritten, and
 * the italic that follows keeps the two lines distinct from the interface even where it does
 * not.
 */
function Script() {
  const font = '"Segoe Script", "Bradley Hand", "Snell Roundhand", "Apple Chancery", cursive'

  return (
    <g fill="var(--hero-script)" fontFamily={font} fontStyle="italic" fontWeight="700">
      <text x="1064" y="96" fontSize="38" transform="rotate(-7 1064 96)">
        Privet!
      </text>
      <text x="1044" y="152" fontSize="28" transform="rotate(-9 1044 152)" opacity=".85">
        Давай
      </text>
      <text x="1058" y="186" fontSize="28" transform="rotate(-9 1058 186)" opacity=".85">
        учиться!
      </text>
    </g>
  )
}

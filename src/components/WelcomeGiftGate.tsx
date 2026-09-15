import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { fill, useT } from '../lib/i18n'
import type { WelcomeGiftStatus } from '../lib/types'

type Phase = 'choosing' | 'opening' | 'revealed'

/**
 * The chosen box rumbles for at least this long, however fast the claim request returns: the
 * build-up is half of the reward. A slower request simply keeps it rumbling at full strength.
 */
const MIN_OPENING_MS = 1400
// Pause between hover wiggles while the pointer stays on a box.
const HOVER_SHAKE_PAUSE_MS = 700

type Ribbon = { edge: string; shine: string; face: string; deep: string; line: string; fold: string; tail: string }
type BoxWrap = {
  light: string
  mid: string
  dark: string
  pattern: 'dots' | 'stripes' | 'cross'
  ink: string
  inkOpacity: number
  ribbon: Ribbon
}

const GOLD_RIBBON: Ribbon = {
  edge: '#d9981f', shine: '#ffe9a3', face: '#f6cc55', deep: '#cf8a15', line: '#c07e10', fold: '#a8680c', tail: '#e3a52a',
}
// Pero's blue shoes: a gold ribbon would disappear on his gold box.
const BLUE_RIBBON: Ribbon = {
  edge: '#1d4b95', shine: '#8fb6f0', face: '#4a7fd6', deep: '#2a61b6', line: '#04286c', fold: '#04286c', tail: '#3a70c8',
}

const BOX_WRAPS: BoxWrap[] = [
  { light: '#8dbdfb', mid: '#5b9bf5', dark: '#2d76dd', pattern: 'dots', ink: '#ffffff', inkOpacity: 0.28, ribbon: GOLD_RIBBON },
  { light: '#ffa58f', mid: '#f2735a', dark: '#cf4a35', pattern: 'stripes', ink: '#ffffff', inkOpacity: 0.2, ribbon: GOLD_RIBBON },
  // Pero's gold, sampled from public/characters/pero.png.
  { light: '#fae462', mid: '#f2b409', dark: '#d18f04', pattern: 'cross', ink: '#ffffff', inkOpacity: 0.5, ribbon: BLUE_RIBBON },
]

const CONFETTI_COLORS = ['#5b9bf5', '#f6cc55', '#f2735a', '#fae462', '#2a61b6', '#ffffff']
const CONFETTI_SHAPES = ['', ' is-round', ' is-streamer', ' is-star']

type Piece = { id: number; className: string; style: CSSProperties }

/** Drifts behind the panel the whole time the gift is on screen. */
const ambient: Piece[] = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  className: `welcome-confetti${CONFETTI_SHAPES[index % 4]}`,
  style: {
    left: `${(index * 29 + 3) % 100}%`,
    backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    animationDuration: `${10 + (index % 7) * 1.4}s`,
    // Negative delays start every piece mid-fall, so the screen is already sprinkled on open.
    animationDelay: `-${((index * 1.9) % 14).toFixed(1)}s`,
    '--sway': `${((index * 41) % 80) - 40}px`,
    '--spin': `${240 + ((index * 83) % 360)}deg`,
  } as CSSProperties,
}))

const rain: Piece[] = Array.from({ length: 96 }, (_, index) => ({
  id: index,
  className: `welcome-confetti${CONFETTI_SHAPES[index % 4]} welcome-rain`,
  style: {
    left: `${(index * 37 + 7) % 100}%`,
    backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    animationDelay: `${((index % 24) * 0.09).toFixed(2)}s`,
    animationDuration: `${(2.6 + (index % 9) * 0.24).toFixed(2)}s`,
    '--sway': `${((index * 53) % 90) - 45}px`,
    '--spin': `${360 + ((index * 97) % 540)}deg`,
  } as CSSProperties,
}))

const burst: Piece[] = Array.from({ length: 56 }, (_, index) => {
  const angle = (((360 / 56) * index + (index % 3) * 5) * Math.PI) / 180
  const distance = 150 + (index % 7) * 34
  return {
    id: index,
    className: `welcome-confetti${CONFETTI_SHAPES[index % 4]} welcome-burst-piece`,
    style: {
      backgroundColor: CONFETTI_COLORS[(index + 2) % CONFETTI_COLORS.length],
      animationDelay: `${((index % 6) * 0.02).toFixed(2)}s`,
      '--x': `${(Math.cos(angle) * distance).toFixed(1)}px`,
      '--y': `${(Math.sin(angle) * distance * 0.8 - 40).toFixed(1)}px`,
      '--spin': `${240 + ((index * 71) % 420)}deg`,
    } as CSSProperties,
  }
})

const coins = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  angle: (360 / 24) * index,
  distance: 105 + (index % 4) * 26,
  delay: `${(index % 5) * 0.035}s`,
}))

/** Star sparks that jump out of the lid seam while the box rumbles. */
const sparks = Array.from({ length: 8 }, (_, index) => ({
  id: index,
  style: {
    animationDelay: `${((index % 4) * 0.17).toFixed(2)}s`,
    '--jx': `${(index - 3.5) * 16}px`,
    '--jy': `${-48 - (index % 3) * 18}px`,
  } as CSSProperties,
}))

/** Twinkles orbiting the rosette once it is out. */
const sparkles = Array.from({ length: 10 }, (_, index) => {
  const angle = (((360 / 10) * index) * Math.PI) / 180
  const radius = 84 + (index % 3) * 14
  return {
    id: index,
    gold: index % 2 === 1,
    style: {
      animationDelay: `${(0.6 + (index % 5) * 0.28).toFixed(2)}s`,
      '--sx': `${(Math.cos(angle) * radius).toFixed(1)}px`,
      '--sy': `${(Math.sin(angle) * radius * 0.85).toFixed(1)}px`,
    } as CSSProperties,
  }
})

const ROSETTE_POINTS = Array.from({ length: 48 }, (_, index) => {
  const radius = index % 2 ? 56 : 63
  const angle = (Math.PI * 2 * index) / 48 - Math.PI / 2
  return `${(80 + radius * Math.cos(angle)).toFixed(1)},${(74 + radius * Math.sin(angle)).toFixed(1)}`
}).join(' ')

export function WelcomeGiftGate() {
  const t = useT()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>('choosing')
  const [selectedBox, setSelectedBox] = useState<number | null>(null)
  const [reward, setReward] = useState<WelcomeGiftStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  const [shakingBox, setShakingBox] = useState<number | null>(null)
  const hoveredBoxRef = useRef<number | null>(null)
  const shakeTimerRef = useRef<number | undefined>(undefined)

  const isProtectedPage = !['/', '/signin', '/signup', '/onboarding'].includes(location.pathname)
  const enabled = Boolean(user?.hasCompletedDiagnostic && isProtectedPage)
  const { data } = useQuery({
    queryKey: ['welcome-gift', user?.id],
    queryFn: () => api.get<WelcomeGiftStatus>('/billing/welcome-gift'),
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  })

  const visible = Boolean(enabled && data?.isAvailable && !data.isClaimed && !hidden)

  useEffect(() => {
    setHidden(false)
    setPhase('choosing')
    setSelectedBox(null)
    setReward(null)
    setError(null)
  }, [user?.id])

  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [visible])

  useEffect(() => () => window.clearTimeout(shakeTimerRef.current), [])

  const prizeText = useMemo(() => {
    if (!reward) return ''
    return reward.bonusFreeDays > 0
      ? fill(t.welcomeGift.bonusPrize, { days: reward.bonusFreeDays })
      : fill(t.welcomeGift.discountPrize, { percent: reward.discountPercent })
  }, [reward, t])

  const badge = useMemo(() => {
    if (!reward) return null
    return reward.bonusFreeDays > 0
      ? { value: `+${reward.bonusFreeDays}`, label: t.welcomeGift.badgeDays }
      : { value: `${reward.discountPercent}%`, label: t.welcomeGift.badgeDiscount }
  }, [reward, t])

  const visibleBoxes = phase === 'choosing' || selectedBox === null
    ? [1, 2, 3]
    : [selectedBox]

  if (!visible) return null

  function startHoverShake(box: number) {
    hoveredBoxRef.current = box
    window.clearTimeout(shakeTimerRef.current)
    setShakingBox(box)
  }

  function stopHoverShake() {
    hoveredBoxRef.current = null
    window.clearTimeout(shakeTimerRef.current)
    setShakingBox(null)
  }

  // Each wiggle plays once; while the box is still hovered, queue the next one after a pause.
  function queueNextShake(box: number) {
    setShakingBox(null)
    shakeTimerRef.current = window.setTimeout(() => {
      if (hoveredBoxRef.current === box) setShakingBox(box)
    }, HOVER_SHAKE_PAUSE_MS)
  }

  function openPlans() {
    setHidden(true)
    navigate('/paywall')
  }

  async function choose(box: number) {
    if (phase !== 'choosing') return
    const startedAt = performance.now()
    setSelectedBox(box)
    setPhase('opening')
    setError(null)

    try {
      const result = await api.post<WelcomeGiftStatus>('/billing/welcome-gift/claim', {
        selectedBox: box,
      })
      setReward(result)
      queryClient.setQueryData<WelcomeGiftStatus>(['welcome-gift'], result)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['entitlement'] }),
        queryClient.invalidateQueries({ queryKey: ['course-map'] }),
      ])
      const remaining = Math.max(0, MIN_OPENING_MS - (performance.now() - startedAt))
      window.setTimeout(() => setPhase('revealed'), remaining)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.welcomeGift.error)
      setPhase('choosing')
      setSelectedBox(null)
    }
  }

  return (
    <div className={`welcome-gift-overlay welcome-gift-${phase}`} role="dialog" aria-modal="true" aria-labelledby="welcome-gift-title">
      <div className="welcome-gift-glow" aria-hidden="true" />

      <div className="welcome-gift-ambient" aria-hidden="true">
        {ambient.map((piece) => <i key={piece.id} className={piece.className} style={piece.style} />)}
      </div>

      {phase === 'revealed' && (
        <div className="welcome-gift-effects" aria-hidden="true">
          {rain.map((piece) => <i key={`rain-${piece.id}`} className={piece.className} style={piece.style} />)}
          {burst.map((piece) => <i key={`burst-${piece.id}`} className={piece.className} style={piece.style} />)}
          {coins.map((coin) => (
            <i
              key={`coin-${coin.id}`}
              className="welcome-coin"
              style={{
                '--coin-x': `${Math.cos((coin.angle * Math.PI) / 180) * coin.distance}px`,
                '--coin-y': `${Math.sin((coin.angle * Math.PI) / 180) * coin.distance}px`,
                animationDelay: coin.delay,
              } as CSSProperties}
            >★</i>
          ))}
        </div>
      )}

      <section className="welcome-gift-panel">
        <div className="welcome-gift-eyebrow">{t.welcomeGift.eyebrow}</div>
        <h2 id="welcome-gift-title">
          {phase === 'revealed' ? t.welcomeGift.wonTitle : t.welcomeGift.title}
        </h2>
        <p>{phase === 'revealed' ? t.welcomeGift.wonBody : t.welcomeGift.body}</p>

        <div className="welcome-boxes" aria-label={t.welcomeGift.chooseLabel}>
          {visibleBoxes.map((box) => {
            const isChosen = selectedBox === box
            return (
              <button
                type="button"
                key={box}
                style={{ '--light': BOX_WRAPS[box - 1].mid } as CSSProperties}
                className={`welcome-box-wrap${isChosen ? ' is-selected' : ''}${shakingBox === box && phase === 'choosing' ? ' is-shaking' : ''}`}
                disabled={phase !== 'choosing'}
                aria-label={fill(t.welcomeGift.boxLabel, { number: box })}
                onClick={() => void choose(box)}
                onPointerEnter={() => startHoverShake(box)}
                onPointerLeave={stopHoverShake}
                onAnimationEnd={(event) => {
                  if (event.animationName === 'welcome-wiggle') queueNextShake(box)
                }}
              >
                {isChosen && phase === 'revealed' && (
                  <span className="welcome-burst" aria-hidden="true">
                    <span className="welcome-rays" />
                    <span className="welcome-ring" />
                    <span className="welcome-ring welcome-ring-late" />
                  </span>
                )}
                <span className="welcome-box-light" aria-hidden="true" />
                <span className="welcome-box">
                  <GiftBoxArt wrap={BOX_WRAPS[box - 1]} />
                  {isChosen && phase === 'opening' && (
                    <span className="welcome-box-sparks" aria-hidden="true">
                      {sparks.map((spark) => <i key={spark.id} style={spark.style} />)}
                    </span>
                  )}
                </span>
                {isChosen && badge && phase === 'revealed' && (
                  <span className="welcome-prize" aria-hidden="true">
                    <PrizeRosette value={badge.value} label={badge.label} />
                    {sparkles.map((sparkle) => (
                      <i key={sparkle.id} className={sparkle.gold ? 'welcome-sparkle is-gold' : 'welcome-sparkle'} style={sparkle.style} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {phase === 'choosing' && <div className="welcome-gift-hint">{t.welcomeGift.hint}</div>}
        {phase === 'opening' && <div className="welcome-gift-hint">{t.welcomeGift.opening}</div>}
        {phase === 'revealed' && reward && (
          <div className="welcome-gift-won" aria-live="polite">
            <small>{t.welcomeGift.yourPrize}</small>
            <strong>{prizeText}</strong>
          </div>
        )}
        {phase === 'revealed' && reward?.discountPercent ? (
          <>
            <div className="welcome-gift-hint welcome-gift-timer">{t.welcomeGift.discountExpiry}</div>
            <div className="welcome-gift-actions">
              <button className="welcome-gift-continue" type="button" onClick={openPlans}>
                {t.welcomeGift.viewPlans}
              </button>
              <button className="welcome-gift-later" type="button" onClick={() => setHidden(true)}>
                {t.welcomeGift.later}
              </button>
            </div>
          </>
        ) : null}
        {phase === 'revealed' && reward?.bonusFreeDays ? (
          <button className="welcome-gift-continue" type="button" onClick={() => setHidden(true)}>
            {t.welcomeGift.continue}
          </button>
        ) : null}
        {error && <div className="welcome-gift-error" role="alert">{error}</div>}
      </section>

      <style>{welcomeGiftStyles}</style>
    </div>
  )
}

function WrapPattern({ id, wrap }: { id: string; wrap: BoxWrap }) {
  if (wrap.pattern === 'dots') {
    return (
      <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2.2" fill={wrap.ink} fillOpacity={wrap.inkOpacity} />
        <circle cx="11" cy="11" r="2.2" fill={wrap.ink} fillOpacity={wrap.inkOpacity} />
      </pattern>
    )
  }
  if (wrap.pattern === 'stripes') {
    return (
      <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
        <rect width="5" height="12" fill={wrap.ink} fillOpacity={wrap.inkOpacity} />
      </pattern>
    )
  }
  return (
    <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
      <path d="M9 5v8M5 9h8" stroke={wrap.ink} strokeOpacity={wrap.inkOpacity} strokeWidth="2" strokeLinecap="round" />
    </pattern>
  )
}

function GiftBoxArt({ wrap }: { wrap: BoxWrap }) {
  // Several boxes share the page, so every gradient/pattern id has to be unique per instance.
  const uid = useId().replace(/:/g, '')
  const bodyId = `wg-body-${uid}`
  const lidId = `wg-lid-${uid}`
  const ribbonId = `wg-ribbon-${uid}`
  const patternId = `wg-pattern-${uid}`
  const blurId = `wg-blur-${uid}`
  const { ribbon } = wrap

  return (
    <svg className="welcome-box-art" viewBox="0 0 160 180" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={wrap.mid} />
          <stop offset="1" stopColor={wrap.dark} />
        </linearGradient>
        <linearGradient id={lidId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={wrap.light} />
          <stop offset="1" stopColor={wrap.mid} />
        </linearGradient>
        <linearGradient id={ribbonId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={ribbon.edge} />
          <stop offset=".42" stopColor={ribbon.shine} />
          <stop offset=".58" stopColor={ribbon.face} />
          <stop offset="1" stopColor={ribbon.deep} />
        </linearGradient>
        <WrapPattern id={patternId} wrap={wrap} />
        <filter id={blurId} x="-20%" y="-300%" width="140%" height="700%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <ellipse cx="80" cy="170" rx="60" ry="7" fill="#0b1220" opacity=".22" />
      <rect x="22" y="84" width="116" height="82" rx="10" fill={`url(#${bodyId})`} />
      <rect x="22" y="84" width="116" height="82" rx="10" fill={`url(#${patternId})`} />
      <path d="M108 84h20a10 10 0 0 1 10 10v62a10 10 0 0 1-10 10h-20z" fill="#000" opacity=".12" />
      <rect x="22" y="84" width="116" height="9" fill="#000" opacity=".16" />
      <rect x="70" y="84" width="20" height="82" fill={`url(#${ribbonId})`} />
      <ellipse className="welcome-box-glow" cx="80" cy="86" rx="56" ry="10" fill="#fff4c2" />

      <g className="welcome-box-lid">
        <rect x="14" y="60" width="132" height="30" rx="8" fill={`url(#${lidId})`} />
        <rect x="14" y="60" width="132" height="30" rx="8" fill={`url(#${patternId})`} />
        <rect x="20" y="63" width="120" height="4" rx="2" fill="#fff" opacity=".35" />
        <rect x="68" y="60" width="24" height="30" fill={`url(#${ribbonId})`} />
        <path d="M76 62L63 84L69.5 83L72 90L81 64Z" fill={ribbon.tail} />
        <path d="M84 62L97 84L90.5 83L88 90L79 64Z" fill={ribbon.deep} />
        <path d="M80 60C66 30 36 32 43 50C47 61 68 62 80 60Z" fill={`url(#${ribbonId})`} stroke={ribbon.line} strokeWidth="1.4" />
        <path d="M80 60C94 30 124 32 117 50C113 61 92 62 80 60Z" fill={`url(#${ribbonId})`} stroke={ribbon.line} strokeWidth="1.4" />
        <path d="M76 57C67 43 53 42 55 49C57 55 68 57 76 57Z" fill={ribbon.fold} opacity=".45" />
        <path d="M84 57C93 43 107 42 105 49C103 55 92 57 84 57Z" fill={ribbon.fold} opacity=".45" />
        <rect x="72" y="51" width="16" height="14" rx="5" fill={ribbon.face} stroke={ribbon.line} strokeWidth="1.4" />
      </g>

      <rect className="welcome-box-seam" x="18" y="86" width="124" height="7" rx="3.5" fill="#fff3b8" filter={`url(#${blurId})`} />
      <path className="welcome-box-twinkle" d="M136 26l2.6 7 7 2.6-7 2.6-2.6 7-2.6-7-7-2.6 7-2.6z" fill="#f6cc55" />
    </svg>
  )
}

function PrizeRosette({ value, label }: { value: string; label: string }) {
  const gradientId = `wg-rosette-${useId().replace(/:/g, '')}`

  return (
    <svg className="welcome-rosette" viewBox="0 0 160 170" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a3" />
          <stop offset=".5" stopColor="#f4c84d" />
          <stop offset="1" stopColor="#d48f17" />
        </linearGradient>
      </defs>
      <path d="M60 112L44 162L60 152L70 166L80 118Z" fill="#2d76dd" />
      <path d="M100 112L116 162L100 152L90 166L80 118Z" fill="#5b9bf5" />
      <g className="welcome-rosette-edge">
        <polygon points={ROSETTE_POINTS} fill={`url(#${gradientId})`} stroke="#c98512" strokeWidth="1.2" />
      </g>
      <circle cx="80" cy="74" r="47" fill="#fff" />
      <circle cx="80" cy="74" r="42" fill="none" stroke="#f4c84d" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M80 40l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="#f4c84d" />
      <text x="80" y="86" textAnchor="middle" className="welcome-rosette-value">{value}</text>
      <text x="80" y="101" textAnchor="middle" className="welcome-rosette-label">{label.toLocaleUpperCase()}</text>
    </svg>
  )
}

const STAR = 'polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)'

const welcomeGiftStyles = `
  .welcome-gift-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;overflow:hidden;background:rgba(10,16,29,.64);backdrop-filter:blur(13px);font-family:inherit}
  .welcome-gift-glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,rgba(96,165,250,.35),transparent 34%),radial-gradient(circle at 50% 78%,rgba(250,228,98,.2),transparent 36%)}
  .welcome-gift-revealed .welcome-gift-glow{background:radial-gradient(circle at 50% 52%,rgba(250,228,98,.4),transparent 42%),radial-gradient(circle at 50% 42%,rgba(96,165,250,.3),transparent 52%)}
  .welcome-gift-ambient,.welcome-gift-effects{position:absolute;inset:0;pointer-events:none}
  .welcome-gift-effects{z-index:3}
  .welcome-gift-ambient .welcome-confetti{top:0;opacity:.5;animation:welcome-drift linear infinite}

  .welcome-gift-panel{position:relative;overflow:hidden;width:min(680px,100%);padding:36px 30px 30px;text-align:center;border:1px solid rgba(255,255,255,.65);border-radius:34px;background:radial-gradient(120% 70% at 50% 0%,#e6effd 0%,#fff 62%);box-shadow:0 34px 110px rgba(3,12,30,.46);animation:welcome-panel-in .55s cubic-bezier(.2,.85,.25,1.15) both}
  .welcome-gift-revealed .welcome-gift-panel{animation:welcome-panel-jolt .5s cubic-bezier(.3,1.6,.5,1) both}
  .welcome-gift-revealed .welcome-gift-panel:after{content:'';position:absolute;inset:0;z-index:5;border-radius:inherit;background:radial-gradient(circle at 50% 64%,#fff 0,rgba(255,255,255,.85) 22%,rgba(255,255,255,0) 62%);pointer-events:none;animation:welcome-flash .75s ease-out both}
  .welcome-gift-eyebrow{position:relative;z-index:2;display:inline-flex;border-radius:999px;padding:7px 13px;background:#dbeafe;color:#2563eb;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
  .welcome-gift-panel h2{position:relative;z-index:2;margin:14px 0 5px;color:#111827;font-size:clamp(28px,5vw,42px);font-weight:900;letter-spacing:-.035em}
  .welcome-gift-panel>p{position:relative;z-index:2;margin:0 auto;max-width:500px;color:#64748b;font-size:16px;line-height:1.55}

  .welcome-boxes{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:clamp(10px,4vw,34px);min-height:215px;margin-top:18px}
  .welcome-gift-revealed .welcome-boxes{min-height:300px}
  .welcome-box-wrap{position:relative;width:150px;padding:0;border:0;background:transparent;cursor:pointer;transform-origin:50% 100%;animation:welcome-box-mix .9s cubic-bezier(.17,.86,.37,1.12) both}
  .welcome-box-wrap:nth-child(2){animation-delay:.12s}.welcome-box-wrap:nth-child(3){animation-delay:.24s}
  .welcome-box-wrap:focus-visible{outline:3px solid #2563eb;outline-offset:6px;border-radius:18px}
  .welcome-box-light{position:absolute;left:50%;top:58%;z-index:0;width:135%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,var(--light) 0%,transparent 66%);opacity:.5;filter:blur(10px);transform:translate(-50%,-50%);pointer-events:none;transition:opacity .3s,scale .3s cubic-bezier(.3,1.4,.5,1);animation:welcome-light-pulse 2.8s ease-in-out infinite}
  .welcome-box-wrap:nth-child(2) .welcome-box-light{animation-delay:-.9s}.welcome-box-wrap:nth-child(3) .welcome-box-light{animation-delay:-1.8s}
  .welcome-box-wrap:not(:disabled):hover .welcome-box-light{opacity:.85;scale:1.12}
  .welcome-gift-opening .is-selected .welcome-box-light{opacity:.9;scale:1.2}
  .welcome-gift-revealed .welcome-box-light{opacity:0}
  .welcome-box{position:relative;z-index:1;display:block;transition:transform .3s cubic-bezier(.3,1.4,.5,1),filter .25s}
  .welcome-box-wrap:not(:disabled):hover .welcome-box{transform:translateY(-10px);filter:drop-shadow(0 16px 18px color-mix(in srgb,var(--light) 40%,transparent))}
  .welcome-box-art{display:block;width:100%;height:auto;overflow:visible;transform-origin:50% 92%;animation:welcome-idle 2.8s ease-in-out infinite}
  .welcome-box-wrap:nth-child(2) .welcome-box-art{animation-delay:-.9s}.welcome-box-wrap:nth-child(3) .welcome-box-art{animation-delay:-1.8s}
  .welcome-box-wrap:not(:disabled):hover .welcome-box-art{animation:none}
  .welcome-box-wrap.is-shaking:not(:disabled) .welcome-box-art{animation:welcome-wiggle .55s ease-in-out}
  .welcome-box-lid{transform-box:view-box;transform-origin:80px 90px}
  .welcome-box-glow,.welcome-box-seam{opacity:0}
  .welcome-box-twinkle{transform-box:fill-box;transform-origin:center;animation:welcome-twinkle 2.4s ease-in-out infinite}

  .welcome-gift-opening .welcome-box-wrap:not(.is-selected),.welcome-gift-revealed .welcome-box-wrap:not(.is-selected){display:none}
  .welcome-gift-opening .is-selected,.welcome-gift-revealed .is-selected{position:absolute;left:50%;bottom:0;transform:translateX(-50%) scale(1.18);animation:none}

  .welcome-gift-opening .is-selected .welcome-box{animation:welcome-charge 1.4s cubic-bezier(.5,0,.9,.6) both}
  .welcome-gift-opening .is-selected .welcome-box-art{animation:welcome-rumble-build 1.3s linear both,welcome-rumble-peak .14s linear 1.3s infinite,welcome-charge-glow 1.4s ease-in both}
  .welcome-gift-opening .is-selected .welcome-box-seam{animation:welcome-seam 1.3s ease-in both,welcome-seam-flicker .18s linear 1.3s infinite alternate}
  .welcome-box-sparks{position:absolute;left:50%;top:44%;pointer-events:none}
  .welcome-box-sparks i{position:absolute;left:0;top:0;width:11px;height:11px;background:#ffe27a;clip-path:${STAR};opacity:0;animation:welcome-spark-jump .7s ease-out infinite}

  .welcome-gift-revealed .is-selected .welcome-box-art{animation:welcome-box-thump .5s cubic-bezier(.3,1.6,.5,1) both}
  .welcome-gift-revealed .is-selected .welcome-box-lid{animation:welcome-lid-pop .85s cubic-bezier(.2,.8,.3,1) both}
  .welcome-gift-revealed .is-selected .welcome-box-glow{animation:welcome-glow-in .6s ease-out both}

  .welcome-burst{position:absolute;left:50%;top:48%;z-index:0;width:0;height:0;pointer-events:none}
  .welcome-rays{position:absolute;left:-230px;top:-230px;width:460px;height:460px;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(250,228,98,.6) 0deg 7deg,rgba(250,228,98,0) 7deg 20deg);-webkit-mask:radial-gradient(circle,#000 16%,transparent 68%);mask:radial-gradient(circle,#000 16%,transparent 68%);animation:welcome-fade-in .6s ease-out both,welcome-spin 22s linear infinite}
  .welcome-ring{position:absolute;left:-60px;top:-60px;width:120px;height:120px;border:4px solid rgba(250,228,98,.95);border-radius:50%;opacity:0;animation:welcome-ring 1s cubic-bezier(.1,.6,.3,1) both}
  .welcome-ring-late{border-color:rgba(91,155,245,.85);animation-delay:.18s}

  .welcome-prize{position:absolute;z-index:4;left:50%;bottom:46%;width:150px;animation:welcome-prize-rise .85s cubic-bezier(.16,.9,.26,1.25) .2s both,welcome-prize-float 2.8s ease-in-out 1.1s infinite}
  .welcome-rosette{display:block;width:100%;height:auto;overflow:visible;filter:drop-shadow(0 10px 14px rgba(15,23,42,.22))}
  .welcome-rosette text{font-family:inherit}
  .welcome-rosette-value{font-size:30px;font-weight:900;fill:#16181d}
  .welcome-rosette-label{font-size:8.5px;font-weight:900;letter-spacing:.14em;fill:#1f6fe0}
  .welcome-rosette-edge{transform-box:fill-box;transform-origin:center;animation:welcome-spin 18s linear infinite}
  .welcome-sparkle{position:absolute;left:50%;top:44%;width:14px;height:14px;background:#fff6c8;clip-path:${STAR};opacity:0;transform:translate(calc(-50% + var(--sx)),calc(-50% + var(--sy))) scale(0);animation:welcome-sparkle 1.6s ease-in-out infinite}
  .welcome-sparkle.is-gold{width:10px;height:10px;background:#f6cc55}

  .welcome-gift-won{position:relative;z-index:2;margin-top:6px;animation:welcome-won-in .5s ease-out .55s both}
  .welcome-gift-won small{display:block;margin-bottom:3px;color:#2563eb;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
  .welcome-gift-won strong{color:#0f172a;font-size:22px;font-weight:900;line-height:1.2}
  .welcome-gift-hint{position:relative;z-index:2;min-height:28px;margin-top:2px;color:#475569;font-size:14px;font-weight:800}.welcome-gift-timer{color:#dc2626}
  .welcome-gift-continue{position:relative;z-index:2;margin-top:8px;border:0;border-radius:999px;padding:13px 25px;background:#2563eb;color:white;font:800 15px inherit;box-shadow:0 8px 0 #1d4ed8;cursor:pointer}
  .welcome-gift-actions{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:6px}
  .welcome-gift-later{border:0;padding:8px 14px;background:transparent;color:#64748b;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}
  .welcome-gift-later:hover{color:#0f172a}
  .welcome-gift-error{position:relative;z-index:2;margin-top:12px;color:#b91c1c;font-size:14px;font-weight:700}

  .welcome-confetti{position:absolute;top:0;left:0;width:9px;height:16px;border-radius:2px}
  .welcome-confetti.is-round{width:11px;height:11px;border-radius:50%}
  .welcome-confetti.is-streamer{width:5px;height:26px;border-radius:3px}
  .welcome-confetti.is-star{width:15px;height:15px;border-radius:0;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
  .welcome-rain{top:-40px;animation:welcome-rain 3s ease-in 2 both}
  .welcome-burst-piece{left:50%;top:56%;animation:welcome-burst 1.9s cubic-bezier(.12,.7,.3,1) both}
  .welcome-coin{position:absolute;left:50%;top:56%;display:grid;place-items:center;width:31px;height:31px;border:3px solid #d97706;border-radius:50%;background:#fbbf24;color:#92400e;font-style:normal;font-size:13px;box-shadow:inset 0 0 0 3px #fde68a;animation:welcome-coin-burst 1.25s cubic-bezier(.12,.75,.25,1) forwards}

  @keyframes welcome-panel-in{from{opacity:0;transform:translateY(28px) scale(.92)}to{opacity:1;transform:none}}
  @keyframes welcome-panel-jolt{0%{transform:none}30%{transform:translateY(-3px) scale(1.025)}60%{transform:scale(.995)}100%{transform:none}}
  @keyframes welcome-flash{0%{opacity:0}18%{opacity:1}100%{opacity:0}}
  @keyframes welcome-box-mix{0%{opacity:0;transform:translate(100px,-70px) rotate(25deg) scale(.55)}55%{opacity:1;transform:translate(-20px,8px) rotate(-7deg) scale(1.06)}100%{opacity:1;transform:none}}
  @keyframes welcome-idle{0%,100%{transform:none}50%{transform:translateY(-5px) rotate(-1.2deg)}}
  @keyframes welcome-light-pulse{0%,100%{transform:translate(-50%,-50%) scale(.92)}50%{transform:translate(-50%,-50%) scale(1.04)}}
  @keyframes welcome-wiggle{0%,100%{transform:none}25%{transform:rotate(-5deg) scale(1.03)}50%{transform:rotate(4deg) scale(1.05)}75%{transform:rotate(-2deg) scale(1.03)}}
  @keyframes welcome-charge{0%{transform:none}70%{transform:translateY(-6px) scale(1.06,1.03)}100%{transform:translateY(-10px) scale(1.1,1.05)}}
  @keyframes welcome-rumble-build{0%{transform:none}8%{transform:translate(-1px,0) rotate(-1.5deg)}16%{transform:translate(1px,-1px) rotate(1.5deg)}24%{transform:translate(-2px,0) rotate(-3deg)}32%{transform:translate(2px,-1px) rotate(3deg)}40%{transform:translate(-3px,0) rotate(-4.5deg)}48%{transform:translate(3px,-2px) rotate(4.5deg)}56%{transform:translate(-4px,0) rotate(-6deg)}64%{transform:translate(4px,-2px) rotate(6deg)}72%{transform:translate(-5px,-1px) rotate(-7.5deg)}80%{transform:translate(5px,-3px) rotate(7.5deg)}88%{transform:translate(-6px,-1px) rotate(-9deg)}94%{transform:translate(6px,-3px) rotate(9deg)}100%{transform:translate(0,-2px)}}
  @keyframes welcome-rumble-peak{0%,100%{transform:translate(-5px,-1px) rotate(-8deg)}50%{transform:translate(5px,-3px) rotate(8deg)}}
  @keyframes welcome-charge-glow{from{filter:drop-shadow(0 0 0 rgba(255,214,102,0))}to{filter:drop-shadow(0 0 22px rgba(255,214,102,.95)) brightness(1.08)}}
  @keyframes welcome-seam{from{opacity:0}to{opacity:1}}
  @keyframes welcome-seam-flicker{from{opacity:.6}to{opacity:1}}
  @keyframes welcome-spark-jump{0%{opacity:0;transform:translate(-50%,0) scale(.3)}30%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--jx)),var(--jy)) scale(1) rotate(120deg)}}
  @keyframes welcome-box-thump{0%{transform:scale(1.08,.9)}100%{transform:none}}
  @keyframes welcome-lid-pop{0%{transform:none}35%{transform:translate(-18px,-80px) rotate(-24deg)}100%{opacity:0;transform:translate(-70px,-190px) rotate(-95deg)}}
  @keyframes welcome-glow-in{0%{opacity:0}40%{opacity:1}100%{opacity:.85}}
  @keyframes welcome-fade-in{from{opacity:0}to{opacity:1}}
  @keyframes welcome-spin{to{transform:rotate(360deg)}}
  @keyframes welcome-ring{0%{opacity:1;transform:scale(.2)}100%{opacity:0;transform:scale(3.4);border-width:1px}}
  @keyframes welcome-prize-rise{0%{opacity:0;transform:translate(-50%,70px) scale(.3) rotate(-14deg)}100%{opacity:1;transform:translate(-50%,0) scale(1) rotate(0)}}
  @keyframes welcome-prize-float{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-7px)}}
  @keyframes welcome-sparkle{0%,100%{opacity:0;transform:translate(calc(-50% + var(--sx)),calc(-50% + var(--sy))) scale(0) rotate(0)}50%{opacity:1;transform:translate(calc(-50% + var(--sx)),calc(-50% + var(--sy))) scale(1) rotate(90deg)}}
  @keyframes welcome-won-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes welcome-twinkle{50%{opacity:.3;transform:scale(.45)}}
  @keyframes welcome-drift{0%{transform:translate3d(0,-6vh,0) rotate(0)}50%{transform:translate3d(var(--sway),50vh,0) rotate(calc(var(--spin) * .5))}100%{transform:translate3d(0,108vh,0) rotate(var(--spin))}}
  @keyframes welcome-rain{0%{opacity:0;transform:translate3d(0,-6vh,0) rotate(0)}8%{opacity:1}50%{transform:translate3d(var(--sway),52vh,0) rotate(calc(var(--spin) * .5))}100%{opacity:.85;transform:translate3d(calc(var(--sway) * -1),112vh,0) rotate(var(--spin))}}
  @keyframes welcome-burst{0%{opacity:1;transform:translate(-50%,-50%) scale(.3)}38%{opacity:1;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--spin)) scale(1)}100%{opacity:0;transform:translate(calc(-50% + var(--x) * 1.12),calc(-50% + var(--y) + 280px)) rotate(calc(var(--spin) * 2)) scale(.9)}}
  @keyframes welcome-coin-burst{0%{opacity:1;transform:translate(-50%,-50%) scale(.2) rotate(0)}72%{opacity:1;transform:translate(calc(-50% + var(--coin-x)),calc(-50% + var(--coin-y))) scale(1) rotate(540deg)}100%{opacity:0;transform:translate(calc(-50% + var(--coin-x)),calc(-50% + var(--coin-y) + 70px)) scale(.7) rotate(720deg)}}

  @media(max-width:600px){
    .welcome-gift-overlay{padding:12px}
    .welcome-gift-panel{padding:28px 12px 22px;border-radius:27px}
    .welcome-gift-panel>p{padding:0 12px;font-size:14px}
    .welcome-boxes{gap:4px;min-height:210px}
    .welcome-gift-revealed .welcome-boxes{min-height:270px}
    .welcome-box-wrap{width:31vw;max-width:126px}
    .welcome-gift-opening .is-selected,.welcome-gift-revealed .is-selected{transform:translateX(-50%) scale(1.12)}
    .welcome-prize{width:128px}
    .welcome-rays{left:-180px;top:-180px;width:360px;height:360px}
    .welcome-gift-won strong{font-size:19px}
  }
  @media(prefers-reduced-motion:reduce){
    .welcome-gift-overlay *,.welcome-gift-overlay *:before,.welcome-gift-overlay *:after{animation-duration:.01ms!important;animation-delay:0ms!important;animation-iteration-count:1!important}
    .welcome-gift-ambient,.welcome-gift-effects,.welcome-burst,.welcome-box-sparks,.welcome-sparkle{display:none}
  }
`

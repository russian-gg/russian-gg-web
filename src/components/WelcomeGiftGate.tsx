import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { fill, useT } from '../lib/i18n'
import type { WelcomeGiftStatus } from '../lib/types'

type Phase = 'choosing' | 'opening' | 'revealed'

const confetti = Array.from({ length: 64 }, (_, index) => ({
  id: index,
  left: `${2 + ((index * 37) % 96)}%`,
  delay: `${(index % 12) * 0.08}s`,
  duration: `${2.25 + (index % 7) * 0.12}s`,
  color: ['#fbbf24', '#60a5fa', '#fb7185', '#34d399', '#a78bfa'][index % 5],
  round: index % 4 === 0,
}))

const coins = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  angle: (360 / 18) * index,
  distance: 105 + (index % 4) * 24,
  delay: `${(index % 5) * 0.035}s`,
}))

export function WelcomeGiftGate() {
  const t = useT()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const discountRedirectedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('choosing')
  const [selectedBox, setSelectedBox] = useState<number | null>(null)
  const [reward, setReward] = useState<WelcomeGiftStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

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
    discountRedirectedRef.current = false
  }, [user?.id])

  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [visible])

  useEffect(() => {
    if (phase !== 'revealed' || !reward || reward.discountPercent <= 0) return
    if (discountRedirectedRef.current) return

    const redirectTimer = window.setTimeout(() => {
      if (discountRedirectedRef.current) return
      discountRedirectedRef.current = true
      setHidden(true)
      navigate('/paywall')
    }, 2300)

    return () => window.clearTimeout(redirectTimer)
  }, [navigate, phase, reward])

  const prizeText = useMemo(() => {
    if (!reward) return ''
    return reward.bonusFreeDays > 0
      ? fill(t.welcomeGift.bonusPrize, { days: reward.bonusFreeDays })
      : fill(t.welcomeGift.discountPrize, { percent: reward.discountPercent })
  }, [reward, t])

  const visibleBoxes = phase === 'choosing' || selectedBox === null
    ? [1, 2, 3]
    : [selectedBox]

  if (!visible) return null

  async function choose(box: number) {
    if (phase !== 'choosing') return
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
      window.setTimeout(() => setPhase('revealed'), 900)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.welcomeGift.error)
      setPhase('choosing')
      setSelectedBox(null)
    }
  }

  return (
    <div className={`welcome-gift-overlay welcome-gift-${phase}`} role="dialog" aria-modal="true" aria-labelledby="welcome-gift-title">
      <div className="welcome-gift-glow" aria-hidden="true" />

      {phase === 'revealed' && (
        <div className="welcome-gift-effects" aria-hidden="true">
          {confetti.map((piece) => (
            <i
              key={piece.id}
              className={piece.round ? 'welcome-confetti welcome-confetti-round' : 'welcome-confetti'}
              style={{
                left: piece.left,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                backgroundColor: piece.color,
              }}
            />
          ))}
          {coins.map((coin) => (
            <i
              key={coin.id}
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
          {visibleBoxes.map((box) => (
            <button
              type="button"
              key={box}
              className={`welcome-box-wrap welcome-box-${box}${selectedBox === box ? ' is-selected' : ''}`}
              disabled={phase !== 'choosing'}
              aria-label={fill(t.welcomeGift.boxLabel, { number: box })}
              onClick={() => void choose(box)}
            >
              <span className="welcome-box-shadow" />
              <span className="welcome-box">
                <span className="welcome-box-lid"><span /></span>
                <span className="welcome-box-body"><span /></span>
                {selectedBox === box && reward && phase === 'revealed' && (
                  <strong className="welcome-prize" aria-live="polite">
                    <small>{t.welcomeGift.yourPrize}</small>
                    {prizeText}
                  </strong>
                )}
              </span>
            </button>
          ))}
        </div>

        {phase === 'choosing' && <div className="welcome-gift-hint">{t.welcomeGift.hint}</div>}
        {phase === 'opening' && <div className="welcome-gift-hint">{t.welcomeGift.opening}</div>}
        {phase === 'revealed' && reward?.discountPercent ? (
          <div className="welcome-gift-hint welcome-gift-timer">{t.welcomeGift.discountRedirect}</div>
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

const welcomeGiftStyles = `
  .welcome-gift-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;overflow:hidden;background:rgba(10,16,29,.64);backdrop-filter:blur(13px);font-family:inherit}
  .welcome-gift-glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,rgba(96,165,250,.35),transparent 34%),radial-gradient(circle at 50% 78%,rgba(251,191,36,.18),transparent 36%)}
  .welcome-gift-panel{position:relative;width:min(680px,100%);padding:36px 30px 30px;text-align:center;border:1px solid rgba(255,255,255,.65);border-radius:34px;background:linear-gradient(155deg,rgba(255,255,255,.97),rgba(239,246,255,.94));box-shadow:0 34px 110px rgba(3,12,30,.46);animation:welcome-panel-in .55s cubic-bezier(.2,.85,.25,1.15) both}
  .welcome-gift-eyebrow{display:inline-flex;border-radius:999px;padding:7px 13px;background:#dbeafe;color:#2563eb;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
  .welcome-gift-panel h2{margin:14px 0 5px;color:#111827;font-size:clamp(28px,5vw,42px);font-weight:900;letter-spacing:-.035em}
  .welcome-gift-panel>p{margin:0 auto;max-width:500px;color:#64748b;font-size:16px;line-height:1.55}
  .welcome-boxes{display:flex;align-items:flex-end;justify-content:center;gap:clamp(10px,4vw,34px);min-height:250px;margin-top:18px}
  .welcome-box-wrap{position:relative;width:150px;height:190px;border:0;background:transparent;cursor:pointer;transform-origin:50% 100%;animation:welcome-box-mix .9s cubic-bezier(.17,.86,.37,1.12) both;transition:filter .25s,opacity .3s,transform .3s}
  .welcome-box-wrap:nth-child(2){animation-delay:.12s}.welcome-box-wrap:nth-child(3){animation-delay:.24s}
  .welcome-box-wrap:not(:disabled):hover{transform:translateY(-10px) rotate(-1deg);filter:drop-shadow(0 15px 15px rgba(37,99,235,.2))}
  .welcome-box-shadow{position:absolute;left:15%;right:15%;bottom:8px;height:20px;border-radius:50%;background:rgba(15,23,42,.19);filter:blur(9px)}
  .welcome-box{position:absolute;inset:0;display:block}
  .welcome-box-body{position:absolute;left:14px;right:14px;bottom:15px;height:118px;border-radius:12px 12px 18px 18px;background:linear-gradient(145deg,#3b82f6,#1d4ed8);box-shadow:inset -12px -10px 20px rgba(21,54,130,.28),inset 9px 7px 16px rgba(255,255,255,.16)}
  .welcome-box-lid{position:absolute;z-index:2;left:4px;right:4px;bottom:124px;height:47px;border-radius:13px;background:linear-gradient(145deg,#60a5fa,#2563eb);box-shadow:0 8px 9px rgba(30,64,175,.24)}
  .welcome-box-body>span,.welcome-box-lid>span{position:absolute;left:50%;top:0;width:30px;height:100%;transform:translateX(-50%);background:linear-gradient(90deg,#f59e0b,#fde68a 48%,#f59e0b)}
  .welcome-box-lid:before,.welcome-box-lid:after{content:'';position:absolute;bottom:35px;width:49px;height:36px;border:12px solid #fbbf24}
  .welcome-box-lid:before{right:50%;border-radius:34px 9px 4px 34px;transform:rotate(12deg)}.welcome-box-lid:after{left:50%;border-radius:9px 34px 34px 4px;transform:rotate(-12deg)}
  .welcome-box-2 .welcome-box-body{background:linear-gradient(145deg,#8b5cf6,#6d28d9)}.welcome-box-2 .welcome-box-lid{background:linear-gradient(145deg,#a78bfa,#7c3aed)}
  .welcome-box-3 .welcome-box-body{background:linear-gradient(145deg,#f43f5e,#be123c)}.welcome-box-3 .welcome-box-lid{background:linear-gradient(145deg,#fb7185,#e11d48)}
  .welcome-gift-opening .welcome-box-wrap:not(.is-selected),.welcome-gift-revealed .welcome-box-wrap:not(.is-selected){display:none}
  .welcome-gift-opening .welcome-boxes,.welcome-gift-revealed .welcome-boxes{position:relative}
  .welcome-gift-opening .is-selected,.welcome-gift-revealed .is-selected{position:absolute;left:50%;transform:translateX(-50%) scale(1.18);animation:none}
  .welcome-gift-opening .is-selected .welcome-box{animation:welcome-box-shake .72s ease-in-out .08s both}
  .welcome-gift-revealed .is-selected .welcome-box-lid{animation:welcome-lid-pop .65s cubic-bezier(.17,.85,.32,1.3) both}
  .welcome-gift-revealed .is-selected .welcome-box-body{animation:welcome-box-flash .65s ease-out both}
  .welcome-prize{position:absolute;z-index:4;left:50%;bottom:65px;width:235px;transform:translateX(-50%);color:#0f172a;font-size:25px;font-weight:1000;line-height:1.05;text-shadow:0 2px 0 white;animation:welcome-prize-rise .75s cubic-bezier(.16,.9,.26,1.2) .22s both}
  .welcome-prize small{display:block;margin-bottom:7px;color:#2563eb;font-size:11px;letter-spacing:.13em;text-transform:uppercase}
  .welcome-gift-hint{min-height:28px;margin-top:2px;color:#475569;font-size:14px;font-weight:800}.welcome-gift-timer{color:#dc2626}
  .welcome-gift-continue{margin-top:8px;border:0;border-radius:999px;padding:13px 25px;background:#2563eb;color:white;font:800 15px inherit;box-shadow:0 8px 0 #1d4ed8;cursor:pointer}
  .welcome-gift-error{margin-top:12px;color:#b91c1c;font-size:14px;font-weight:700}
  .welcome-gift-effects{position:fixed;inset:0;pointer-events:none;z-index:2}.welcome-confetti{position:absolute;top:-30px;width:9px;height:21px;border-radius:2px;animation:welcome-confetti-fall 2.7s ease-in forwards}.welcome-confetti-round{width:13px;height:13px;border-radius:50%}
  .welcome-coin{position:absolute;left:50%;top:52%;display:grid;place-items:center;width:31px;height:31px;border:3px solid #d97706;border-radius:50%;background:#fbbf24;color:#92400e;font-style:normal;font-size:13px;box-shadow:inset 0 0 0 3px #fde68a;animation:welcome-coin-burst 1.25s cubic-bezier(.12,.75,.25,1) forwards}
  @keyframes welcome-panel-in{from{opacity:0;transform:translateY(28px) scale(.92)}to{opacity:1;transform:none}}
  @keyframes welcome-box-mix{0%{opacity:0;transform:translate(100px,-70px) rotate(25deg) scale(.55)}55%{opacity:1;transform:translate(-20px,8px) rotate(-7deg) scale(1.06)}100%{opacity:1;transform:none}}
  @keyframes welcome-box-shake{0%,100%{transform:rotate(0)}18%{transform:rotate(-5deg)}38%{transform:rotate(6deg)}58%{transform:rotate(-4deg)}78%{transform:rotate(3deg)}}
  @keyframes welcome-lid-pop{0%{transform:none}55%{transform:translate(-28px,-82px) rotate(-22deg)}100%{opacity:0;transform:translate(-70px,-115px) rotate(-55deg)}}
  @keyframes welcome-box-flash{0%{filter:brightness(1)}45%{filter:brightness(2.1) drop-shadow(0 0 30px #fbbf24)}100%{filter:brightness(1.05) drop-shadow(0 0 18px #fbbf2480)}}
  @keyframes welcome-prize-rise{0%{opacity:0;transform:translate(-50%,45px) scale(.35)}100%{opacity:1;transform:translate(-50%,-38px) scale(1)}}
  @keyframes welcome-confetti-fall{0%{opacity:0;transform:translateY(-5vh) rotate(0)}12%{opacity:1}100%{opacity:.75;transform:translate3d(25px,110vh,0) rotate(680deg)}}
  @keyframes welcome-coin-burst{0%{opacity:1;transform:translate(-50%,-50%) scale(.2) rotate(0)}72%{opacity:1;transform:translate(calc(-50% + var(--coin-x)),calc(-50% + var(--coin-y))) scale(1) rotate(540deg)}100%{opacity:0;transform:translate(calc(-50% + var(--coin-x)),calc(-50% + var(--coin-y) + 70px)) scale(.7) rotate(720deg)}}
  @media(max-width:600px){.welcome-gift-overlay{padding:12px}.welcome-gift-panel{padding:28px 12px 22px;border-radius:27px}.welcome-gift-panel>p{padding:0 12px;font-size:14px}.welcome-boxes{gap:0;min-height:220px}.welcome-box-wrap{width:31vw;max-width:126px;height:170px;transform:scale(.9)}.welcome-box-body{height:100px}.welcome-box-lid{bottom:106px}.welcome-gift-opening .is-selected,.welcome-gift-revealed .is-selected{transform:translateX(-50%) scale(1.12)}.welcome-prize{font-size:23px}}
  @media(prefers-reduced-motion:reduce){.welcome-gift-panel,.welcome-box-wrap,.welcome-box,.welcome-box-lid,.welcome-box-body,.welcome-prize,.welcome-confetti,.welcome-coin{animation-duration:.01ms!important;animation-delay:0ms!important}}
`

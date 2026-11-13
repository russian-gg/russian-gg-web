import type { CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, AudioLines, Check, Clock3, Mic, RotateCcw, ShieldCheck, Trophy } from 'lucide-react'
import { fill, useLocale, useT } from '../../../lib/i18n'
import { GameShareButton } from '../GameShareButton'
import { SawScene } from './SawScene'
import { sawCopies } from './copy'
import './saw.css'

type Props = {
  phase: 'ready' | 'playing' | 'cut' | 'won'
  blade: number
  secondsLeft: number
  score: number
  round: number
  question: string
  transcript?: string
  speaking?: boolean
  supported?: boolean
  error?: string
  preview?: boolean
  animated?: boolean
  onStart?: () => void
  onNext?: () => void
  onBack?: () => void
}

export function SawGameView({ phase, blade, secondsLeft, score, round, question, transcript = '', speaking = false,
  supported = true, error, preview = false, animated = true, onStart, onNext, onBack }: Props) {
  const { locale } = useLocale()
  const c = sawCopies[locale]
  const t = useT().arcade.saw
  const finished = phase === 'cut' || phase === 'won'
  const displayedSeconds = phase === 'ready' ? 60 : secondsLeft
  const displayedBlade = phase === 'ready' ? 0 : Math.max(0, Math.min(100, blade))
  const danger = phase === 'cut' || phase === 'playing' && blade > 68
  const status = phase === 'ready' ? c.ready : phase === 'won' ? c.won : phase === 'cut' ? c.lost
    : speaking ? c.pushing : danger ? c.danger : c.waiting
  const Control = preview ? 'span' : 'button'

  return <main className="arra-page" data-phase={phase} data-preview={preview} data-animated={animated} data-danger={danger}>
    <div className="arra-wrap">
      {!preview && <header className="arra-nav">
        <button type="button" onClick={onBack}><ArrowLeft size={18} />{t.back}</button>
        <span className="arra-brand">{c.title}<i />{c.subtitle}</span>
        <span className="arra-score"><Trophy size={16} />{score}<span>{t.score}</span></span>
      </header>}

      {phase === 'ready' && !preview && <div className="arra-intro">
        <span className="arra-eyebrow"><AudioLines size={13} />{c.eyebrow}</span>
        <h1>{c.headline}</h1>
        <p>{c.intro}</p>
      </div>}

      <section className="arra-arena" aria-label={c.title} data-danger={danger}>
        <div className="arra-hud">
          <div className="arra-suspicion" role="meter" aria-label={c.suspicion} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(displayedBlade)}>
            <div className="arra-suspicion-heading"><span>{c.suspicion}</span><strong>{Math.round(displayedBlade)}<small>%</small></strong></div>
            <div className="arra-suspicion-track"><i style={{ width: `${displayedBlade}%` }} /></div>
          </div>
          <div className="arra-clock" role="timer" aria-label={`${c.remaining}: ${displayedSeconds}`} style={{ '--remaining': `${displayedSeconds / 60 * 360}deg` } as CSSProperties}>
            <Clock3 size={16} />
            <strong>{phase === 'won' ? <Check aria-label={c.won} size={23} /> : `${Math.floor(displayedSeconds / 60)}:${String(displayedSeconds % 60).padStart(2, '0')}`}</strong>
            <span>{c.seconds}</span>
          </div>
        </div>

        <div className="arra-stage-frame">
          <SawScene blade={displayedBlade} phase={phase} speaking={speaking} animated={animated} />
          <div className="arra-stage-status" data-speaking={speaking} data-danger={danger} role={preview ? undefined : 'status'}>
            {phase === 'won' ? <Trophy size={14} /> : <span className="arra-status-dot" />}{status}
          </div>
          {phase === 'won' && <span className="arra-point">{c.point}</span>}
        </div>

        {phase === 'playing' && <div className="arra-transcript" data-speaking={speaking}>
          <Mic size={14} aria-hidden="true" /><p>{transcript || c.listening}</p>
          <span className="arra-wave" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--bar': i, '--height': `${8 + (i * 11 % 16)}px` } as CSSProperties} />)}</span>
        </div>}

        <div className="arra-question-row">
          <div className="arra-speaker"><span className="arra-speaker-line" /><span>{finished ? c.result : c.interrogator}</span></div>
          <div className="arra-question">
            <span className="arra-eyebrow">{finished ? phase === 'won' ? c.passed : c.retryHint : fill(t.question, { n: round + 1 })}</span>
            <h2>{finished ? phase === 'won' ? c.won : c.lost : question}</h2>
          </div>
          {finished && <span className="arra-result-symbol">{phase === 'won' ? <Trophy size={28} /> : <RotateCcw size={25} />}</span>}
        </div>
      </section>

      {phase === 'ready' && <div className="arra-start-area">
        <div className="arra-rules">
          <span><Mic size={15} />{c.speak}</span><span><ShieldCheck size={15} />{c.retreat}</span><span><Clock3 size={15} />{c.survive}</span>
        </div>
        <Control className="arra-start" type={preview ? undefined : 'button'} disabled={preview ? undefined : !supported} onClick={preview ? undefined : onStart}>
          <span className="arra-mic-disc"><Mic size={32} /></span><strong>{c.start}</strong>
        </Control>
      </div>}
      {phase === 'playing' && !preview && !error && <div className="arra-recording" data-speaking={speaking}>
        <span className="arra-mic-disc"><AudioLines size={32} /></span>
        <span>{speaking ? c.speaking : c.recording}</span>
      </div>}
      {finished && <div className="arra-result">
        <div className="arra-result-actions">
          <Control className="arra-result-next" type={preview ? undefined : 'button'} onClick={preview ? undefined : phase === 'won' ? onNext : onStart}>
            {phase === 'won' ? <ArrowRight size={19} /> : <RotateCcw size={19} />}{phase === 'won' ? t.next : t.retry}
          </Control>
          {!preview && <GameShareButton slug="arra" title={c.title} result={[phase === 'won' ? c.won : c.lost, `${t.score}: ${score}`]} className="arra-share" />}
        </div>
      </div>}
      {(!supported || error) && !preview && <p className="arra-error" role="alert">{error || t.unsupported}</p>}
    </div>
  </main>
}

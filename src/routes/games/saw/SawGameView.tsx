import type { CSSProperties } from 'react'
import { ArrowLeft, AudioLines, Check, ChevronDown, Clock3, Crown, MessageCircle, Mic, RotateCcw, ShieldCheck, Trophy, UserRound, Volume2, VolumeX, X } from 'lucide-react'
import { SawScene } from './SawScene'
import { SawShareButton } from './SawShareButton'
import { ROUND_SECONDS, SAW_CHARACTERS, SAW_CHARACTER_INFO, SAW_TOPICS, sawCharacterImage } from './model'
import type { SawCharacter, SawEmotion, SawPhase, SawResult } from './model'
import { sawCopy as c } from './copy'
import './saw.css'

type Props = {
  phase: SawPhase
  blade: number
  secondsLeft: number
  score: number
  round: number
  question: string
  transcript?: string
  speaking?: boolean
  supported?: boolean
  error?: string
  busy?: string
  preview?: boolean
  animated?: boolean
  character?: SawCharacter
  emotion?: SawEmotion
  topic?: string
  reply?: string
  volume?: number
  result?: SawResult
  soundEnabled?: boolean
  onStart?: () => void
  onNext?: () => void
  onBack?: () => void
  onCharacter?: (character: SawCharacter) => void
  onTopic?: (topic: string) => void
  onSurrender?: () => void
  onToggleSound?: () => void
}

export function SawGameView({ phase, blade, secondsLeft, score, round, question, transcript = '', speaking = false,
  supported = true, error, preview = false, animated = true, character = 'penguin', emotion = 'idle', topic = 'everyday',
  reply = '', busy = '', volume = 0, result, soundEnabled = true, onStart, onNext, onBack, onCharacter, onTopic, onSurrender, onToggleSound }: Props) {
  const info = SAW_CHARACTER_INFO[character]
  const finished = phase === 'cut' || phase === 'won'
  const active = phase === 'playing' || phase === 'starting' || phase === 'impact'
  const displayedSeconds = phase === 'ready' || phase === 'starting' ? ROUND_SECONDS : secondsLeft
  const threat = phase === 'ready' ? 0 : Math.max(0, Math.min(100, blade))
  const danger = phase === 'cut' || phase === 'impact' || phase === 'playing' && blade >= 80
  const loudness = Math.max(0, Math.min(1, volume))
  const status = phase === 'impact' ? c.contact : busy || (phase === 'starting' ? c.starting : speaking ? c.pushing : danger ? c.danger : c.waiting)
  const resultTitle = phase === 'won' ? c.won : result?.reason === 'surrender' ? c.surrenderTitle : c.lost

  return <main className="arra-page" data-phase={phase} data-preview={preview} data-animated={animated} data-danger={danger} data-character={character}
    style={{ '--arra-accent': info.accent } as CSSProperties}>
    <div className="arra-wrap">
      {!preview && <header className="arra-nav">
        <button type="button" onClick={onBack}><ArrowLeft size={18} />{c.back}</button>
        <span className="arra-brand">{c.title}<i />{c.subtitle}</span>
        <div className="arra-nav-actions">
          <span className="arra-score"><Trophy size={15} /><span>{c.score}</span>{score}</span>
          <button className="arra-sound" type="button" onClick={onToggleSound} disabled={!onToggleSound} aria-label={soundEnabled ? c.mute : c.unmute} aria-pressed={soundEnabled}>
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
      </header>}

      {phase === 'ready' && <section className="arra-setup">
        <div className="arra-intro"><span className="arra-eyebrow"><AudioLines size={14} />{c.eyebrow}</span><h1>{c.headline}</h1><p>{c.intro}</p></div>
        <h2 className="arra-section-label">{c.choose}</h2>
        <div className="arra-character-grid" role="group" aria-label={c.choose}>
          {SAW_CHARACTERS.map((hero) => {
            const characterInfo = SAW_CHARACTER_INFO[hero]
            return <button type="button" className="arra-character-card" key={hero} data-character={hero} data-selected={hero === character}
              aria-pressed={hero === character} onClick={() => onCharacter?.(hero)} style={{ '--card-accent': characterInfo.accent } as CSSProperties}>
              <span className="arra-character-check">{hero === character ? <Check size={15} /> : <span />}</span>
              <span className="arra-character-art" style={{ backgroundImage: `linear-gradient(180deg,transparent,#101516 100%),url('/games/arra/v3/${hero}-room.webp')` }}>
                <img src={sawCharacterImage(hero)} alt="" width="512" height="768" draggable={false} />
              </span>
              <span className="arra-character-copy"><strong>{characterInfo.name}</strong><span className="arra-character-trait">{characterInfo.trait}</span><small>{characterInfo.location}</small></span>
              <span className="arra-character-quote">«{characterInfo.quote}»</span>
            </button>
          })}
        </div>
        <div className="arra-setup-bottom">
          <label className="arra-topic"><span>{c.topic}</span><span className="arra-select-wrap"><select value={topic} onChange={(event) => onTopic?.(event.target.value)}>
            {SAW_TOPICS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select><ChevronDown size={17} /></span></label>
          <div className="arra-rules"><span><Mic size={15} />{c.speak}</span><span><ShieldCheck size={15} />{c.retreat}</span><span><Clock3 size={15} />{c.survive}</span></div>
          <button className="arra-start" type="button" disabled={!supported} onClick={onStart}><span className="arra-mic-disc"><Mic size={29} /></span><strong>{c.start}</strong></button>
        </div>
      </section>}

      {preview && <div className="arra-preview-caption"><strong>{info.name}</strong><span>{info.trait} · {info.location}</span><i>{SAW_CHARACTERS.map((hero) => <b key={hero} data-current={hero === character} />)}</i></div>}

      {active && <section className="arra-arena" aria-label={c.title} data-danger={danger}>
        <div className="arra-hud">
          <div className="arra-suspicion" role="meter" aria-label={c.threat} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(threat)}>
            <div className="arra-suspicion-heading"><span>{c.threat}</span><strong>{Math.round(threat)}<small>%</small></strong></div>
            <div className="arra-suspicion-track"><i style={{ width: `${threat}%` }} /></div>
          </div>
          <div className="arra-clock" role="timer" aria-label={`${c.remaining}: ${displayedSeconds}`}><Clock3 size={16} /><strong>{Math.floor(displayedSeconds / 60)}:{String(displayedSeconds % 60).padStart(2, '0')}</strong><span>{c.seconds}</span></div>
        </div>
        <div className="arra-stage-frame">
          <SawScene blade={threat} phase={phase} speaking={speaking} animated={animated} character={character} emotion={emotion} />
          <div className="arra-stage-status" data-speaking={speaking} data-danger={danger} role={preview ? undefined : 'status'}><span className="arra-status-dot" />{status}</div>
        </div>
        <div className="arra-question-row">
          <span className="arra-speaker-line" />
          <div className="arra-question"><span className="arra-eyebrow">{info.name} · {c.question} {round + 1}</span><h2>{question}</h2>{reply && reply !== question && <p className="arra-reply">{reply}</p>}</div>
        </div>
        <div className="arra-transcript" data-speaking={speaking}><Mic size={14} aria-hidden="true" /><p>{transcript || c.listening}</p>
          <span className="arra-wave" aria-label={c.speech}>{Array.from({ length: 13 }, (_, index) => <i key={index} style={{ height: `${4 + loudness * (10 + index * 11 % 21)}px` }} />)}</span>
        </div>
      </section>}

      {active && phase !== 'impact' && !preview && <div className="arra-live-controls">
        <div className="arra-recording" data-speaking={speaking} data-starting={phase === 'starting'} style={{ '--voice-size': loudness } as CSSProperties}>
          <span className="arra-mic-disc"><AudioLines size={30} /></span><span>{busy || (phase === 'starting' ? c.starting : speaking ? c.speaking : c.recording)}</span>
        </div>
        <button className="arra-surrender" type="button" onClick={onSurrender} disabled={!onSurrender}><X size={14} />{c.surrender}</button>
      </div>}

      {finished && <section className="arra-results" aria-label={c.result}>
        <div className="arra-result-heading"><span className="arra-eyebrow">{c.result}</span><h1>{resultTitle}</h1><p>{phase === 'won' ? c.wonBody : c.lostBody}</p></div>
        <div className="arra-result-scene"><SawScene blade={phase === 'won' ? 0 : result?.reason === 'surrender' ? threat : 100} phase={phase} speaking={false} animated={animated} character={character} emotion={phase === 'won' ? 'happy' : 'panic'} />
          {phase === 'won' && <span className="arra-point"><Trophy size={16} />{c.point}</span>}
        </div>
        {result ? <div className="arra-result-stats">
          <div><ShieldCheck size={19} /><span>{c.confidence}</span><strong>{Math.round(result.confidence)}<small>%</small></strong></div>
          <div><MessageCircle size={19} /><span>{c.words}</span><strong>{result.words}</strong></div>
          <div><Clock3 size={19} /><span>{c.time}</span><strong>{Math.round(result.spokenSeconds)}<small> {c.seconds}</small></strong></div>
          <div className="arra-favourite"><span className="arra-quote-mark">“</span><span>{c.favourite}</span><strong>{result.favouriteWord ? `«${result.favouriteWord}»` : '—'}</strong></div>
        </div> : <p className="arra-metrics-pending">{c.metricsPending}</p>}
        {phase === 'won' && <div className="arra-earned"><span className="arra-badge-art"><img src={sawCharacterImage(character, 'happy')} alt="" width="80" height="110" /><Crown size={20} /></span><span><small>{c.earned}</small><strong>{info.title}</strong></span><Check size={19} /></div>}
        <div className="arra-result-actions"><button className="arra-result-next" type="button" onClick={onStart}><RotateCcw size={18} />{c.retry}</button>{result && !preview && <SawShareButton character={character} result={result} className="arra-share" />}</div>
        <button className="arra-change-hero" type="button" onClick={onNext}><UserRound size={15} />{c.changeHero}</button>
      </section>}
      {(!supported || error) && !preview && <p className="arra-error" role="alert">{error || c.unsupported}</p>}
    </div>
  </main>
}

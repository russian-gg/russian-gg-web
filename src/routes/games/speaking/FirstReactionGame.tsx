import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, AudioLines, Check, Clock3, Headphones, Keyboard, Lightbulb, Mic, Play, RotateCcw, Sparkles, Square, Trophy, Volume2, X, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Spinner } from '../../../components/ui'
import { readAudioPreferences } from '../../../lib/audio-preferences'
import type { GameSpeechStatus } from '../../../lib/game-speech'
import { useLocale } from '../../../lib/i18n'
import type { GameDashboard, GameFeedback, GameSession, SpeakingGame } from '../../../lib/speaking-games'
import { GameShareButton } from '../GameShareButton'
import { gameLabels, type GameCopy } from './copy'
import { firstReactionCopies } from './first-reaction-copy'
import { FirstReactionMedia } from './FirstReactionMedia'
import { Statistics } from './Results'
import type { Companion } from './visuals'
import './first-reaction.css'

interface Props {
  copy: GameCopy; catalog: SpeakingGame | null; dashboard: GameDashboard | null; session: GameSession | null
  loading: boolean; busy: boolean; error: string; retryExhausted: boolean; pending: boolean
  character: Companion; level: string; transcript: string; typed: string; textMode: boolean
  supported: boolean; speechStatus: GameSpeechStatus; seconds: number; playingAudio: boolean; audioFailed: boolean
  onCharacter: (value: Companion) => void; onLevel: (value: string) => void; onTextMode: () => void; onTyped: (value: string) => void
  onStart: () => void; onResume: (id: string) => void; onBegin: () => void; onSubmit: () => void
  onNext: () => void; onEnd: () => void; onAgain: () => void; onRetry: () => void
  onAudio: (target: 'prompt' | 'feedback') => void; onLeave: () => void
}

function Portrait({ character, speaking = false, celebrating = false }: { character: Companion; speaking?: boolean; celebrating?: boolean }) {
  return <div className="fr-portrait" data-speaking={speaking} data-celebrating={celebrating} aria-hidden="true">
    <div className="fr-portrait-aura" />
    <img src={`/games/first-reaction/characters/${character}.webp`} width="512" height="512" alt="" />
    {celebrating && <><Sparkles className="fr-spark fr-spark-a" /><Sparkles className="fr-spark fr-spark-b" /></>}
  </div>
}

function RoundFeedback({ feedback, copy }: { feedback: GameFeedback; copy: GameCopy }) {
  const { locale } = useLocale()
  const text = firstReactionCopies[locale]
  const names: Record<string, string> = { speed: copy.speed, fast: copy.speed, relevance: copy.relevance, relevant: copy.relevance, grammar: copy.grammar, emotion: copy.emotion, emotional: copy.emotion, bonus: copy.bonus }
  return <div className="fr-analysis">
    <div className="fr-points"><strong>{feedback.points > 0 ? '+' : ''}{feedback.points}</strong><span>{text.points}</span></div>
    <div className="fr-criteria">{feedback.criteria.map((criterion, index) => <div key={`${criterion.code}-${index}`} data-passed={criterion.passed}>
      <span>{criterion.passed ? <Check size={15} aria-hidden="true" /> : <span className="fr-criterion-dot" />}{names[criterion.code] ?? criterion.label}</span><strong>{criterion.points > 0 ? '+' : ''}{criterion.points}</strong>
    </div>)}</div>
    <div className="fr-answer"><small>{copy.answer}</small><p lang="ru">{feedback.answer || copy.noAnswer}</p></div>
    {feedback.correctAnswer && <div className="fr-answer fr-better"><small><Sparkles size={14} aria-hidden="true" />{text.better}</small><p lang="ru">{feedback.correctAnswer}</p></div>}
    {feedback.explanation && <p className="fr-explanation" lang="ru">{feedback.explanation}</p>}
  </div>
}

function FirstReactionResults({ session, copy, onAgain }: { session: GameSession; copy: GameCopy; onAgain: () => void }) {
  const { locale } = useLocale()
  const text = firstReactionCopies[locale]
  const words = session.history.reduce((total, turn) => total + (turn.feedback.answer.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0), 0)
  const onsets = session.history.flatMap((turn) => typeof turn.feedback.reactionStartedMilliseconds === 'number' && turn.feedback.reactionStartedMilliseconds >= 0 ? [turn.feedback.reactionStartedMilliseconds] : [])
  const fastest = onsets.length ? `${(Math.min(...onsets) / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} ${copy.seconds}` : text.noTiming
  const maximum = session.totalRounds * (session.durationSeconds <= 5 ? 8 : 10)
  const strong = session.score >= Math.max(1, maximum) * .7
  const message = strong
    ? { penguin: text.strongPenguin, panda: text.strongPanda, pero: text.strongPero }[session.character]
    : { penguin: text.retryPenguin, panda: text.retryPanda, pero: text.retryPero }[session.character]
  return <section className="fr-result fr-glass" data-strong={strong}>
    {strong && <div className="fr-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--fr-i': index } as CSSProperties} />)}</div>}
    <span className="fr-eyebrow"><Check size={15} aria-hidden="true" />{copy.saved}</span>
    <h1>{strong ? text.strongResult : text.result}</h1>
    <p className="fr-muted">{text.resultNote}</p>
    <div className="fr-result-hero"><Portrait character={session.character} celebrating={strong} /><div className="fr-result-score"><Trophy size={30} aria-hidden="true" /><strong>{session.score}<span> / {maximum}</span></strong><small>{text.score}</small></div></div>
    {session.summary?.isNewBest && <p className="fr-record"><Sparkles size={17} aria-hidden="true" />{copy.record}</p>}
    <div className="fr-result-stats"><div><AudioLines aria-hidden="true" /><strong>{words}</strong><small>{text.words}</small></div><div><Zap aria-hidden="true" /><strong>{fastest}</strong><small>{text.fastest}</small></div><div><Check aria-hidden="true" /><strong>{session.summary?.roundsPlayed ?? session.history.length} / {session.totalRounds}</strong><small>{copy.rounds}</small></div></div>
    <p className="fr-result-message">{message}</p>
    <div className="fr-result-actions"><button className="fr-primary" onClick={onAgain}><RotateCcw size={19} aria-hidden="true" />{copy.again}</button><Link className="fr-secondary" to="/games">{text.menu}</Link><GameShareButton slug="first-reaction" title={gameLabels['first-reaction'][locale].title} result={[`${copy.score}: ${session.score} / ${maximum}`, `${text.words}: ${words}`, ...(onsets.length ? [`${text.fastest}: ${fastest}`] : [])]} className="fr-secondary" /></div>
    {session.history.length > 0 && <section className="fr-history"><h2>{copy.review}</h2>{session.history.map((turn, index) => <details key={`${turn.roundIndex}-${index}`}><summary><span lang="ru">{turn.prompt.textRu}</span><strong>{turn.feedback.points > 0 ? '+' : ''}{turn.feedback.points}</strong></summary><RoundFeedback feedback={turn.feedback} copy={copy} /></details>)}</section>}
  </section>
}

export function FirstReactionGame(props: Props) {
  const { locale } = useLocale()
  const text = firstReactionCopies[locale]
  const { copy, session, busy, catalog, loading, dashboard } = props
  const levelName = useId()
  const [reacting, setReacting] = useState(false)
  const sound = useRef<AudioContext | null>(null)
  const lastTick = useRef(-1)
  const active = session?.status === 'answering'
  const feedback = session?.status === 'feedback' ? session.feedback : null
  const wholeSeconds = Math.ceil(props.seconds)
  const mood = wholeSeconds <= 4 ? 'urgent' : wholeSeconds <= 9 ? 'warning' : 'calm'
  const remaining = Math.max(0, Math.min(1, props.seconds / (session?.durationSeconds || 20)))
  const listening = active && props.speechStatus === 'listening' && !busy && props.seconds > 0
  const saved = dashboard?.activeSessions.find((entry) => entry.gameSlug === 'first-reaction')

  useEffect(() => {
    if (!active || !props.transcript) { setReacting(false); return }
    setReacting(true)
    const timer = window.setTimeout(() => setReacting(false), 900)
    return () => window.clearTimeout(timer)
  }, [active, props.transcript])

  useEffect(() => {
    if (!active) { lastTick.current = -1; return }
    if (wholeSeconds < 1 || wholeSeconds > 4 || wholeSeconds === lastTick.current) return
    lastTick.current = wholeSeconds
    if (readAudioPreferences().muted || props.playingAudio || !sound.current || sound.current.state !== 'running') return
    const context = sound.current
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 700
    gain.gain.setValueAtTime(0.025, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.055)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.065)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }, [active, wholeSeconds, props.playingAudio])

  useEffect(() => () => { void sound.current?.close().catch(() => {}) }, [])

  function begin() {
    if (!readAudioPreferences().muted) {
      try {
        sound.current ??= new AudioContext()
        void sound.current.resume().catch(() => {})
      } catch { sound.current = null }
    }
    props.onBegin()
  }

  return <main className="sg" data-game="first-reaction" data-stage={session?.status ?? 'setup'}>
    <div className="fr-backdrop" aria-hidden="true"><i /><i /><i /></div>
    <nav className="sg-nav"><Link className="fr-icon" to="/games" onClick={props.onLeave} aria-label={copy.games} title={copy.games}><ArrowLeft size={20} aria-hidden="true" /></Link><strong>{gameLabels['first-reaction'][locale].title}</strong>{session && session.status !== 'completed' ? <button className="fr-icon fr-exit" disabled={busy} onClick={props.onEnd} aria-label={copy.finish} title={copy.finish}><X size={20} aria-hidden="true" /></button> : <span className="fr-nav-note">RU <span>•</span> {session?.level || props.level}</span>}</nav>
    <div className="fr-content">
      {loading ? <div className="fr-loading"><Spinner /></div> : <>
        {props.error && <div className="sg-error" role="alert">{props.error}{!props.retryExhausted && <button onClick={props.onRetry} disabled={busy}>{copy.retry}</button>}</div>}
        {!session && catalog && <section className="fr-setup">
          <header className="fr-intro"><h1>{gameLabels['first-reaction'][locale].title}<span aria-hidden="true">!</span></h1><p className="fr-tagline">{text.intro}</p><div className="fr-facts"><span><Clock3 size={19} aria-hidden="true" /><strong>20 {copy.seconds}</strong><small>{text.duration}</small></span><i /><span><Sparkles size={19} aria-hidden="true" /><strong>5</strong><small>{text.rounds}</small></span></div></header>
          <fieldset className="fr-companions" disabled={busy || Boolean(saved)}><legend>{text.choose}</legend><div>{(['penguin', 'panda', 'pero'] as const).map((character) => <button key={character} className="fr-character fr-glass" data-character={character} aria-label={copy[character === 'pero' ? 'feather' : character]} aria-pressed={props.character === character} onClick={() => props.onCharacter(character)}>
            <span className="fr-character-selected"><Check size={14} aria-hidden="true" /></span><Portrait character={character} /><strong>{copy[character === 'pero' ? 'feather' : character]}</strong><span className="fr-personality">{text[character]}</span>
          </button>)}</div></fieldset>
          <div className="fr-setup-bottom fr-glass"><fieldset className="fr-levels" disabled={busy || Boolean(saved)}><legend>{text.level}</legend><div>{catalog.levels.filter((value) => ['A1', 'A2', 'B1'].includes(value)).map((level) => <label key={level} data-selected={props.level === level}><input type="radio" name={levelName} value={level} checked={props.level === level} onChange={() => props.onLevel(level)} /><span>{level}</span></label>)}</div></fieldset><div className="fr-start-wrap">{!catalog.isEnabled ? <p role="status">{copy.disabled}</p> : !catalog.isAccessible ? <p role="status">{copy.locked} {copy.unlock}</p> : <><button className="fr-primary fr-start" disabled={busy} onClick={saved ? () => props.onResume(saved.id) : props.onStart}><Play size={21} fill="currentColor" aria-hidden="true" />{busy ? copy.loading : saved ? copy.resume : copy.start}</button>{saved && <small>{copy.savedGame}</small>}</>}</div></div>
          <Statistics slug="first-reaction" copy={copy} dashboard={dashboard} />
        </section>}
        {!session && !catalog && !props.error && <p className="fr-muted">{copy.disabled}</p>}
        {session?.status === 'completed' && <FirstReactionResults session={session} copy={copy} onAgain={props.onAgain} />}
        {session && session.status !== 'completed' && <>
          <div className="fr-hud"><div role="group" aria-label={copy.rounds}><strong>{Math.min(session.roundIndex + 1, session.totalRounds)} <small>/ {session.totalRounds}</small></strong></div><div className="fr-round-dots" role="progressbar" aria-label={copy.progress} aria-valuenow={session.history.length} aria-valuemax={session.totalRounds} aria-valuemin={0}>{Array.from({ length: session.totalRounds }, (_, index) => <i key={index} data-complete={index < session.history.length} data-current={index === session.roundIndex} />)}</div><div className="fr-hud-score" role="group" aria-label={copy.score}><Trophy size={19} aria-hidden="true" /><strong>{session.score}</strong></div></div>
          <div className="fr-play-grid" data-active={active} data-feedback={Boolean(feedback)}>
            <section className="fr-situation fr-glass" aria-label={text.situation}><div className="fr-scene-visual"><FirstReactionMedia prompt={session.prompt} /><span className="fr-scene-label"><Sparkles size={14} aria-hidden="true" />{session.roundIndex + 1} / {session.totalRounds}</span></div><div className="fr-situation-text"><div className="fr-situation-heading"><h1 lang="ru">{session.prompt.textRu || copy.ready}</h1><button className="fr-icon fr-audio" aria-label={text.promptAudio} title={text.promptAudio} disabled={active || busy || props.playingAudio || !session.prompt.textRu} onClick={() => props.onAudio('prompt')}><Volume2 size={20} aria-hidden="true" /></button></div>{!feedback && Boolean(session.prompt.hints?.length) && <div className="fr-hints" role="group" aria-label={text.hints}><Lightbulb size={17} aria-hidden="true" /><div>{session.prompt.hints?.map((hint, index) => <span key={`${index}-${hint}`} lang="ru">{hint}</span>)}</div></div>}</div></section>
            {feedback ? <section className="fr-feedback-panel fr-glass" aria-label={copy.review}><div className="fr-feedback-character"><Portrait character={session.character} celebrating={feedback.points >= 7} /><div><span className="fr-eyebrow">{text.feedback}</span><p lang="ru">{feedback.characterPhrase}</p></div></div><RoundFeedback feedback={feedback} copy={copy} /><div className="fr-feedback-actions"><button className="fr-icon fr-secondary" aria-label={copy.listen} title={copy.listen} disabled={busy || props.playingAudio} onClick={() => props.onAudio('feedback')}><Headphones size={20} aria-hidden="true" /></button><button className="fr-primary" aria-label={copy.next} title={copy.next} disabled={busy} onClick={props.onNext}>{busy ? <Spinner /> : <ArrowRight size={24} aria-hidden="true" />}</button></div></section>
              : <section className="fr-response fr-glass" data-mood={mood} data-listening={listening} data-reacting={reacting}>
                <Portrait character={session.character} speaking={reacting} />
                <div className="fr-mic-timer" data-active={active} role={active ? 'timer' : undefined} aria-label={active ? `${wholeSeconds} ${copy.seconds}` : undefined}>
                  {active && <svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="98" /><circle cx="110" cy="110" r="98" strokeDasharray={2 * Math.PI * 98} strokeDashoffset={2 * Math.PI * 98 * (1 - remaining)} /></svg>}
                  <button className="fr-mic-core" data-recording={active} aria-label={props.pending ? copy.retry : active ? text.submit : copy.ready} title={props.pending ? copy.retry : active ? text.submit : copy.ready} disabled={busy || props.retryExhausted || (!active && !props.textMode && !props.supported)} onClick={props.pending || active ? props.onSubmit : begin}>{busy ? <Spinner /> : active ? <Square size={34} fill="currentColor" aria-hidden="true" /> : <Mic size={42} aria-hidden="true" />}</button>
                  {active && <strong className="fr-time-value" aria-hidden="true">{wholeSeconds}</strong>}
                </div>
                <p className="fr-sr-only" role="status">{active ? busy ? copy.saving : props.textMode ? copy.textMode : listening ? text.listening : props.seconds <= 0 ? copy.timeUp : text.paused : ''}</p>
                <div className="fr-equalizer" aria-hidden="true" data-moving={reacting} data-active={active}>{[12, 22, 34, 18, 42, 28, 14, 32, 40, 20, 30, 16, 25].map((height, index) => <i key={index} style={{ '--fr-bar': `${height}px`, '--fr-delay': `${index * -.11}s` } as CSSProperties} />)}</div>
                <div className="fr-response-tools">{!active && <button className="fr-icon fr-mode" disabled={busy || props.pending} onClick={props.onTextMode} aria-label={props.textMode ? copy.voice : copy.type} title={props.textMode ? copy.voice : copy.type}>{props.textMode ? <Mic size={20} aria-hidden="true" /> : <Keyboard size={20} aria-hidden="true" />}</button>}{active && !props.textMode && !listening && !busy && !props.pending && props.seconds > 0 && <button className="fr-icon" onClick={begin} aria-label={text.paused} title={text.paused}><Mic size={20} aria-hidden="true" /></button>}</div>
                {active && !props.transcript && !props.typed && !props.pending && props.seconds < session.durationSeconds - 3 && props.seconds > 0 && <p className="fr-encouragement">{text.encouragement}</p>}
                {active && <div className="fr-transcript"><small>{props.textMode ? copy.answer : text.transcript}</small>{props.textMode ? <textarea autoFocus aria-label={copy.answer} lang="ru" maxLength={4000} value={props.typed} onChange={(event) => props.onTyped(event.target.value)} disabled={busy || props.pending || props.seconds <= 0} /> : <p lang="ru" aria-live="polite">{props.transcript || session.pendingAnswer?.text || '…'}</p>}</div>}
                {props.textMode && !active && <p className="fr-muted">{text.textNote}</p>}
                {!props.supported && !active && <p className="fr-muted" role="status">{copy.unsupported}</p>}
                {(props.speechStatus === 'denied' || props.speechStatus === 'failed') && <div className="sg-error" role="alert"><strong>{props.speechStatus === 'denied' ? copy.micDenied : copy.micFailed}</strong>{props.speechStatus === 'denied' && <p>{copy.micHelp}</p>}{active && <button disabled={busy || props.pending || props.seconds <= 0} onClick={props.onTextMode}>{copy.type}</button>}</div>}
              </section>}
          </div>
          {props.audioFailed && <p className="fr-audio-failed" role="status">{copy.audioFailed}</p>}
        </>}
      </>}
    </div>
  </main>
}

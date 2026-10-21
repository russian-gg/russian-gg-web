import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Coffee, Flower2, Gem, Leaf, LockKeyhole, MessageCircle, Mic, Music2, RotateCcw, Share2, Sparkles, Square, Trophy } from 'lucide-react'
import { useLocale } from '../../../lib/i18n'
import { RequestError } from '../../../lib/api'
import { VoiceError } from '../../../lib/liveVoice'
import { lifeApi, type LifeCatalog, type LifeCharacter } from './api'
import { lifeCopies } from './copy'
import { LifeScene } from './LifeScene'
import { useLifeGame } from './useLifeGame'
import './life.css'

const characters: LifeCharacter[] = ['penguin', 'panda', 'pero']

export function FightForLife() {
  const { locale } = useLocale()
  const navigate = useNavigate()
  const copy = lifeCopies[locale]
  const game = useLifeGame()
  const [catalog, setCatalog] = useState<LifeCatalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [reload, setReload] = useState(0)
  const [character, setCharacter] = useState<LifeCharacter>('penguin')
  const [level, setLevel] = useState('A1')
  const [mode, setMode] = useState('debate')
  const [topicId, setTopicId] = useState('01')
  const [shared, setShared] = useState(false)
  useEffect(() => {
    let active = true
    setCatalogError(false)
    void lifeApi.catalog().then(result => {
      if (!active) return
      if (result.lockReason === 'pro_required') {
        navigate('/paywall', { replace: true })
        return
      }
      setCatalog(result)
    }).catch((caught) => {
      if (!active) return
      if (caught instanceof RequestError && caught.isPaywall) navigate('/paywall', { replace: true })
      else setCatalogError(true)
    })
    return () => { active = false }
  }, [reload, navigate])
  const topics = catalog?.topics.filter(topic => topic.mode === mode && topic.level === (level === 'B1' ? 'B1' : 'A1-A2')) ?? []
  const selected = topics.find(topic => topic.id === topicId) ?? topics[0]
  const playing = game.phase === 'playing' || game.phase === 'saving'
  const shownCharacter = game.view?.character ?? character
  const code = game.error instanceof RequestError || game.error instanceof VoiceError ? game.error.code : String(game.error)
  const errorText = code.startsWith('mic_') ? copy.mic : code === 'voice_daily_limit' ? copy.limit : code.startsWith('provider_') ? copy.unavailable : code === 'game_disabled' ? copy.disabled : copy.error
  const emotion = game.visual.emotion
  async function share() {
    const text = `Помоги! · ${game.view?.score ?? 0} ${copy.crystals}`
    try {
      if (navigator.share) await navigator.share({ title: 'Помоги!', text })
      else { await navigator.clipboard.writeText(text); setShared(true) }
    } catch { setShared(false) }
  }
  return <main className="life-game" data-character={shownCharacter} data-phase={game.phase} data-emotion={emotion}
    style={{ '--world-energy': playing ? game.visual.energy : 1 } as CSSProperties}>
    <LifeEnvironment character={shownCharacter} />
    <div className="life-bokeh" aria-hidden="true"><i /><i /><i /></div>
    <div className="life-wrap">
      <header className="life-header">
        <Link to="/games"><ArrowLeft size={17} />{copy.back}</Link>
        <span lang="ru">Помоги!</span>
      </header>
      {catalogError ? <div className="life-notice" role="alert"><p>{copy.error}</p><button onClick={() => setReload(n => n + 1)}>{copy.retry}</button></div>
        : !catalog ? <p className="life-notice" role="status">{copy.loading}</p>
          : !catalog.isEnabled || !catalog.isAccessible ? <div className="life-notice"><LockKeyhole size={34} /><p>{copy.disabled}</p></div>
            : game.phase === 'setup' ? <>
              <section className="life-intro"><h1>{copy.character}</h1><div className="life-rules"><span><Mic aria-hidden="true" />{copy.silenceRule}</span><span><Trophy aria-hidden="true" />{copy.victoryRule}</span></div></section>
              <section className="life-setup">
                <div className="life-choices">{characters.map(id => <button key={id} className="life-character-choice" data-character={id} aria-pressed={character === id} onClick={() => setCharacter(id)}>
                  <LifeScene character={id} compact />
                  <span className="life-character-name">{copy[id]}{character === id && <Check size={16} />}</span>
                </button>)}</div>
                <div className="life-options">
                  <fieldset><legend>{copy.level}</legend><div className="life-segment">{['A1', 'A2', 'B1'].map(item => <button key={item} aria-pressed={level === item} onClick={() => setLevel(item)}>{item}</button>)}</div></fieldset>
                  <fieldset><legend>{copy.mode}</legend><div className="life-segment">{(['debate', 'monologue'] as const).map(item => <button key={item} aria-pressed={mode === item} onClick={() => setMode(item)}>{copy[item]}</button>)}</div></fieldset>
                </div>
                <label className="life-topic-label" htmlFor="life-topic">{copy.topic}</label>
                <select id="life-topic" value={selected?.id ?? ''} onChange={event => setTopicId(event.target.value)} lang="ru">{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
                <button className="life-start" disabled={!selected} onClick={() => selected && void game.start(character, level, selected.id)}><Mic size={22} />{copy.start}<ArrowRight size={20} /></button>
              </section>
            </> : game.phase === 'connecting' ? <section className="life-connecting" role="status"><div className="life-stage"><LifeScene character={shownCharacter} /><LifeSpeech key={`${game.visual.tutor}-${game.tutorLine}`} text={game.tutorLine} tutor={game.visual.tutor} /></div>{!game.tutorLine && <span className="life-eyebrow">{copy.connecting}</span>}</section>
              : game.phase === 'error' ? <section className="life-notice" role="alert"><p>{errorText}</p><button onClick={() => void game.recover()}>{copy.retry}</button><button onClick={game.reset}>{copy.again}</button></section>
                : playing ? <section className="life-play">
                  <div className="life-hud"><div aria-label={copy.crystals}><Gem size={21} /><strong key={game.visual.score}>{game.visual.score}</strong></div></div>
                  <div className="life-topic"><h1 lang="ru">{game.view?.topic.title}</h1><span>{copy[game.view?.topic.mode ?? 'debate']} · {game.view?.level}</span></div>
                  <div className="life-stage">
                    <LifeScene character={shownCharacter} emotion={emotion} energy={game.visual.energy} volume={game.visual.volume} />
                    <LifeSpeech key={`${game.visual.tutor}-${game.tutorLine}`} text={game.tutorLine} tutor={game.visual.tutor} />
                  </div>
                  <button className="life-mic" data-speaking={game.visual.speaking} aria-label={copy.stop} disabled={game.phase === 'saving'} onClick={() => void game.stop()}>
                    {game.visual.speaking ? <span className="life-mic-bars">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ height: `${12 + game.visual.volume * (i % 2 ? 30 : 18)}px` }} />)}</span> : <Square size={23} fill="currentColor" />}<span>{game.phase === 'saving' ? copy.loading : copy.stop}</span>
                  </button>
                </section> : game.view && <section className="life-results">
                  <h1>{game.view.outcome === 'won' ? copy.won : game.view.outcome === 'silence' ? copy.lost : copy.stopped}</h1>
                  <LifeScene character={shownCharacter} emotion={game.view.outcome === 'won' ? 'won' : game.view.outcome === 'silence' ? 'frozen' : 'idle'} energy={game.view.outcome === 'won' ? 1 : .25} />
                  <p className="life-result-note">{game.view.outcome === 'won' ? copy.wonNote : copy.lostNote}</p>
                  <div className="life-result-details">
                    <div><Clock3 aria-hidden="true" /><span>{copy.speech}</span><strong>{Math.floor(game.view.speechMilliseconds / 1000)} <small>{copy.seconds}</small></strong></div>
                    <div><Gem aria-hidden="true" /><span>{copy.crystals}</span><strong>{game.view.score}</strong></div>
                    <div><MessageCircle aria-hidden="true" /><span>{copy.words}</span><strong>{game.view.transcript.match(/[\p{L}]+/gu)?.length ?? 0}</strong></div>
                  </div>
                  <div className="life-result-actions"><button className="life-start" onClick={() => { setShared(false); game.reset() }}><RotateCcw size={20} />{copy.again}</button><button className="life-share" onClick={() => void share()}><Share2 size={19} />{shared ? copy.copied : copy.share}</button></div>
                  {game.view.transcript && <details className="life-transcript"><summary>{copy.transcript}</summary><p lang="ru">{game.view.transcript}</p></details>}
                </section>}
    </div>
  </main>
}

function LifeSpeech({ text, tutor }: { text: string; tutor: boolean }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    if (tutor) return
    const timer = window.setTimeout(() => setVisible(false), 3600)
    return () => window.clearTimeout(timer)
  }, [tutor])
  return visible && text ? <div className="life-speech" role="status" lang="ru">{text}</div> : null
}

function LifeEnvironment({ character }: { character: LifeCharacter }) {
  const symbols = character === 'penguin' ? [Music2, Gem, Music2] : character === 'panda' ? [Flower2, Coffee, Flower2] : [BookOpen, Sparkles, BookOpen]
  return <div className="life-environment" aria-hidden="true">
    <div className="life-rays" />
    {Array.from({ length: 12 }, (_, i) => {
      const Symbol = symbols[i % symbols.length]
      return <Symbol key={i} style={{ '--i': i, left: `${4 + i * 29 % 92}%`, top: `${8 + i * 17 % 85}%` } as CSSProperties} />
    })}
    <div className="life-rain">{Array.from({ length: 10 }, (_, i) => <Leaf key={i} style={{ '--i': i, left: `${i * 13 % 100}%` } as CSSProperties} />)}</div>
  </div>
}

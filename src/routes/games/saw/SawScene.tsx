import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { SawCharacter, SawEmotion, SawPhase } from './model'
import { SawFace } from './face'
import type { SawPose } from './face-rig'
import { SawPuppet } from './puppet'
import './scene.css'

type SawSceneProps = {
  blade: number
  phase: SawPhase
  speaking?: boolean
  tutorSpeaking?: boolean
  volume?: number
  animated?: boolean
  character?: SawCharacter
  emotion?: SawEmotion
  /** How loud the hero's own voice is right now (0..1), read every frame to move the mouth. */
  voiceLevel?: () => number
}

type Whip = 'out' | 'jump' | null
const WHIP_OUT_MS = 170
const WHIP_COOLDOWN_MS = 5000

const teeth = Array.from({ length: 30 }, (_, index) => {
  const points = [[61, 0], [70, 3], [70, 7], [60, 10]]
  return points.map(([radius, offset]) => {
    const angle = (index * 12 + offset) * Math.PI / 180
    return `${80 + Math.cos(angle) * radius},${80 + Math.sin(angle) * radius}`
  }).join(' ')
}).join(' ')

const characterContact = {
  penguin: { x: .297, y: .672 },
  panda: { x: .234, y: .509 },
  pero: { x: .267, y: .677 },
} satisfies Record<SawCharacter, { x: number; y: number }>

// Where the head sits inside the square portrait: sweat and shock marks fly from here.
const characterHead = {
  penguin: { x: .53, y: .2 },
  panda: { x: .45, y: .27 },
  pero: { x: .47, y: .36 },
} satisfies Record<SawCharacter, { x: number; y: number }>

const sparkAngles = [-118, -95, -71, -47, -21, 6, 34, 69, 108, 149]
const poses = ['idle', 'confident', 'danger'] as const

function portraitFor(character: SawCharacter, pose: typeof poses[number]) {
  const variant = character === 'panda' && pose !== 'idle' ? '-dry' : ''
  return `/games/arra/v3/${character}-${pose}${variant}.webp`
}

export function SawScene({ blade, phase, speaking = false, tutorSpeaking = false, volume = 0, animated = true, character = 'penguin', emotion, voiceLevel }: SawSceneProps) {
  const threat = Math.max(0, Math.min(100, blade))
  const progress = phase === 'won' ? 0 : threat / 100
  const reaction = phase === 'impact' || (phase === 'playing' && threat >= 80) ? 'panic'
    : phase === 'won' ? 'happy'
      : tutorSpeaking && phase !== 'cut' ? 'speaking'
        : emotion ?? (speaking ? 'speaking' : threat >= 40 ? 'silence' : 'idle')
  // Fear grows in steps as the blade closes in; answering out loud takes the edge off it.
  const closeness = phase === 'impact' ? 1 : phase === 'playing' ? Math.max(0, Math.min(1, (threat - 22) / 68)) : 0
  const fear = speaking && phase === 'playing' ? closeness * .5 : closeness
  const dangerStep = phase === 'impact' ? 3 : phase !== 'playing' ? 0 : threat >= 80 ? 3 : threat >= 55 ? 2 : threat >= 30 ? 1 : 0
  const fearLevel = speaking && dangerStep < 3 ? Math.max(0, dangerStep - 1) : dangerStep
  // The panda keeps her composure until the blade is almost on her.
  const frightened = fearLevel >= (character === 'panda' ? 3 : 2)
  const pose = reaction === 'panic' || frightened ? 'danger'
    : reaction === 'happy' || reaction === 'speaking' ? 'confident' : 'idle'
  const portrait = portraitFor(character, pose)
  const contact = characterContact[character]
  const head = characterHead[character]
  const rotor = useRef<HTMLDivElement>(null)
  // The hero is drawn as a deforming mesh; browsers without WebGL fall back to the flat portrait.
  const [puppet, setPuppet] = useState(true)
  const portraitOf = useCallback((item: SawPose) => portraitFor(character, item), [character])
  const dropPuppet = useCallback(() => setPuppet(false), [])
  const pressure = Math.max(0, (progress - .3) / .7)
  const rpm = phase === 'impact' ? 4.4 : phase === 'playing' ? 1 + progress * 3.2 : .45

  /*
    The hero does not wait in one spot. It backs away as the blade comes on, and when the blade
    gets close it bolts to the far side: the camera whips after it and the chase resumes mirrored.
  */
  const [side, setSide] = useState<1 | -1>(1)
  const [whip, setWhip] = useState<Whip>(null)
  const lastStep = useRef(0)
  const lastWhip = useRef(-Infinity)
  const whipTimer = useRef(0)
  useEffect(() => {
    const rising = dangerStep >= 2 && lastStep.current < 2
    lastStep.current = dangerStep
    if (!rising || !animated || phase !== 'playing' || performance.now() - lastWhip.current < WHIP_COOLDOWN_MS) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    lastWhip.current = performance.now()
    setWhip('out')
    whipTimer.current = window.setTimeout(() => {
      setSide((current) => current === 1 ? -1 : 1)
      setWhip('jump')
      // Two frames: the mirrored stage has to be painted off-screen before it slides back in.
      requestAnimationFrame(() => requestAnimationFrame(() => setWhip(null)))
    }, WHIP_OUT_MS)
  }, [dangerStep, animated, phase])
  useEffect(() => () => window.clearTimeout(whipTimer.current), [])

  const running = phase === 'playing' && animated && (whip !== null || (fearLevel >= 1 && !speaking && !tutorSpeaking))
  useEffect(() => {
    poses.forEach((item) => {
      const image = new Image()
      image.src = portraitFor(character, item)
    })
  }, [character])
  useEffect(() => {
    const animation = rotor.current?.getAnimations?.()[0]
    if (animation?.updatePlaybackRate) animation.updatePlaybackRate(rpm)
    else if (animation) animation.playbackRate = rpm
  }, [rpm, animated])
  const style = {
    '--blade-progress': progress,
    '--scene-pressure': pressure,
    '--scene-voice': Math.max(0, Math.min(1, volume)),
    '--contact-local-x': contact.x,
    '--contact-local-y': contact.y,
    '--fear': fear,
    '--flee': Math.min(1, progress * 1.3),
    '--side': side,
    '--head-x': head.x,
    '--head-y': head.y,
  } as CSSProperties
  return (
    <div className="arra-scene" data-character={character} data-phase={phase} data-emotion={reaction} data-pose={pose} data-puppet={puppet} data-fear={fearLevel} data-whip={whip ?? undefined} data-running={running} data-grinding={threat >= 45 && phase === 'playing'} data-critical={threat >= 80 && phase !== 'won'} data-speaking={speaking} data-tutor={tutorSpeaking} data-animated={animated} style={style} aria-hidden="true">
      <div className="arra-scene__camera">
        <div className="arra-scene__room" />
        <div className="arra-scene__room-shade" />
        <div className="arra-scene__light-shaft" />
        <div className="arra-scene__lamp-glow" />
        {character === 'penguin' ? <FactoryDetails /> : character === 'panda' ? <AtticDetails /> : <TheaterDetails />}
        <div className="arra-scene__motes">
          {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--particle': index, left: `${7 + index * 13 % 87}%`, top: `${12 + index * 19 % 74}%` } as CSSProperties} />)}
        </div>
        <div className="arra-scene__stage">
          <div className="arra-scene__track" />
          <div className="arra-scene__saw">
            <div className="arra-scene__saw-shadow" />
            <div className="arra-scene__saw-lunge">
              <div className="arra-scene__saw-buzz">
                <div className="arra-scene__blade-aura" />
                <div className="arra-scene__rotor" ref={rotor}><SawBlade /></div>
                <div className="arra-scene__blade-reflection" />
                <div className="arra-scene__grind">
                  {sparkAngles.map((angle, index) => <i key={angle} style={{ '--spark': index, '--spark-angle': `${angle}deg` } as CSSProperties} />)}
                </div>
              </div>
            </div>
          </div>
          <div className="arra-scene__character-ground" />
          <div className="arra-scene__character">
            <div className="arra-scene__character-fear">
              <div className="arra-scene__character-startle">
                <div className="arra-scene__character-motion">
                  <div className="arra-scene__character-shiver">
                    <div className="arra-scene__character-pose" key={puppet ? character : portrait} style={{ '--portrait-image': `url('${portrait}')` } as CSSProperties}>
                      {puppet
                        ? <SawPuppet character={character} pose={pose} portrait={portraitOf} fear={fear} fearLevel={fearLevel} talking={tutorSpeaking}
                          listening={speaking} voice={volume} voiceLevel={voiceLevel} running={running} phase={phase} animated={animated} onUnavailable={dropPuppet} />
                        : <>
                          <img src={portrait} alt="" width="768" height="768" draggable={false} />
                          <SawFace character={character} pose={pose} fear={fear} animated={animated} />
                        </>}
                      {character === 'penguin' && <div className="arra-scene__tool-sparks"><i /><i /><i /><i /></div>}
                    </div>
                    <div className="arra-scene__sweat"><i /><i /><i /><i /></div>
                    <div className="arra-scene__shock"><i /><i /><i /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="arra-scene__dust"><i /><i /><i /></div>
            <div className="arra-scene__voice-halo"><i /><i /><i /></div>
            <div className="arra-scene__character-energy" />
            <div className="arra-scene__reward-sparks">
              {Array.from({ length: 5 }, (_, index) => <svg key={index} viewBox="0 0 24 24" style={{ '--star': index } as CSSProperties}><path d="m12 1 2.7 7.9L23 12l-8.3 2.5L12 23l-2.7-8.5L1 12l8.3-3.1Z" /></svg>)}
            </div>
          </div>
          <div className="arra-scene__contact">
            <div className="arra-scene__contact-flash" />
            <div className="arra-scene__sparks">
              {sparkAngles.map((angle, index) => <i key={angle} style={{ '--spark': index, '--spark-angle': `${angle}deg` } as CSSProperties} />)}
            </div>
            <div className="arra-scene__smoke"><i /><i /><i /></div>
            <div className="arra-scene__oil">
              {[-130, -81, -46, -13, 22, 71, 124].map((angle, index) => <i key={angle} style={{ '--spark': index, '--spark-angle': `${angle}deg` } as CSSProperties} />)}
            </div>
          </div>
        </div>
        <div className="arra-scene__whip" />
      </div>
      <div className="arra-scene__flicker" />
      <div className="arra-scene__vignette" />
      <div className="arra-scene__dread" />
      <div className="arra-scene__danger-light" />
      <div className="arra-scene__alarm" />
      <div className="arra-scene__scare" />
      <div className="arra-scene__win-light" />
      <div className="arra-scene__grain" />
      <div className="arra-scene__bars" />
      <svg className="arra-scene__crack" viewBox="0 0 100 60" preserveAspectRatio="none">
        <path d="M50 30 38 18 30 19 17 6M38 18 40 8 33 0M50 30 63 21 70 23 86 9M63 21 61 10 68 2M50 30 58 42 55 51 63 60M58 42 71 45 84 57M50 30 39 41 41 50 30 60M39 41 26 40 12 49M50 30 52 15M50 30 34 30 22 27M50 30 67 32 80 30" />
        <path d="M38 18 44 22 50 30M63 21 57 25M58 42 52 37M39 41 45 35M44 22 57 25 52 37 45 35Z" />
      </svg>
      <div className="arra-scene__blackout" />
    </div>
  )
}

function FactoryDetails() {
  return <div className="arra-scene__factory">
    <div className="arra-scene__pipe"><i /><i /><i /></div>
    <div className="arra-scene__gear"><svg viewBox="0 0 100 100">
      {Array.from({ length: 12 }, (_, index) => <rect key={index} x="43" y="3" width="14" height="20" rx="2" transform={`rotate(${index * 30} 50 50)`} fill="#42596a" stroke="#8299a5" strokeWidth="1" />)}
      <circle cx="50" cy="50" r="35" fill="#243842" stroke="#758f9b" strokeWidth="3" />
      <circle cx="50" cy="50" r="22" fill="#13222b" stroke="#536b77" strokeWidth="5" />
      <circle cx="50" cy="50" r="9" fill="#758f9b" />
    </svg></div>
    <div className="arra-scene__steam"><i /><i /><i /></div>
  </div>
}

function AtticDetails() {
  return <div className="arra-scene__attic">
    <div className="arra-scene__hanging-lamp"><i /><b /></div>
    <div className="arra-scene__woodbeam arra-scene__woodbeam--one" /><div className="arra-scene__woodbeam arra-scene__woodbeam--two" />
    <div className="arra-scene__cobweb"><svg viewBox="0 0 120 100"><path d="M0 0 120 20M0 0l100 60M0 0l50 100M0 0l10 100M10 20Q24 17 25 4M16 40Q40 36 47 7M19 65Q55 53 74 12M40 40Q47 38 49 30M30 60Q47 55 57 34M42 84Q64 73 78 47" fill="none" stroke="currentColor" /></svg></div>
  </div>
}

function TheaterDetails() {
  return <div className="arra-scene__theater">
    <div className="arra-scene__curtain arra-scene__curtain--left" /><div className="arra-scene__curtain arra-scene__curtain--right" />
    <div className="arra-scene__stage-orbit" />
    <div className="arra-scene__cards">{Array.from({ length: 5 }, (_, index) => <span key={index} style={{ '--card': index } as CSSProperties}><svg viewBox="0 0 28 40"><rect x="1" y="1" width="26" height="38" rx="3" fill="#291c41" stroke="#d0a769" /><path d="m14 10 6 10-6 10-6-10Z" fill="none" stroke="#eacb84" /><circle cx="14" cy="20" r="2" fill="#eacb84" /></svg></span>)}</div>
  </div>
}
function SawBlade() {
  const id = useId()
  return (
    <svg viewBox="0 0 160 160" className="arra-blade" focusable="false">
      <defs>
        <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdfa" /><stop offset=".22" stopColor="#b8c9ce" /><stop offset=".45" stopColor="#f9ffff" /><stop offset=".65" stopColor="#8399a3" /><stop offset=".83" stopColor="#dce8eb" /><stop offset="1" stopColor="#647b85" />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx=".35" cy=".25" r=".8">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".4" stopColor="#dfe9eb" /><stop offset=".7" stopColor="#a6b9c0" /><stop offset="1" stopColor="#6c8995" />
        </radialGradient>
        <linearGradient id={`${id}-hub`} x1="0" y1="0" x2=".85" y2="1">
          <stop stopColor="#ffe7a3" /><stop offset=".5" stopColor="#f5b83d" /><stop offset="1" stopColor="#bb641e" />
        </linearGradient>
      </defs>
      <polygon points={teeth} fill="#506872" transform="translate(0 2)" />
      <polygon points={teeth} fill={`url(#${id}-steel)`} stroke="#eff8fa" strokeWidth=".7" strokeLinejoin="round" />
      <circle cx="80" cy="80" r="55" fill={`url(#${id}-face)`} stroke="#f8ffff" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="51" fill="none" stroke="#728d98" strokeWidth=".8" opacity=".7" />
      <circle cx="80" cy="80" r="47" fill="none" stroke="#f8ffff" strokeWidth=".8" opacity=".8" />
      <circle cx="80" cy="80" r="43" fill="none" stroke="#8fa5ae" strokeWidth=".6" opacity=".6" />
      {Array.from({ length: 6 }, (_, index) => <g key={index} transform={`rotate(${index * 60} 80 80)`}>
        <path d="M79 28c-3 4-3 9 0 13" fill="none" stroke="#708995" strokeWidth="2" strokeLinecap="round" />
        <circle cx="80" cy="48" r="3.2" fill="#607c89" stroke="#effaff" strokeWidth=".8" />
      </g>)}
      <path d="M33 68a49 49 0 0 1 60-35" fill="none" stroke="#fff" strokeWidth="3" opacity=".8" strokeLinecap="round" />
      <path d="M130 88a50 50 0 0 1-41 41" fill="none" stroke="#415f6e" strokeWidth="1.5" opacity=".45" strokeLinecap="round" />
      <circle cx="80" cy="81" r="21" fill="#405763" opacity=".3" />
      <circle cx="80" cy="80" r="19" fill={`url(#${id}-hub)`} stroke="#fff0bb" strokeWidth="1.4" />
      <circle cx="80" cy="80" r="12" fill="none" stroke="#c88221" strokeWidth="1" />
      <path d="m80 71 7.8 4.5v9L80 89l-7.8-4.5v-9Z" fill="#344e5b" stroke="#e2c083" strokeWidth="1" />
      <circle cx="80" cy="80" r="3.5" fill="#a0b4bb" />
    </svg>
  )
}

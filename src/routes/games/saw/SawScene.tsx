import { useId, type CSSProperties } from 'react'
import './scene.css'

type SawSceneProps = {
  blade: number
  phase: 'ready' | 'playing' | 'cut' | 'won'
  speaking?: boolean
  animated?: boolean
}

const teeth = Array.from({ length: 24 }, (_, index) => {
  const points = [[61, 0], [70, 4], [70, 9], [60, 13]]
  return points.map(([radius, offset]) => {
    const angle = (index * 15 + offset) * Math.PI / 180
    return `${80 + Math.cos(angle) * radius},${80 + Math.sin(angle) * radius}`
  }).join(' ')
}).join(' ')

export function SawScene({ blade, phase, speaking = false, animated = true }: SawSceneProps) {
  const position = Math.max(0, Math.min(100, blade))
  const danger = position > 68 && phase !== 'won'
  const travel = position / 100
  return (
    <div className="arra-scene" data-phase={phase} data-danger={danger} data-speaking={speaking} data-animated={animated} aria-hidden="true">
      <div className="arra-scene__camera">
        <div className="arra-scene__workshop" />
        <div className="arra-scene__lamp"><i /><b /></div>
        <div className="arra-scene__sunbeam" />
        <div className="arra-scene__pipe"><i /><i /><i /></div>
        <div className="arra-scene__gear arra-scene__gear--large"><Gear /></div>
        <div className="arra-scene__gear arra-scene__gear--small"><Gear /></div>
        <div className="arra-scene__steam"><i /><i /><i /></div>
        <div className="arra-scene__dust">
          {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--particle': index, left: `${7 + index * 13 % 87}%`, top: `${19 + index * 17 % 62}%` } as CSSProperties} />)}
        </div>
        <svg className="arra-scene__tracks" viewBox="0 0 1000 420" preserveAspectRatio="none" focusable="false">
          <path d="M198 201 359 420h414L400 201Z" fill="#111919" opacity=".62" />
          {Array.from({ length: 10 }, (_, index) => {
            const depth = (index / 9) ** 1.7
            const y = 211 + depth * 209
            return <path key={index} d={`M${215 + depth * 152} ${y}H${397 + depth * 349}`} stroke="#586461" strokeWidth={3 + depth * 7} />
          })}
          <path d="m224 202 180 218m173 0L370 202" stroke="#101919" strokeWidth="17" fill="none" />
          <path d="m224 202 180 218m173 0L370 202" stroke="#899c99" strokeWidth="8" fill="none" />
          <path d="m220 202 180 218m173 0L366 202" stroke="#e3e3c8" strokeOpacity=".8" strokeWidth="2" fill="none" />
          <path d="m238 202 182 218m174 0L384 202" stroke="#294244" strokeWidth="4" fill="none" />
        </svg>
        <div className="arra-scene__machine">
          <div className="arra-scene__machine-base"><i /><i /><i /><i /></div>
          <div className="arra-scene__blade-frame"><SawBlade /></div>
          <div className="arra-scene__machine-label"><i /><i /><i /></div>
          <div className="arra-scene__sparks">
            {Array.from({ length: 7 }, (_, index) => <i key={index} style={{ '--spark': index } as CSSProperties} />)}
          </div>
        </div>
        <div className="arra-scene__platform" style={{ left: `${49 - travel * 19}%`, bottom: `${5 + travel * 34}%`, '--platform-scale': 1 - travel * .4 } as CSSProperties}>
          <div className="arra-scene__platform-shadow" />
          <div className="arra-scene__platform-wheel arra-scene__platform-wheel--left" />
          <div className="arra-scene__platform-wheel arra-scene__platform-wheel--right" />
          <div className="arra-scene__platform-front"><i /><i /><i /><i /></div>
          <div className="arra-scene__platform-top">
            <span className="arra-scene__platform-mark"><i /><i /></span>
            <span className="arra-scene__platform-corner arra-scene__platform-corner--left" />
            <span className="arra-scene__platform-corner arra-scene__platform-corner--right" />
          </div>
          <div className="arra-scene__voice-rings"><i /><i /><i /></div>
        </div>
        <div className="arra-scene__foreman-plinth" />
        <div className="arra-scene__penguin">
          <span className="arra-scene__penguin-shadow" />
          <img src="/games/arra/penguin-foreman.webp" alt="" width="760" height="760" draggable={false} />
          <svg className="arra-scene__celebration arra-scene__celebration--one" viewBox="0 0 24 24"><path d="m12 1 2.7 7.9L23 12l-8.3 2.5L12 23l-2.7-8.5L1 12l8.3-3.1Z" /></svg>
          <svg className="arra-scene__celebration arra-scene__celebration--two" viewBox="0 0 24 24"><path d="m12 1 2.7 7.9L23 12l-8.3 2.5L12 23l-2.7-8.5L1 12l8.3-3.1Z" /></svg>
        </div>
      </div>
      <div className="arra-scene__vignette" />
      <div className="arra-scene__danger-light" />
      <div className="arra-scene__win-light" />
    </div>
  )
}

function Gear() {
  return <svg viewBox="0 0 100 100" focusable="false">
    {Array.from({ length: 12 }, (_, index) => <rect key={index} x="43" y="3" width="14" height="20" rx="2" transform={`rotate(${index * 30} 50 50)`} fill="#57615a" stroke="#838573" strokeWidth="1" />)}
    <circle cx="50" cy="50" r="35" fill="#343c37" stroke="#8d8e75" strokeWidth="3" />
    <circle cx="50" cy="50" r="24" fill="none" stroke="#181f1c" strokeWidth="13" />
    {Array.from({ length: 6 }, (_, index) => <rect key={index} x="45" y="20" width="10" height="30" transform={`rotate(${index * 60} 50 50)`} fill="#626c5f" />)}
    <circle cx="50" cy="50" r="11" fill="#1d2825" stroke="#a3a18a" strokeWidth="2" />
  </svg>
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

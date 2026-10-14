import { useId, useState } from 'react'
import type { GameCopy } from './copy'

export function ErrorHuntTreasure({ score, copy }: { score: number; copy: GameCopy }) {
  const [opened, setOpened] = useState(false)
  const id = useId()
  return <section className="eh-treasure" data-open={opened} aria-label={copy.treasure}>
    <div className="eh-treasure-stage">
      <button type="button" className="eh-treasure-trigger" aria-label={opened ? copy.chestOpened : copy.openChest} aria-expanded={opened} onClick={() => setOpened(true)}>
        <span className="eh-treasure-rays" aria-hidden="true" />
        <svg viewBox="0 0 240 200" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-gold`} x1="40" y1="60" x2="190" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#fff1a1" /><stop offset=".45" stopColor="#f8be40" /><stop offset="1" stopColor="#c97918" /></linearGradient>
            <linearGradient id={`${id}-wood`} x1="120" y1="76" x2="120" y2="177" gradientUnits="userSpaceOnUse"><stop stopColor="#a85e37" /><stop offset="1" stopColor="#572a32" /></linearGradient>
          </defs>
          <ellipse cx="120" cy="184" rx="88" ry="10" fill="#0c031e" opacity=".4" />
          <path d="M38 104h164v63a12 12 0 0 1-12 12H50a12 12 0 0 1-12-12z" fill={`url(#${id}-wood)`} stroke="#e9b34d" strokeWidth="3" />
          <path d="M48 133h144M48 156h144" stroke="#d18a43" strokeOpacity=".35" strokeWidth="2" />
          <path d="M55 107h16v69H55zm114 0h16v69h-16z" fill={`url(#${id}-gold)`} />
          <path d="M40 166h160v5a7 7 0 0 1-7 7H47a7 7 0 0 1-7-7z" fill={`url(#${id}-gold)`} />
          <ellipse className="eh-treasure-opening" cx="120" cy="105" rx="80" ry="12" fill="#fff0a6" />
          <g className="eh-treasure-lid">
            <path d="M36 105V83c0-24 22-40 48-40h72c26 0 48 16 48 40v22z" fill={`url(#${id}-wood)`} stroke="#e9b34d" strokeWidth="3" />
            <path d="M55 102V79c0-13 6-24 16-32l16-3C73 54 71 66 71 80v22zm114 0V80c0-14-2-26-16-36l16 3c10 8 16 19 16 32v23z" fill={`url(#${id}-gold)`} />
            <path d="M36 94h168v13H36z" fill={`url(#${id}-gold)`} />
            <path d="M89 56h62" stroke="#e7a65f" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" />
            <rect x="105" y="91" width="30" height="32" rx="7" fill={`url(#${id}-gold)`} stroke="#ffe59a" strokeWidth="2" />
            <path d="M124 103a4 4 0 1 0-8 0c0 1.5.8 2.8 2 3.5l-1 6h6l-1-6a4 4 0 0 0 2-3.5" fill="#663726" />
          </g>
          <g className="eh-treasure-sparkles" stroke="#ffe987" strokeWidth="2.5" strokeLinecap="round"><path d="M26 58v12m-6-6h12m177-30v16m-8-8h16M192 78v8m-4-4h8" /></g>
        </svg>
      </button>
      <div className="eh-treasure-result" role="status" aria-atomic="true">
        {opened && <><strong>{score}</strong><span>{copy.score}</span></>}
      </div>
    </div>
  </section>
}

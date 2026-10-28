import { useId, useState } from 'react'
import type { GamePrompt } from '../../../lib/speaking-games'
import './first-reaction-media.css'

const mediaRoot = '/games/first-reaction/media/'
const sceneNames = new Set([
  'elephant_in_room', 'cat_waking_up', 'talking_phone', 'candy_rain', 'invisible_person',
  'talking_cat', 'on_the_moon', 'flying_house', 'president', 'growing_wings',
  'frozen_time', 'animal_language', 'living_food', 'mind_reading', 'giant_person',
  'million_win', 'promotion', 'meeting_old_friend', 'dream_come_true', 'finding_treasure',
  'wedding_invitation', 'exam_success', 'friend_from_abroad', 'lottery_win', 'puppy_gift',
  'missed_plane', 'house_fire', 'lost_wallet', 'attacking_dog', 'lost_in_forest',
  'stolen_phone', 'falling_in_hole', 'earthquake', 'forgotten_password', 'overslept_work',
  'sneeze_cat', 'clown_boss', 'running_soup', 'missing_shadow', 'speaking_meow',
  'bed_boat', 'sleeping_office', 'singing_kettle', 'talking_puddle', 'running_socks',
  'time_machine', 'one_wish', 'one_day_invisible', 'all_languages', 'flying_person',
  'mind_reading_2', 'becoming_invisible', 'magic_wand', 'change_past', 'see_future',
  'job_interview', 'project_win', 'conference_speech', 'book_published', 'grant_received',
])

function allowedScene(prompt: GamePrompt) {
  for (const candidate of [prompt.mediaUrl, prompt.scene]) {
    if (!candidate) continue
    const basename = candidate.startsWith(mediaRoot) ? candidate.slice(mediaRoot.length) : candidate
    if (!/^[a-z0-9_]+\.gif$/.test(basename)) continue
    const name = basename.slice(0, -4)
    if (sceneNames.has(name)) return name
  }
  return null
}

function MediaFallback({ prompt }: { prompt: GamePrompt }) {
  const gradientId = useId()
  const scene = prompt.scene ?? prompt.id
  const variant = /phone|password/.test(scene) ? 'phone'
    : /cat|dog|puppy|animal/.test(scene) ? 'animal'
      : /win|promotion|grant|treasure|success/.test(scene) ? 'award'
        : /moon|flying|wings|sky/.test(scene) ? 'sky'
          : /forest/.test(scene) ? 'forest' : 'conversation'
  return <svg className="first-reaction-media__fallback" viewBox="0 0 640 360" role="img" aria-label={prompt.textRu}>
    <defs><linearGradient id={gradientId} x2="1" y2="1"><stop stopColor="#7560bf" /><stop offset="1" stopColor="#30295e" /></linearGradient></defs>
    <rect width="640" height="360" fill={`url(#${gradientId})`} />
    <ellipse cx="320" cy="306" rx="177" ry="21" fill="#20194b" opacity=".4" />
    {variant === 'phone' ? <g>
      <rect x="254" y="80" width="131" height="214" rx="26" fill="#2e275d" />
      <rect x="264" y="91" width="111" height="190" rx="17" fill="#9ac4fa" />
      <path d="M294 95h51" stroke="#2e275d" strokeWidth="10" strokeLinecap="round" />
      <circle cx="299" cy="182" r="6" fill="#504473" /><circle cx="341" cy="182" r="6" fill="#504473" />
      <path d="M303 212q17 17 34 0" fill="none" stroke="#504473" strokeWidth="6" strokeLinecap="round" />
    </g> : variant === 'animal' ? <g>
      <ellipse cx="320" cy="250" rx="59" ry="50" fill="#efbb84" />
      <path d="M248 171l6-74 52 48m85 26-7-74-52 48" fill="#f6c895" />
      <ellipse cx="320" cy="181" rx="77" ry="62" fill="#f6c895" />
      <circle cx="292" cy="177" r="7" fill="#504473" /><circle cx="348" cy="177" r="7" fill="#504473" />
      <path d="M311 195h18l-9 11z" fill="#b85c8b" />
      <path d="M260 199l-40-9m40 25-40 8m160-24 40-9m-40 25 40 8" stroke="#e7daf7" strokeWidth="4" strokeLinecap="round" />
    </g> : variant === 'award' ? <g>
      <path d="M255 111h130v53q-2 72-65 76-63-4-65-76z" fill="#f9d28c" />
      <path d="M256 127q-85-14-44 65l49 18m123-83q85-14 44 65l-49 18" fill="none" stroke="#f6c17d" strokeWidth="15" />
      <path d="M320 233v50m-45 7h90" stroke="#f9d28c" strokeWidth="16" strokeLinecap="round" />
      <path d="m320 139 10 21 24 4-17 17 4 24-21-11-21 11 4-24-17-17 24-4z" fill="#fff1c7" />
    </g> : variant === 'sky' ? <g>
      <circle cx="320" cy="183" r="89" fill="#d1c8f2" />
      <ellipse cx="289" cy="157" rx="24" ry="15" fill="#aaa1d5" /><ellipse cx="351" cy="215" rx="30" ry="18" fill="#aaa1d5" />
      <path d="m174 132 7 17 18 5-18 7-7 17-6-17-18-7 18-5zm295 65 7 17 18 5-18 7-7 17-6-17-18-7 18-5z" fill="#ffe8a6" />
    </g> : variant === 'forest' ? <g>
      {[207, 320, 433].map((x, index) => <g key={x} transform={`translate(${x} ${index === 1 ? 0 : 26})`}>
        <path d="M0 103l65 96H40l43 62H-83l43-62h-25z" fill={index === 1 ? '#a4e9d4' : '#75bfba'} />
        <path d="M0 229v61" stroke="#c7b0dc" strokeWidth="14" />
      </g>)}
    </g> : <g>
      <path d="M200 107h240a23 23 0 0 1 23 23v91a23 23 0 0 1-23 23H318l-66 46 17-46h-69a23 23 0 0 1-23-23v-91a23 23 0 0 1 23-23" fill="#d4d4fc" />
      {[267, 320, 373].map((x) => <circle key={x} cx={x} cy="178" r="12" fill="#8b76c7" />)}
    </g>}
  </svg>
}

function SceneImage({ prompt, scene, compact }: { prompt: GamePrompt; scene: string | null; compact: boolean }) {
  const [failed, setFailed] = useState<'none' | 'animation' | 'poster'>('none')
  if (!scene || failed === 'poster') return <MediaFallback prompt={prompt} />
  const poster = `${mediaRoot}${scene}.svg`
  return <picture>
    {failed === 'none' && <source media="(prefers-reduced-motion: reduce)" srcSet={poster} />}
    <img
      src={failed === 'animation' ? poster : `${mediaRoot}${scene}.gif`}
      width="640"
      height="360"
      alt={prompt.textRu}
      loading="eager"
      decoding="async"
      fetchPriority={compact ? 'low' : 'high'}
      onError={(event) => setFailed(failed === 'animation' || event.currentTarget.currentSrc.endsWith('.svg') ? 'poster' : 'animation')}
    />
  </picture>
}

export function FirstReactionMedia({ prompt, compact = false }: { prompt: GamePrompt; compact?: boolean }) {
  const scene = allowedScene(prompt)
  return <div className={`first-reaction-media${compact ? ' first-reaction-media--compact' : ''}`}>
    <SceneImage key={`${prompt.id}:${scene}`} prompt={prompt} scene={scene} compact={compact} />
  </div>
}

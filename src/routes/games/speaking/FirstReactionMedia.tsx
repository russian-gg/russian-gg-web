import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { GamePrompt } from '../../../lib/speaking-games'
import './first-reaction-media.css'

const mediaRoot = '/games/first-reaction/media-v2/'
const legacyRoot = '/games/first-reaction/media/'
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
    const root = [mediaRoot, legacyRoot].find((value) => candidate.startsWith(value))
    const basename = root ? candidate.slice(root.length) : candidate
    if (!/^[a-z0-9_]+\.gif$/.test(basename)) continue
    const name = basename.slice(0, -4)
    if (sceneNames.has(name)) return name
  }
  return null
}

function MediaFallback({ prompt }: { prompt: GamePrompt }) {
  return <div className="first-reaction-media__fallback" role="img" aria-label={prompt.textRu}>
    <ImageOff size={42} strokeWidth={1.25} aria-hidden="true" />
  </div>
}

function SceneImage({ prompt, scene }: { prompt: GamePrompt; scene: string | null }) {
  const [failed, setFailed] = useState<'none' | 'animation' | 'poster'>('none')
  if (!scene || failed === 'poster') return <MediaFallback prompt={prompt} />
  const poster = `${mediaRoot}${scene}.webp`
  return <picture>
    {failed === 'none' && <source media="(prefers-reduced-motion: reduce)" srcSet={poster} />}
    <img
      src={failed === 'animation' ? poster : `${mediaRoot}${scene}.anim.webp`}
      width="640"
      height="360"
      alt={prompt.textRu}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      onError={(event) => setFailed(failed === 'animation' || event.currentTarget.currentSrc === new URL(poster, window.location.href).href ? 'poster' : 'animation')}
    />
  </picture>
}

export function FirstReactionMedia({ prompt, compact = false }: { prompt: GamePrompt; compact?: boolean }) {
  const scene = allowedScene(prompt)
  return <div className={`first-reaction-media${compact ? ' first-reaction-media--compact' : ''}`}>
    <SceneImage key={`${prompt.id}:${scene}`} prompt={prompt} scene={scene} />
  </div>
}

import { useEffect, useRef, type CSSProperties } from 'react'
import { sawFaces, sawSpriteSize, type SawFacePatch, type SawPose } from './face-rig'
import type { SawCharacter } from './model'

const spriteSize = sawSpriteSize

function patchStyle([left, top, width, height]: SawFacePatch): CSSProperties {
  return {
    left: `${left / spriteSize * 100}%`,
    top: `${top / spriteSize * 100}%`,
    width: `${width / spriteSize * 100}%`,
    height: `${height / spriteSize * 100}%`,
    backgroundSize: `${spriteSize / width * 100}% ${spriteSize / height * 100}%`,
    backgroundPosition: `${left / (spriteSize - width) * 100}% ${top / (spriteSize - height) * 100}%`,
  }
}

const between = (from: number, to: number) => from + Math.random() * (to - from)

/*
  The face never loops: every beat picks a new glance, brow shape and eye opening, so the
  expression changes about once a second when calm and several times a second when the saw is close.
  `fear` is 0..1 and biases the glance toward the blade, widens the eyes and lifts the brows.
*/
export function SawFace({ character, pose, fear = 0, animated = true }: { character: SawCharacter; pose: SawPose; fear?: number; animated?: boolean }) {
  const { eyes, brows, mouth, lid } = sawFaces[character][pose]
  const node = useRef<HTMLDivElement>(null)
  const dread = useRef(fear)
  useEffect(() => { dread.current = fear }, [fear])
  useEffect(() => {
    const face = node.current
    if (!face || !animated || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    // The panda stays composed; the feather overacts.
    const gain = character === 'panda' ? .55 : character === 'pero' ? 1.15 : 1
    let beatTimer = 0
    let blinkTimer = 0
    let openTimer = 0
    const beat = () => {
      const level = Math.min(1, dread.current * gain)
      const watchesBlade = Math.random() < .2 + level * .6
      face.style.setProperty('--gaze-x', `${watchesBlade ? between(-11, -6) - level * 3 : between(-4, 5)}%`)
      face.style.setProperty('--gaze-y', `${watchesBlade ? between(1, 6) : between(-4, 3)}%`)
      face.style.setProperty('--eye-open', `${1 + level * .17 + between(-.03, .05)}`)
      face.style.setProperty('--brow-y', `${between(-7, 5) - level * 16}%`)
      face.style.setProperty('--brow-tilt', `${between(-5, 5) + level * 10}deg`)
      face.style.setProperty('--brow-odd', `${between(-5, 5)}deg`)
      beatTimer = window.setTimeout(beat, between(480, 1050) * (1 - level * .62))
    }
    const blink = () => {
      const level = Math.min(1, dread.current * gain)
      face.dataset.blink = 'true'
      openTimer = window.setTimeout(() => { delete face.dataset.blink }, 95)
      // A nervous double blink now and then.
      blinkTimer = window.setTimeout(blink, Math.random() < .18 + level * .3 ? 230 : between(1500, 3900) * (1 - level * .5))
    }
    beat()
    blinkTimer = window.setTimeout(blink, between(600, 1800))
    return () => {
      window.clearTimeout(beatTimer)
      window.clearTimeout(blinkTimer)
      window.clearTimeout(openTimer)
      delete face.dataset.blink
    }
  }, [character, pose, animated])
  return <div className="arra-scene__face" ref={node} style={{ '--lid-color': lid } as CSSProperties}>
    {eyes.map((eye, index) => <span className="arra-scene__eye" key={index} style={patchStyle(eye)}><i /></span>)}
    {brows.map((brow, index) => <span className="arra-scene__brow" key={index} style={{ ...patchStyle(brow), '--side': index === 0 ? -1 : 1 } as CSSProperties} />)}
    <span className="arra-scene__mouth" style={patchStyle(mouth)} />
  </div>
}

import { useEffect, useRef } from 'react'
import { sawFaces, sawSpriteSize, type SawFacePatch, type SawPose } from './face-rig'
import type { SawCharacter, SawPhase } from './model'

/*
  The hero is a flat portrait, so moving the picture as a whole reads as a sticker sliding around.
  Here the portrait is drawn on a mesh instead: feet stay planted while the spine bends, the chest
  breathes, the head turns on its own neck, and the crest (bow, plume) trails behind. Eyes, brows
  and mouth are warped inside the texture, so they blink, glance and talk without seams.
*/

type Props = {
  character: SawCharacter
  pose: SawPose
  portrait: (pose: SawPose) => string
  fear: number
  fearLevel: number
  talking: boolean
  listening: boolean
  voice: number
  phase: SawPhase
  animated: boolean
  onUnavailable: () => void
}

const POSES: SawPose[] = ['idle', 'confident', 'danger']
const GRID = 30
const SPREAD = 1.4

// How much each hero shows: the panda stays composed, the feather overacts and hovers.
const temper = {
  penguin: { gain: 1, hover: 0, crest: 0 },
  panda: { gain: .55, hover: 0, crest: .21 },
  pero: { gain: 1.2, hover: .012, crest: .3 },
} satisfies Record<SawCharacter, { gain: number; hover: number; crest: number }>

const VERTEX = `
attribute vec2 aPos;
uniform float uT, uFear, uJoy, uImpact, uKick, uHover, uNeck, uCrest, uTalk, uTurn, uNod;
uniform vec2 uHead;
varying vec2 vUv;
void main() {
  vec2 p = aPos;
  vUv = p;
  float feet = .955;
  float h = clamp((feet - p.y) / feet, 0., 1.);
  float upper = smoothstep(.74, .3, p.y);
  float head = smoothstep(uNeck + .05, uNeck - .07, p.y);
  float crest = uCrest > 0. ? smoothstep(uCrest, uCrest - .17, p.y) : 0.;
  float chest = smoothstep(.8, .62, p.y) * smoothstep(uNeck - .12, uNeck + .08, p.y);
  vec2 q = p;

  float breath = sin(uT * (2.2 + uFear * 6.));
  q.x += (p.x - uHead.x) * breath * (.024 + uFear * .014) * chest;
  q.y -= (breath * .5 + .5) * (.013 + uFear * .009) * upper;

  float sway = sin(uT * 1.15) * .015 + sin(uT * .63 + 1.7) * .009;
  q.x += sway * h * h * (1. - uFear * .7);
  q.y += sin(uT * 2.1) * uHover;

  q.x += uFear * .08 * h * h;
  q.y += uFear * .05 * upper;
  q.x += uFear * uFear * .0085 * sin(uT * 61. + p.y * 26.) * (.3 + h);
  q.y += uFear * uFear * .0035 * sin(uT * 47. + p.x * 31.) * upper;

  vec2 pivot = vec2(uHead.x, uNeck);
  float angle = (uTurn + sin(uT * 1.9) * .022 + uFear * sin(uT * 9.3) * .035 + uTalk * sin(uT * 7.1) * .03) * head;
  vec2 d = q - pivot;
  q = pivot + vec2(cos(angle) * d.x - sin(angle) * d.y, sin(angle) * d.x + cos(angle) * d.y);
  q.y += (uNod + uTalk * sin(uT * 10.7) * .008) * head;
  q.x += crest * (sin(uT * 2.6 - 1.1) * .024 + uFear * sin(uT * 23.) * .014 - uTurn * .3);

  float hop = abs(sin(uT * 5.4)) * uJoy;
  float stretch = uKick * .17 + hop * .07;
  q.y = feet + (q.y - feet) * (1. + stretch);
  q.x = .5 + (q.x - .5) * (1. - stretch * .55);
  q.y -= hop * .05;

  float thrown = uImpact * h;
  q.x += uImpact * .03 + thrown * thrown * .16;
  q.y += thrown * .05;

  gl_Position = vec4((q - .5) / ${SPREAD.toFixed(1)} * vec2(2., -2.), 0., 1.);
}`

const FRAGMENT = `
precision mediump float;
uniform sampler2D uTex;
uniform vec4 uEye[2];
uniform vec4 uBrow[2];
uniform vec4 uMouth;
uniform float uEyes, uWide, uBlink, uLift, uTilt, uOdd, uOpen, uPale;
uniform vec2 uGaze;
uniform vec3 uLid;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float lid = 0.;
  float lash = 0.;
  for (int i = 0; i < 2; i++) {
    if (float(i) < uEyes) {
      vec4 r = uEye[i];
      vec2 d = (vUv - r.xy) / r.zw;
      float m = 1. - smoothstep(.5, 1.2, length(d));
      uv = r.xy + (uv - r.xy) / (1. + uWide * m);
      uv -= uGaze * r.zw * m;
      float inside = 1. - smoothstep(.86, 1.02, length(d));
      float edge = -1.15 + 2.4 * uBlink;
      lid += inside * (1. - smoothstep(edge - .1, edge + .04, d.y));
      lash += inside * smoothstep(edge - .32, edge - .04, d.y) * (1. - smoothstep(edge - .04, edge + .04, d.y));
    }
    vec4 b = uBrow[i];
    vec2 e = (vUv - b.xy) / b.zw;
    float side = i == 0 ? -1. : 1.;
    float w = 1. - smoothstep(.55, 1.45, length(e));
    uv.y += (uLift + side * (uTilt * e.x + uOdd)) * b.w * w;
  }
  vec2 g = (vUv - uMouth.xy) / uMouth.zw;
  float k = 1. - smoothstep(.6, 1.4, length(g));
  uv.y = uMouth.y + (uv.y - uMouth.y) / (1. + uOpen * k);
  uv.x = uMouth.x + (uv.x - uMouth.x) / (1. - uOpen * .22 * k);
  vec4 color = texture2D(uTex, uv);
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) color = vec4(0.);
  lid = clamp(lid, 0., 1.) * step(.01, uBlink);
  color.rgb = mix(color.rgb, uLid * (1. - lash * .45) * color.a, lid);
  float grey = dot(color.rgb, vec3(.3, .59, .11));
  color.rgb = mix(color.rgb, vec3(grey) * 1.06, uPale * .22);
  gl_FragColor = color;
}`

const UNIFORMS = ['uT', 'uFear', 'uJoy', 'uImpact', 'uKick', 'uHover', 'uNeck', 'uCrest', 'uTalk', 'uTurn', 'uNod', 'uHead',
  'uTex', 'uEye', 'uBrow', 'uMouth', 'uEyes', 'uWide', 'uBlink', 'uLift', 'uTilt', 'uOdd', 'uOpen', 'uPale', 'uGaze', 'uLid'] as const

function box([left, top, width, height]: SawFacePatch) {
  return [(left + width / 2) / sawSpriteSize, (top + height / 2) / sawSpriteSize, width / 2 / sawSpriteSize, height / 2 / sawSpriteSize]
}

function rig(character: SawCharacter, pose: SawPose) {
  const face = sawFaces[character][pose]
  const mouth = box(face.mouth)
  const parts = [...face.brows.map(box), mouth]
  const lid = [1, 3, 5].map((at) => parseInt(face.lid.slice(at, at + 2), 16) / 255)
  const eyes = face.eyes.map(box)
  const brows = face.brows.map(box)
  return {
    eyes: new Float32Array([...(eyes[0] ?? [0, 0, 1, 1]), ...(eyes[1] ?? [0, 0, 1, 1])]),
    eyeCount: eyes.length,
    brows: new Float32Array([...(brows[0] ?? [-9, -9, 1, 1]), ...(brows[1] ?? [-9, -9, 1, 1])]),
    mouth,
    lid,
    head: [parts.reduce((sum, part) => sum + part[0], 0) / parts.length, parts.reduce((sum, part) => sum + part[1], 0) / parts.length],
    neck: mouth[1] + mouth[3] + .045,
  }
}

const between = (from: number, to: number) => from + Math.random() * (to - from)

export function SawPuppet(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef(props)
  useEffect(() => { live.current = props })
  const { character, portrait, onUnavailable } = props

  useEffect(() => {
    const node = canvas.current
    if (!node) return
    const gl = node.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
    if (!gl) { onUnavailable(); return }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
    }
    const vertex = compile(gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) { onUnavailable(); return }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { onUnavailable(); return }
    gl.useProgram(program)
    const at = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])) as Record<typeof UNIFORMS[number], WebGLUniformLocation | null>

    const points: number[] = []
    const cells: number[] = []
    for (let row = 0; row <= GRID; row++) for (let column = 0; column <= GRID; column++) points.push(column / GRID, row / GRID)
    for (let row = 0; row < GRID; row++) for (let column = 0; column < GRID; column++) {
      const corner = row * (GRID + 1) + column
      cells.push(corner, corner + 1, corner + GRID + 1, corner + 1, corner + GRID + 2, corner + GRID + 1)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cells), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

    let closed = false
    const textures = new Map<SawPose, WebGLTexture>()
    POSES.forEach((pose) => {
      const image = new Image()
      image.onload = () => {
        if (closed) return
        const texture = gl.createTexture()
        if (!texture) return
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        textures.set(pose, texture)
        node.dataset.ready = 'true'
      }
      image.onerror = () => { if (!closed && pose === live.current.pose) onUnavailable() }
      image.src = portrait(pose)
    })

    const resize = () => {
      const scale = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(2, Math.round(node.clientWidth * scale))
      const height = Math.max(2, Math.round(node.clientHeight * scale))
      if (node.width !== width || node.height !== height) { node.width = width; node.height = height }
      gl.viewport(0, 0, node.width, node.height)
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    observer?.observe(node)
    resize()

    const mood = temper[character]
    const rigs = Object.fromEntries(POSES.map((pose) => [pose, rig(character, pose)])) as Record<SawPose, ReturnType<typeof rig>>
    // Smoothed values: the face eases between glances instead of snapping.
    const now = { fear: 0, joy: 0, impact: 0, kick: 0, talk: 0, turn: 0, nod: 0, gazeX: 0, gazeY: 0, wide: 0, lift: 0, tilt: 0, odd: 0, open: 0, blink: 0 }
    const goal = { turn: 0, nod: 0, gazeX: 0, gazeY: 0, wide: 0, lift: 0, tilt: 0, odd: 0 }
    let nextBeat = 0
    let nextBlink = 1.2
    let blinkStart = -9
    let syllable = 0
    let nextSyllable = 0
    let lastLevel = live.current.fearLevel
    let lastPose = live.current.pose
    let clock = 0
    let previous = performance.now()
    let frame = 0
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw)
      const state = live.current
      const texture = textures.get(state.pose) ?? textures.get(lastPose)
      if (!texture) return
      const moving = state.animated && !still && state.phase !== 'cut'
      const dt = moving ? Math.min(.05, (time - previous) / 1000) : 0
      previous = time
      clock += dt
      const ease = (speed: number) => 1 - Math.exp(-dt * speed)
      const dread = Math.min(1, state.fear * mood.gain)

      if (state.fearLevel > lastLevel) now.kick = Math.min(1, .45 + state.fearLevel * .2) * (character === 'panda' ? .5 : 1)
      if (state.pose !== lastPose && textures.has(state.pose)) now.kick = Math.max(now.kick, .32)
      lastLevel = state.fearLevel
      if (textures.has(state.pose)) lastPose = state.pose

      if (clock >= nextBeat) {
        const watchesBlade = Math.random() < .2 + dread * .6
        goal.gazeX = watchesBlade ? between(-.34, -.2) : between(-.14, .16)
        goal.gazeY = watchesBlade ? between(.04, .2) : between(-.12, .1)
        goal.turn = watchesBlade ? between(-.07, -.03) : between(-.035, .05) + dread * .05
        goal.nod = between(-.006, .008)
        goal.wide = dread * .2 + between(-.03, .05)
        goal.lift = dread * .5 + between(-.2, .22)
        goal.tilt = dread * .45 + between(-.18, .18)
        goal.odd = between(-.16, .16)
        nextBeat = clock + between(.48, 1.05) * (1 - dread * .62)
      }
      if (clock >= nextBlink) {
        blinkStart = clock
        nextBlink = clock + (Math.random() < .18 + dread * .3 ? .26 : between(1.5, 3.9) * (1 - dread * .5))
      }
      const blinkAge = (clock - blinkStart) / .17
      now.blink = blinkAge >= 0 && blinkAge <= 1 ? Math.sin(blinkAge * Math.PI) ** .6 : 0

      // Speech: a new mouth shape per syllable, so talking does not look like a metronome.
      if (state.talking && clock >= nextSyllable) {
        syllable = Math.random() < .14 ? 0 : between(.25, 1)
        nextSyllable = clock + between(.07, .15)
      }
      const mouthGoal = state.talking ? syllable * .85
        : state.phase === 'impact' ? 1.1
          : state.listening ? .1 + state.voice * .12
            : dread > .5 ? (dread - .5) * (.5 + .5 * Math.sin(clock * 38)) : 0

      now.fear += (dread - now.fear) * ease(5)
      now.joy += ((state.phase === 'won' ? 1 : 0) - now.joy) * ease(6)
      now.impact += ((state.phase === 'impact' ? 1 : 0) - now.impact) * ease(state.phase === 'impact' ? 16 : 5)
      now.talk += ((state.talking ? 1 : 0) - now.talk) * ease(9)
      now.kick += (0 - now.kick) * ease(7)
      now.open += (mouthGoal - now.open) * ease(28)
      for (const key of ['turn', 'nod', 'gazeX', 'gazeY', 'wide', 'lift', 'tilt', 'odd'] as const) now[key] += (goal[key] - now[key]) * ease(key === 'turn' || key === 'nod' ? 7 : 20)
      // A startle is a quick stretch followed by a squash.
      const kick = now.kick * Math.cos((1 - now.kick) * 7)

      const pose = rigs[lastPose]
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(at.uTex, 0)
      gl.uniform1f(at.uT, clock)
      gl.uniform1f(at.uFear, now.fear)
      gl.uniform1f(at.uJoy, now.joy)
      gl.uniform1f(at.uImpact, now.impact)
      gl.uniform1f(at.uKick, kick)
      gl.uniform1f(at.uHover, mood.hover)
      gl.uniform1f(at.uNeck, pose.neck)
      gl.uniform1f(at.uCrest, mood.crest)
      gl.uniform1f(at.uTalk, now.talk)
      gl.uniform1f(at.uTurn, now.turn)
      gl.uniform1f(at.uNod, now.nod)
      gl.uniform2f(at.uHead, pose.head[0], pose.head[1])
      gl.uniform4fv(at.uEye, pose.eyes)
      gl.uniform4fv(at.uBrow, pose.brows)
      gl.uniform4f(at.uMouth, pose.mouth[0], pose.mouth[1], pose.mouth[2], pose.mouth[3])
      gl.uniform1f(at.uEyes, pose.eyeCount)
      gl.uniform1f(at.uWide, now.wide)
      gl.uniform1f(at.uBlink, now.blink)
      gl.uniform1f(at.uLift, now.lift)
      gl.uniform1f(at.uTilt, now.tilt)
      gl.uniform1f(at.uOdd, now.odd)
      gl.uniform1f(at.uOpen, now.open)
      gl.uniform1f(at.uPale, now.fear * now.fear)
      gl.uniform2f(at.uGaze, now.gazeX, now.gazeY)
      gl.uniform3f(at.uLid, pose.lid[0], pose.lid[1], pose.lid[2])
      gl.drawElements(gl.TRIANGLES, cells.length, gl.UNSIGNED_SHORT, 0)
    }
    frame = requestAnimationFrame(draw)

    const lost = (event: Event) => { event.preventDefault(); onUnavailable() }
    node.addEventListener('webglcontextlost', lost)
    return () => {
      closed = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      node.removeEventListener('webglcontextlost', lost)
      textures.forEach((texture) => gl.deleteTexture(texture))
      gl.deleteProgram(program)
    }
  }, [character, portrait, onUnavailable])

  return <canvas ref={canvas} className="arra-scene__puppet" />
}

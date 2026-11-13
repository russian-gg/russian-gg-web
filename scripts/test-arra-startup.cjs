const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../src/routes/games')
const compiled = new Map(['SawGame.tsx', 'saw/audio.ts', 'saw/dialogue.ts', 'saw/engine.ts', 'saw/input.ts', 'saw/model.ts'].map(file => {
  const result = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  })
  const errors = (result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'))
  return [file, result.outputText]
}))

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function harness(t, replies, { playback, recognition = true, level = 0, audioFailure } = {}) {
  const hooks = [], effects = [], requests = [], audioRequests = [], speeches = [], navigations = []
  const timers = new Map(), listeners = new Map()
  const resources = { contexts: 0, closedContexts: 0, stoppedTracks: 0, playedVoices: 0, lateStateUpdates: 0 }
  let cursor = 0, dirty = false, mounted = true, view, now = 0, timerId = 0
  const same = (left, right) => left && right && left.length === right.length && left.every((item, index) => Object.is(item, right[index]))
  const react = {
    useState(initial) {
      const index = cursor++
      hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [hooks[index].value, value => {
        if (!mounted) { resources.lateStateUpdates++; return }
        hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value
        dirty = true
      }]
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial } },
    useCallback(callback, dependencies) {
      const index = cursor++
      if (!same(hooks[index]?.dependencies, dependencies)) hooks[index] = { value: callback, dependencies }
      return hooks[index].value
    },
    useEffect(effect, dependencies) {
      const index = cursor++
      if (!same(hooks[index]?.dependencies, dependencies)) effects.push(() => {
        hooks[index]?.cleanup?.()
        hooks[index] = { dependencies, cleanup: effect() }
      })
    },
  }
  const schedule = (callback, delay, interval = false) => {
    const id = ++timerId
    timers.set(id, { callback, at: now + delay, interval: interval ? delay : 0 })
    return id
  }
  const window = {
    SpeechRecognition: class {},
    setTimeout: (callback, delay) => schedule(callback, delay),
    clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => schedule(callback, delay, true),
    clearInterval: id => timers.delete(id),
  }
  const document = {
    hidden: false,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) },
  }
  class AudioNode {
    gain = { value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    frequency = { ...this.gain }
    Q = { value: 0 }
    connect(target) { return target }
    disconnect() {}
    start() {}
    stop() {}
  }
  class AudioContext {
    destination = new AudioNode()
    currentTime = 0
    sampleRate = 44100
    generatedBuffers = new WeakSet()
    constructor() { resources.contexts++ }
    createOscillator() { return new AudioNode() }
    createBiquadFilter() { return new AudioNode() }
    createGain() { return new AudioNode() }
    createAnalyser() { return Object.assign(new AudioNode(), { getByteTimeDomainData: samples => samples.fill(128 + level) }) }
    createMediaStreamSource() { return new AudioNode() }
    createBuffer(channels, length, sampleRate) {
      const samples = Array.from({ length: channels }, () => new Float32Array(length))
      const buffer = { duration: length / sampleRate, getChannelData: channel => samples[channel] }
      this.generatedBuffers.add(buffer)
      return buffer
    }
    createBufferSource() {
      const source = new AudioNode()
      source.playbackRate = { value: 1 }
      source.start = () => {
        if (this.generatedBuffers.has(source.buffer)) {
          if (!source.loop) queueMicrotask(() => source.onended?.())
          return
        }
        resources.playedVoices++
        void Promise.resolve(playback).then(() => source.onended?.())
      }
      return source
    }
    decodeAudioData() { return Promise.resolve({ duration: 0 }) }
    resume() { return Promise.resolve() }
    close() { resources.closedContexts++; return Promise.resolve() }
  }
  class Speech {
    supported = recognition
    starts = 0
    aborts = 0
    active = false
    text = ''
    constructor(onText, onStatus) { this.onText = onText; this.onStatus = onStatus; speeches.push(this) }
    async start() { this.starts++; this.active = true; this.text = ''; this.onText(''); this.onStatus('listening') }
    async finish() { this.active = false; return this.text }
    abort() { this.aborts++; this.active = false; this.onStatus('idle') }
    emit(text) { assert.equal(this.active, true); this.text = text; this.onText(text) }
  }
  class RequestError extends Error {}
  const api = {
    async post(url, body) {
      requests.push({ url, body: structuredClone(body) })
      assert.ok(replies.length > 0, 'each dialogue request needs an explicit reply')
      const reply = replies.shift()
      if (reply instanceof Error) throw reply
      return reply
    },
    async postBlob(url, body) {
      audioRequests.push({ url, body: structuredClone(body) })
      if (audioFailure) throw audioFailure
      return { arrayBuffer: async () => new ArrayBuffer(1) }
    },
  }
  const globals = { window, document, AudioContext, AbortController, Uint8Array, performance: { now: () => now }, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() { resources.stoppedTracks++ } }] }) } } }
  const load = (file, dependencies = {}) => {
    const exports = {}
    vm.runInNewContext(compiled.get(file), { exports, require: name => {
      assert.ok(name in dependencies, `unexpected dependency: ${name}`)
      return dependencies[name]
    }, ...globals }, { filename: file })
    return exports
  }
  const dialogue = load('saw/dialogue.ts', { '../../../lib/api': { api, RequestError } })
  const { SawGame } = load('SawGame.tsx', {
    react,
    'react/jsx-runtime': { jsx: (_type, props) => props },
    'react-router-dom': { useNavigate: () => route => navigations.push(route) },
    './saw/SawGameView': { SawGameView() {} },
    './saw/audio': load('saw/audio.ts', { '../../../lib/api': { api }, './dialogue': dialogue }),
    './saw/input': load('saw/input.ts', { '../../../lib/game-speech': { GameSpeech: Speech } }),
    './saw/dialogue': dialogue,
    './saw/engine': load('saw/engine.ts'),
    './saw/model': load('saw/model.ts'),
  })
  function render() {
    cursor = 0; dirty = false
    view = SawGame()
    for (const effect of effects.splice(0)) effect()
  }
  async function flush() {
    for (let index = 0; index < 30; index++) {
      await Promise.resolve()
      if (mounted && dirty) render()
    }
  }
  async function advance(milliseconds) {
    const end = now + milliseconds
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      const [id, timer] = next
      now = timer.at
      if (timer.interval) timer.at += timer.interval
      else timers.delete(id)
      timer.callback()
      await flush()
    }
    now = end
    await flush()
  }
  function unmount() {
    if (!mounted) return
    mounted = false
    for (const hook of hooks) hook.cleanup?.()
  }
  render()
  t.after(unmount)
  return { get view() { return view }, requests, audioRequests, speeches, resources, navigations, timers, flush, advance, unmount,
    async start() { view.onStart(); await flush() } }
}

const opening = 'Расскажи о своём обычном дне.'
const followup = 'Что ты любишь делать вечером?'
const reply = (characterReply, isFallback) => ({ characterReply, animation: 'happy', threatChange: 0, isFallback })

test('a prepared opening remains playable when Gemini voice is unavailable', async t => {
  const h = harness(t, [reply(opening, true)], { audioFailure: new Error('voice_billing_unavailable') })
  await h.start()
  assert.equal(h.view.phase, 'playing')
  assert.equal(h.view.secondsLeft, 60)
  assert.equal(h.view.question, opening)
  assert.equal(h.view.error, '')
  assert.match(h.view.notice, /готовые вопросы/iu)
  assert.match(h.view.notice, /(?:озвучка|голос).*недоступ/iu)
  assert.equal(h.speeches[0].starts, 1)
  assert.equal(h.speeches[0].active, true)
  assert.equal(h.audioRequests.length, 1)
  assert.equal(h.audioRequests[0].url, '/missions/voice/prompt-audio')
  assert.equal(h.audioRequests[0].body.text, opening)
  assert.equal(h.resources.playedVoices, 0)
  assert.equal(h.requests[0].body.event, 'opening')
  assert.equal(h.requests[0].body.text, '')
  await h.advance(1100)
  assert.equal(h.view.phase, 'playing')
  assert.equal(h.view.secondsLeft, 59)
  assert.ok(h.view.blade > 0)
})

test('normal AI opening requests and plays TTS before listening without a fallback notice', async t => {
  const playback = deferred()
  const h = harness(t, [reply(opening, false)], { playback: playback.promise })
  await h.start()
  assert.equal(h.view.phase, 'starting')
  assert.equal(h.view.notice, '')
  assert.equal(h.view.error, '')
  assert.equal(h.audioRequests.length, 1)
  assert.equal(h.audioRequests[0].url, '/missions/voice/prompt-audio')
  assert.equal(h.audioRequests[0].body.text, opening)
  assert.equal(h.resources.playedVoices, 1)
  assert.equal(h.speeches[0].starts, 0)
  assert.equal(h.speeches[0].active, false)
  playback.resolve()
  await h.flush()
  assert.equal(h.view.phase, 'playing')
  assert.equal(h.speeches[0].active, true)
})

test('fallback answer keeps the same round resources and resumes listening with conversation history', async t => {
  const h = harness(t, [reply(opening, true), reply(followup, true)])
  await h.start()
  h.speeches[0].emit('Я читаю книги вечером.')
  await h.advance(1500)
  assert.equal(h.view.phase, 'playing')
  assert.equal(h.view.round, 1)
  assert.equal(h.view.question, followup)
  assert.equal(h.view.error, '')
  assert.match(h.view.notice, /готовые вопросы/iu)
  assert.equal(h.speeches.length, 1)
  assert.equal(h.speeches[0].starts, 2)
  assert.equal(h.speeches[0].active, true)
  assert.equal(h.resources.contexts, 1)
  assert.equal(h.resources.stoppedTracks, 0)
  assert.deepEqual(h.audioRequests.map(request => request.body.text), [opening, followup])
  assert.equal(h.requests[1].body.event, 'answer')
  assert.equal(h.requests[1].body.text, 'Я читаю книги вечером.')
  assert.deepEqual(h.requests[1].body.history, [{ role: 'assistant', text: opening }])
  assert.ok(h.view.secondsLeft < 60 && h.view.secondsLeft > 0)
})

test('missing recognition keeps the mic-responsive practice playable without inventing words or score', async t => {
  const h = harness(t, [reply(opening, true)], { recognition: false, level: 14 })
  await h.start()
  assert.equal(h.view.phase, 'playing')
  assert.equal(h.view.microphoneOnly, true)
  await h.advance(61000)
  assert.equal(h.view.phase, 'won')
  assert.equal(h.view.result.words, 0)
  assert.ok(h.view.result.spokenSeconds >= 59)
  assert.equal(h.view.score, 0)
  assert.equal(h.requests.length, 1)
  assert.equal(h.resources.stoppedTracks, 1)
})

test('normal AI recovery clears the fallback notice and continues using server speech', async t => {
  const h = harness(t, [reply(opening, true), reply(followup, false)])
  await h.start()
  assert.notEqual(h.view.notice, '')
  h.speeches[0].emit('Я читаю книги вечером.')
  await h.advance(1500)
  assert.equal(h.view.phase, 'playing')
  assert.equal(h.view.notice, '')
  assert.equal(h.view.error, '')
  assert.equal(h.view.question, followup)
  assert.deepEqual(h.audioRequests.map(request => request.body.text), [opening, followup])
  assert.equal(h.speeches[0].starts, 2)
  assert.equal(h.speeches[0].active, true)
})

for (const action of ['unmount', 'back navigation']) {
  test(`${action} during a pending fallback releases resources and cannot restart listening`, async t => {
    const pending = deferred()
    const h = harness(t, [pending.promise])
    await h.start()
    assert.equal(h.view.phase, 'starting')
    assert.equal(h.requests.length, 1)
    if (action === 'back navigation') h.view.onBack()
    h.unmount()
    pending.resolve(reply(opening, true))
    await h.flush()
    assert.equal(h.resources.closedContexts, 1)
    assert.equal(h.resources.stoppedTracks, 1)
    assert.equal(h.speeches[0].starts, 0)
    assert.equal(h.speeches[0].active, false)
    assert.equal(h.audioRequests.length, 0)
    assert.equal(h.timers.size, 0)
    assert.equal(h.resources.lateStateUpdates, 0)
    if (action === 'back navigation') assert.deepEqual(h.navigations, ['/games'])
  })
}

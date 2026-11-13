const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')

function load(file, dependencies = {}, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/routes/games/saw', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { exports, require: key => dependencies[key], ...globals })
  return exports
}
const { nextThreat, contentWords, russianWords, fillerCount, resultFor } = load('engine.ts')

test('ten seconds silence reaches impact; fluent speech retreats five points per second', () => {
  assert.equal(nextThreat(0, 9.9, false), 99)
  assert.equal(nextThreat(0, 10, false), 100)
  assert.equal(nextThreat(80, 4, true), 60)
  assert.equal(nextThreat(1, 4, true), 0)
  assert.equal(nextThreat(95, 1, false), 100)
})
test('fillers are discrete five-point penalties and filler-only text does not rescue the player', () => {
  assert.equal(fillerCount('Ну, э-э, как бы, типа, ну'), 5)
  assert.equal(nextThreat(30, 0, false, 3), 45)
  assert.equal(contentWords('ну эм э-э как бы типа').length, 0)
  assert.equal(contentWords('Как бы я люблю читать').length, 3)
  assert.equal(fillerCount('нужный типаж'), 0)
})
test('Latin and Uzbek-only words do not drive Russian speech credit', () => {
  assert.equal(contentWords('hello this is my answer').length, 0)
  assert.equal(contentWords('ўқувчи қаҳрамон ғалаба').length, 0)
  assert.equal(russianWords('Я люблю русский язык.').length, 4)
})
test('result statistics are based on transcript and active player time, not tutor time', () => {
  const result = resultFor('Я люблю чай. Я люблю книги.', 45, 60, 'complete')
  assert.equal(result.confidence, 75)
  assert.equal(result.words, 6)
  assert.equal(result.favouriteWord, 'я')
  assert.equal(result.reason, 'complete')
  assert.equal(resultFor('', 0, 0, 'surrender').confidence, 0)
})
function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function audioHarness({ holdPlayback = false } = {}) {
  const mic = deferred(), clip = deferred()
  const counts = { stoppedTracks: 0, closedContexts: 0, decoded: 0, played: 0, stoppedVoices: 0 }
  const requests = []
  class Node {
    gain = { value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    frequency = { ...this.gain }
    Q = { value: 0 }
    connect(target) { return target }
    disconnect() {}
    start() {}
    stop() {}
  }
  class Context {
    destination = new Node()
    currentTime = 0
    sampleRate = 44100
    generatedBuffers = new WeakSet()
    createOscillator() { return new Node() }
    createBiquadFilter() { return new Node() }
    createGain() { return new Node() }
    createBuffer(channels, length, sampleRate) {
      const samples = Array.from({ length: channels }, () => new Float32Array(length))
      const buffer = { duration: length / sampleRate, getChannelData: channel => samples[channel] }
      this.generatedBuffers.add(buffer)
      return buffer
    }
    resume() { return Promise.resolve() }
    close() { counts.closedContexts++; return Promise.resolve() }
    decodeAudioData() { counts.decoded++; return Promise.resolve({ duration: 1 }) }
    createBufferSource() {
      const source = new Node()
      source.playbackRate = { value: 1 }
      source.start = () => {
        const voice = !this.generatedBuffers.has(source.buffer)
        if (voice) counts.played++
        if (!source.loop && (!voice || !holdPlayback)) queueMicrotask(() => source.onended?.())
      }
      source.stop = () => {
        if (!this.generatedBuffers.has(source.buffer)) counts.stoppedVoices++
      }
      return source
    }
  }
  const { SawAudio } = load('audio.ts', {
    '../../../lib/api': { api: { postBlob: (url, body) => { requests.push({ url, body: structuredClone(body) }); return clip.promise } } },
    './dialogue': { deadline: promise => promise },
  }, {
    AudioContext: Context, AbortController, Uint8Array,
    navigator: { mediaDevices: { getUserMedia: () => mic.promise } },
    window: { setTimeout, clearTimeout },
  })
  return { audio: new SawAudio(), mic, clip, counts, requests }
}
test('permission resolving after leaving the game immediately releases every microphone track', async () => {
  const { audio, mic, counts } = audioHarness()
  const pending = audio.openMicrophone()
  audio.close()
  mic.resolve({ getTracks: () => [{ stop() { counts.stoppedTracks++ } }] })
  await assert.rejects(pending, /cancelled/)
  assert.equal(counts.stoppedTracks, 1)
  assert.equal(counts.closedContexts, 1)
  audio.close()
  assert.equal(counts.closedContexts, 1)
})
test('late TTS response after cleanup cannot decode or play audio', async () => {
  const { audio, clip, counts } = audioHarness()
  const pending = audio.speak('Что ты любишь?', 'panda')
  audio.close()
  clip.resolve({ arrayBuffer: async () => new ArrayBuffer(8) })
  await pending
  assert.equal(counts.decoded, 0)
  assert.equal(counts.played, 0)
})

test('Arra plays server speech and reports speaking while the clip runs', async () => {
  const { audio, clip, counts, requests } = audioHarness()
  const question = 'Что ты любишь?'
  const speaking = []
  const pending = audio.speak(question, 'panda', { onSpeaking: value => speaking.push(value) })
  assert.deepEqual(requests, [{ url: '/missions/voice/prompt-audio', body: { text: question, character: 'panda', use: 'feedback' } }])
  clip.resolve({ arrayBuffer: async () => new ArrayBuffer(8) })
  await pending
  assert.equal(counts.decoded, 1)
  assert.equal(counts.played, 1)
  assert.deepEqual(speaking, [true, false])
  audio.close()
})

test('mute stops active server speech and suppresses further voice requests', async () => {
  const { audio, clip, counts, requests } = audioHarness({ holdPlayback: true })
  const speaking = []
  const pending = audio.speak('Что ты любишь?', 'pero', { onSpeaking: value => speaking.push(value) })
  clip.resolve({ arrayBuffer: async () => new ArrayBuffer(8) })
  await new Promise(setImmediate)
  assert.equal(counts.played, 1)
  assert.deepEqual(speaking, [true])
  audio.setEnabled(false)
  await pending
  assert.equal(counts.stoppedVoices, 1)
  assert.deepEqual(speaking, [true, false])
  await audio.speak('Почему?', 'pero')
  assert.equal(requests.length, 1)
  audio.close()
})

test('server speech failure reaches the caller without decoding or starting audio', async () => {
  const { audio, clip, counts, requests } = audioHarness()
  const speaking = []
  const failure = new Error('voice_billing_unavailable')
  const pending = audio.speak('Что ты любишь?', 'penguin', { onSpeaking: value => speaking.push(value) })
  clip.reject(failure)
  await assert.rejects(pending, error => error === failure)
  assert.equal(requests.length, 1)
  assert.equal(counts.decoded, 0)
  assert.equal(counts.played, 0)
  assert.ok(!speaking.includes(true))
  audio.close()
})

test('only Russian-language validation errors allow retrying the same round', () => {
  class RequestError extends Error {
    constructor(status, code) { super(code); this.status = status; this.code = code }
  }
  const { isSawLanguageError, sawError } = load('dialogue.ts', { '../../../lib/api': { RequestError } })
  const rejectedAnswer = new RequestError(400, 'arra_russian_required')
  assert.equal(isSawLanguageError(rejectedAnswer), true)
  assert.equal(isSawLanguageError(new RequestError(422, 'arra_russian_required')), true)
  assert.match(sawError(rejectedAnswer), /по-русски/)
  for (const [status, code] of [[401, 'arra_russian_required'], [403, 'forbidden'], [429, 'rate_limited'], [500, 'server_error']]) {
    assert.equal(isSawLanguageError(new RequestError(status, code)), false)
  }
  assert.equal(isSawLanguageError(new Error('arra_russian_required')), false)
})

test('reply request preserves recent answer and history when long speech is truncated', async () => {
  let sent
  class RequestError extends Error {}
  const { getSawReply } = load('dialogue.ts', {
    '../../../lib/api': { RequestError, api: { post: async (_path, body) => { sent = body; return { characterReply: 'Почему ты так думаешь?', animation: 'happy', threatChange: 0 } } } },
  }, { window: { setTimeout, clearTimeout } })
  const current = `${'раньше '.repeat(250)}теперь я люблю читать`
  const history = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? 'user' : 'assistant', text: `${'слово '.repeat(150)}последняя мысль ${index}` }))
  await getSawReply('penguin', 'Повседневная жизнь', current, history, 'answer')
  assert.equal(sent.text.length, 1200)
  assert.ok(sent.text.endsWith('теперь я люблю читать'))
  assert.equal(sent.history.length, 8)
  assert.ok(sent.history[0].text.endsWith('последняя мысль 2'))
  assert.ok(sent.history.at(-1).text.endsWith('последняя мысль 9'))
  assert.ok(sent.history.every(message => message.text.length <= 600))
})

function inputHarness({ supported = true, starts = true } = {}) {
  let now = 0, recognition, startupTimeout
  const states = [], transcripts = []
  class GameSpeech {
    constructor(onText, onStatus) { this.onText = onText; this.onStatus = onStatus; recognition = this }
    supported = supported
    transcript = ''
    start() {
      if (starts) { this.onStatus('listening'); return Promise.resolve() }
      return new Promise((_resolve, reject) => { this.rejectStart = reject })
    }
    finish() { return Promise.resolve(this.transcript) }
    abort() { this.rejectStart?.(new Error('speech_cancelled')); this.onStatus('idle') }
  }
  const { SawInput } = load('input.ts', { '../../../lib/game-speech': { GameSpeech } }, {
    navigator: { mediaDevices: { getUserMedia() {} } },
    setTimeout: (callback) => { startupTimeout = callback; return 1 },
    clearTimeout: () => { startupTimeout = undefined },
  })
  const input = new SawInput(text => transcripts.push(text), state => states.push(state))
  function sample(level, duration) {
    let active = false
    for (let elapsed = 0; elapsed < duration; elapsed += 100) active = input.sample(level, now += 100)
    return active
  }
  return { input, recognized: text => recognition.onText(recognition.transcript = text), states, transcripts, sample, timeout: () => startupTimeout() }
}

test('a microphone still detects voice without browser transcription and never fabricates text', async () => {
  const { input, states, transcripts, sample } = inputHarness({ supported: false })
  await input.start()
  assert.equal(states.at(-1), 'microphone-only')
  assert.equal(sample(0.02, 3000), false)
  assert.equal(sample(0.14, 400), true)
  assert.equal(sample(0.02, 600), false)
  assert.equal(await input.finish(), '')
  assert.deepEqual(transcripts, [''])
  assert.equal(sample(0.2, 1000), false)
})

test('mobile browser recognition can return a final transcript after an utterance ends', async () => {
  const { input, recognized, sample } = inputHarness()
  await input.start()
  sample(0.2, 2600)
  sample(0, 1100)
  recognized('Я люблю русский язык.')
  sample(0, 900)
  assert.equal(input.mode, 'recognition')
  assert.equal(await input.finish(), 'Я люблю русский язык.')
})

test('a recognizer stuck after microphone activity switches to practice without a transcript', async () => {
  const { input, states, transcripts, sample, recognized } = inputHarness()
  await input.start()
  sample(0.2, 1000)
  sample(0, 1900)
  assert.equal(states.at(-1), 'microphone-only')
  recognized('Поздний результат')
  assert.equal(await input.finish(), '')
  assert.deepEqual(transcripts, [''])
})

test('recognition startup timeout opens voice practice and an aborted startup stays idle', async () => {
  const stalled = inputHarness({ starts: false })
  const pending = stalled.input.start()
  stalled.timeout()
  await pending
  assert.equal(stalled.states.at(-1), 'microphone-only')

  const cancelled = inputHarness({ starts: false })
  const interrupted = cancelled.input.start()
  cancelled.input.abort()
  await interrupted
  assert.equal(cancelled.states.at(-1), 'idle')
  assert.ok(!cancelled.states.includes('microphone-only'))
})

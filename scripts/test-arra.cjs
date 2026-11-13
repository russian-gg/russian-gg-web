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
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function audioHarness() {
  const mic = deferred(), clip = deferred()
  const counts = { stoppedTracks: 0, closedContexts: 0, decoded: 0, played: 0 }
  class Node {
    gain = { value: 0, setTargetAtTime() {} }
    frequency = { value: 0, setTargetAtTime() {} }
    connect(target) { return target }
    start() {}
    stop() {}
  }
  class Context {
    destination = new Node()
    currentTime = 0
    createOscillator() { return new Node() }
    createBiquadFilter() { return new Node() }
    createGain() { return new Node() }
    resume() { return Promise.resolve() }
    close() { counts.closedContexts++; return Promise.resolve() }
    decodeAudioData() { counts.decoded++; return Promise.resolve({ duration: 1 }) }
    createBufferSource() { counts.played++; return new Node() }
  }
  const { SawAudio } = load('audio.ts', {
    '../../../lib/api': { api: { postBlob: () => clip.promise } },
    './dialogue': { deadline: promise => promise },
  }, { AudioContext: Context, navigator: { mediaDevices: { getUserMedia: () => mic.promise } }, window: { setTimeout, clearTimeout }, clearTimeout, Uint8Array })
  return { audio: new SawAudio(), mic, clip, counts }
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

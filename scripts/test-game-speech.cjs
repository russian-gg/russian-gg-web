const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.resolve(__dirname, '../src/lib/game-speech.ts')
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  fileName: sourcePath,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    strict: true,
  },
  reportDiagnostics: true,
})
const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error)
assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'))

const START_TIMEOUT = 12000
const RESTART_DELAY = 150
const FINISH_TIMEOUT = 1000

class Clock {
  now = 0
  nextId = 1
  jobs = new Map()

  setTimeout = (callback, delay = 0, ...args) => {
    const id = this.nextId++
    this.jobs.set(id, { at: this.now + Math.max(0, Number(delay) || 0), callback, args })
    return id
  }

  clearTimeout = (id) => { this.jobs.delete(id) }

  async advance(milliseconds) {
    const end = this.now + milliseconds
    let calls = 0
    while (true) {
      const next = [...this.jobs.entries()]
        .filter(([, job]) => job.at <= end)
        .sort(([aId, a], [bId, b]) => a.at - b.at || aId - bId)[0]
      if (!next) break
      assert.ok(++calls < 1000, 'fake timers must not enter an infinite restart loop')
      const [id, job] = next
      this.now = job.at
      this.jobs.delete(id)
      job.callback(...job.args)
      await flush()
    }
    this.now = end
    await flush()
  }
}

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

function observe(promise) {
  const result = { state: 'pending' }
  promise.then(
    (value) => Object.assign(result, { state: 'fulfilled', value }),
    (error) => Object.assign(result, { state: 'rejected', error }),
  )
  return result
}

async function rejected(result, message) {
  await flush()
  assert.equal(result.state, 'rejected', `promise must reject with ${message}, not remain pending or resolve`)
  assert.equal(result.error?.message, message)
}

function resultEvent(entries, resultIndex = 0) {
  const results = { length: entries.length, item(index) { return this[index] } }
  entries.forEach(([transcript, isFinal], index) => {
    results[index] = {
      0: { transcript, confidence: 0.9 },
      length: 1,
      isFinal,
      item(alternative) { return this[alternative] },
    }
  })
  return { resultIndex, results }
}

function handlers(recognition) {
  return {
    start: recognition.onstart,
    end: recognition.onend,
    result: recognition.onresult,
    error: recognition.onerror,
  }
}

function harness(t, { api = 'SpeechRecognition' } = {}) {
  const clock = new Clock()
  const instances = []
  const texts = []
  const statuses = []

  class MockRecognition {
    onstart = null
    onend = null
    onresult = null
    onerror = null
    startCalls = 0
    stopCalls = 0
    abortCalls = 0
    active = false

    constructor() { instances.push(this) }
    start() { this.startCalls++; this.active = true }
    stop() { this.stopCalls++; this.active = false }
    abort() { this.abortCalls++; this.active = false }
    emitStart() { this.onstart?.() }
    emitEnd() { this.active = false; this.onend?.() }
    emitError(error) { this.onerror?.({ error }) }
    emitResults(entries, resultIndex = 0) { this.onresult?.(resultEvent(entries, resultIndex)) }
  }

  const window = { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout }
  if (api) window[api] = MockRecognition
  const module = { exports: {} }
  const context = vm.createContext({
    window,
    module,
    exports: module.exports,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  })
  vm.runInContext(compiled.outputText, context, { filename: sourcePath, timeout: 1000 })
  const speech = new module.exports.GameSpeech((text) => texts.push(text), (status) => statuses.push(status))
  t.after(() => {
    speech.abort()
    clock.jobs.clear()
  })

  return {
    speech, clock, instances, texts, statuses,
    async listen() {
      const count = instances.length
      const request = observe(speech.start())
      assert.equal(instances.length, count + 1)
      const recognition = instances.at(-1)
      assert.equal(recognition.startCalls, 1)
      recognition.emitStart()
      await flush()
      assert.equal(request.state, 'fulfilled', 'start must resolve after the browser onstart event')
      return recognition
    },
  }
}

test('start configures Russian recognition and clears its timeout', async (t) => {
  const h = harness(t)
  assert.equal(h.speech.supported, true)
  const request = observe(h.speech.start())
  const recognition = h.instances[0]
  assert.equal(request.state, 'pending')
  assert.equal(h.statuses.at(-1), 'starting')
  assert.equal(recognition.lang, 'ru-RU')
  assert.equal(recognition.continuous, true)
  assert.equal(recognition.interimResults, true)
  assert.equal(recognition.maxAlternatives, 1)
  recognition.emitStart()
  await flush()
  assert.equal(request.state, 'fulfilled')
  assert.equal(h.statuses.at(-1), 'listening')
  assert.deepEqual(h.texts, [''])
  assert.equal(h.clock.jobs.size, 0)
  await h.clock.advance(START_TIMEOUT)
  assert.equal(recognition.abortCalls, 0)
  assert.equal(h.statuses.at(-1), 'listening')
})

test('webkitSpeechRecognition is supported', async (t) => {
  const h = harness(t, { api: 'webkitSpeechRecognition' })
  assert.equal(h.speech.supported, true)
  const recognition = await h.listen()
  recognition.emitResults([['privet', true]])
  assert.equal(h.speech.transcript, 'privet')
  assert.equal(h.texts.at(-1), 'privet')
})

test('final and interim results are counted once', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  recognition.emitResults([['  privet  ', false]])
  recognition.emitResults([['privet mir', false]])
  recognition.emitResults([['privet mir', true], ['  kak  ', false]])
  recognition.emitResults([['privet mir', true], ['kak dela', true]], 1)
  assert.deepEqual(h.texts, ['', 'privet', 'privet mir', 'privet mir kak', 'privet mir kak dela'])
  assert.equal(h.speech.transcript, 'privet mir kak dela')
})

test('duplicate result events do not repeat final words', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  for (const [entries, index, expected] of [
    [[['da', true]], 0, 'da'],
    [[['da', true]], 0, 'da'],
    [[['da', true], ['da', false]], 1, 'da da'],
    [[['da', true], ['da', false]], 1, 'da da'],
    [[['da', true], ['da', true]], 1, 'da da'],
    [[['da', true], ['da', true]], 1, 'da da'],
  ]) {
    recognition.emitResults(entries, index)
    assert.equal(h.speech.transcript, expected)
    assert.equal(h.texts.at(-1), expected)
  }
  assert.equal(h.speech.transcript, 'da da', 'identical words at different result indices are legitimate speech')
})

test('empty recognition results do not add whitespace', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  recognition.emitResults([['   ', true], ['', false]])
  assert.equal(h.speech.transcript, '')
  recognition.emitResults([['  privet  ', true], ['', false]])
  assert.equal(h.speech.transcript, 'privet')
  assert.equal(h.texts.at(-1), 'privet')
})

test('restart preserves transcript and accepts reset result indices', async (t) => {
  const h = harness(t)
  const first = await h.listen()
  first.emitResults([['odin', true], ['dva', false]])
  first.emitEnd()
  assert.equal(h.speech.transcript, 'odin dva')
  await h.clock.advance(RESTART_DELAY - 1)
  assert.equal(h.instances.length, 1)
  await h.clock.advance(1)
  assert.equal(h.instances.length, 2)
  const second = h.instances[1]
  second.emitStart()
  second.emitResults([['tri', false]])
  assert.equal(h.speech.transcript, 'odin dva tri')
  second.emitResults([['tri', true]])
  second.emitResults([['tri', true]])
  second.emitEnd()
  await h.clock.advance(RESTART_DELAY)
  assert.equal(h.instances.length, 3)
  h.instances[2].emitStart()
  h.instances[2].emitResults([['chetyre', true]])
  assert.equal(h.speech.transcript, 'odin dva tri chetyre')
  assert.equal(h.texts.at(-1), 'odin dva tri chetyre')
})

test('finish flushes final result before returning', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  recognition.emitResults([['draft', false]])
  const late = handlers(recognition)
  const request = observe(h.speech.finish())
  await flush()
  assert.equal(recognition.stopCalls, 1)
  assert.equal(request.state, 'pending')
  recognition.emitResults([['final answer', true]])
  assert.equal(request.state, 'pending', 'finish must wait for onend, not just the result')
  recognition.emitEnd()
  await flush()
  assert.equal(request.state, 'fulfilled')
  assert.equal(request.value, 'final answer')
  assert.equal(h.speech.transcript, 'final answer')
  assert.equal(h.statuses.at(-1), 'idle')
  const texts = [...h.texts]
  late.result(resultEvent([['too late', true], ['extra', true]]))
  assert.deepEqual(h.texts, texts)
  assert.equal(h.speech.transcript, 'final answer')
  await h.clock.advance(START_TIMEOUT)
  assert.equal(h.instances.length, 1)
  assert.equal(h.clock.jobs.size, 0)
})

test('finish timeout releases a recognizer that never ends', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  recognition.emitResults([['partial answer', false]])
  const request = observe(h.speech.finish())
  await h.clock.advance(FINISH_TIMEOUT - 1)
  assert.equal(request.state, 'pending')
  await h.clock.advance(1)
  assert.equal(request.state, 'fulfilled')
  assert.equal(request.value, 'partial answer')
  assert.equal(recognition.stopCalls, 1)
  assert.ok(recognition.abortCalls >= 1)
  assert.equal(recognition.active, false)
  assert.equal(h.clock.jobs.size, 0)
  assert.equal(h.statuses.at(-1), 'idle')
  await h.clock.advance(START_TIMEOUT)
  assert.equal(h.instances.length, 1)
})

test('finish cancels a pending automatic restart', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  recognition.emitResults([['saved', true]])
  recognition.emitEnd()
  const request = observe(h.speech.finish())
  await flush()
  assert.equal(request.state, 'fulfilled')
  assert.equal(request.value, 'saved')
  assert.equal(h.statuses.at(-1), 'idle')
  await h.clock.advance(START_TIMEOUT)
  assert.equal(h.instances.length, 1)
  assert.equal(h.clock.jobs.size, 0)
})

test('finish during startup settles the pending start', async (t) => {
  const h = harness(t)
  const start = observe(h.speech.start())
  const recognition = h.instances[0]
  const finish = observe(h.speech.finish())
  assert.equal(recognition.stopCalls, 1)
  recognition.emitEnd()
  await flush()
  assert.equal(finish.state, 'fulfilled')
  assert.equal(finish.value, '')
  await rejected(start, 'speech_cancelled')
  assert.equal(h.clock.jobs.size, 0)
  await h.clock.advance(START_TIMEOUT)
  assert.equal(h.instances.length, 1)
})

for (const error of ['not-allowed', 'service-not-allowed']) {
  test(`permission ${error} rejects start without restarting`, async (t) => {
    const h = harness(t)
    const request = observe(h.speech.start())
    const recognition = h.instances[0]
    recognition.emitError(error)
    await rejected(request, error)
    assert.equal(h.statuses.at(-1), 'denied')
    assert.equal(h.texts.at(-1), '')
    recognition.emitEnd()
    await h.clock.advance(START_TIMEOUT)
    assert.equal(h.instances.length, 1)
    assert.equal(h.clock.jobs.size, 0)
    assert.equal(h.statuses.includes('listening'), false)
  })
}

test('unsupported recognition rejects without allocating resources', async (t) => {
  const h = harness(t, { api: null })
  assert.equal(h.speech.supported, false)
  await rejected(observe(h.speech.start()), 'speech_unavailable')
  assert.equal(h.statuses.at(-1), 'unavailable')
  assert.equal(h.speech.transcript, '')
  assert.equal(h.instances.length, 0)
  assert.equal(h.clock.jobs.size, 0)
})

for (const error of ['audio-capture', 'network', 'no-speech']) {
  test(`startup ${error} rejects without restarting`, async (t) => {
    const h = harness(t)
    const request = observe(h.speech.start())
    h.instances[0].emitError(error)
    await rejected(request, error)
    assert.equal(h.statuses.at(-1), 'failed')
    h.instances[0].emitEnd()
    await h.clock.advance(START_TIMEOUT)
    assert.equal(h.instances.length, 1)
    assert.equal(h.clock.jobs.size, 0)
  })
}

test('no-speech after listening preserves transcript and allows restart', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  recognition.emitResults([['saved', true]])
  recognition.emitError('no-speech')
  assert.equal(h.statuses.at(-1), 'listening')
  assert.equal(h.speech.transcript, 'saved')
  recognition.emitEnd()
  await h.clock.advance(RESTART_DELAY)
  assert.equal(h.instances.length, 2)
  h.instances[1].emitStart()
  h.instances[1].emitResults([['again', true]])
  assert.equal(h.speech.transcript, 'saved again')
})

test('abort on unmount releases the microphone and ignores queued events', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  recognition.emitResults([['saved', true]])
  const late = handlers(recognition)
  h.speech.abort()
  assert.ok(recognition.abortCalls >= 1)
  assert.equal(recognition.active, false)
  const texts = [...h.texts]
  const statuses = [...h.statuses]
  late.result(resultEvent([['saved', true], ['stale', true]]))
  late.error({ error: 'not-allowed' })
  late.end()
  late.start()
  await h.clock.advance(START_TIMEOUT)
  assert.deepEqual(h.texts, texts)
  assert.deepEqual(h.statuses, statuses)
  assert.equal(h.speech.transcript, 'saved')
  assert.equal(h.instances.length, 1)
  assert.equal(h.clock.jobs.size, 0)
})

test('abort cancels an in-flight start and prevents restart', async (t) => {
  const h = harness(t)
  const request = observe(h.speech.start())
  const recognition = h.instances[0]
  const late = handlers(recognition)
  h.speech.abort()
  await rejected(request, 'speech_cancelled')
  assert.ok(recognition.abortCalls >= 1)
  assert.equal(recognition.active, false)
  const statuses = [...h.statuses]
  late.start()
  late.result(resultEvent([['stale', true]]))
  late.error({ error: 'not-allowed' })
  late.end()
  await h.clock.advance(START_TIMEOUT)
  assert.deepEqual(h.statuses, statuses)
  assert.deepEqual(h.texts, [''])
  assert.equal(h.instances.length, 1)
  assert.equal(h.clock.jobs.size, 0)
})

test('abort on unmount cancels a queued restart', async (t) => {
  const h = harness(t)
  const recognition = await h.listen()
  recognition.emitEnd()
  assert.equal(h.clock.jobs.size, 1)
  h.speech.abort()
  await h.clock.advance(START_TIMEOUT)
  assert.equal(h.instances.length, 1)
  assert.equal(h.clock.jobs.size, 0)
  assert.equal(h.statuses.at(-1), 'idle')
})

test('stale events from an aborted generation cannot corrupt a new start', async (t) => {
  const h = harness(t)
  const first = await h.listen()
  first.emitResults([['old answer', true]])
  const late = handlers(first)
  const second = await h.listen()
  assert.ok(first.abortCalls >= 1)
  assert.equal(h.speech.transcript, '')
  second.emitResults([['new answer', true]])
  const texts = [...h.texts]
  const statuses = [...h.statuses]
  late.start()
  late.result(resultEvent([['old answer', true], ['stale answer', true]]))
  late.error({ error: 'not-allowed' })
  late.end()
  await h.clock.advance(START_TIMEOUT)
  assert.equal(h.speech.transcript, 'new answer')
  assert.deepEqual(h.texts, texts)
  assert.deepEqual(h.statuses, statuses)
  assert.equal(h.instances.length, 2)
  assert.equal(second.active, true)
  h.speech.abort()
  assert.ok(second.abortCalls >= 1)
  assert.equal(h.clock.jobs.size, 0)
})

test('stale results after automatic restart are ignored', async (t) => {
  const h = harness(t)
  const first = await h.listen()
  first.emitResults([['before', true]])
  const late = handlers(first)
  first.emitEnd()
  await h.clock.advance(RESTART_DELAY)
  const second = h.instances[1]
  second.emitStart()
  second.emitResults([['current', false]])
  const texts = [...h.texts]
  late.result(resultEvent([['before', true], ['stale', true]]))
  assert.equal(h.speech.transcript, 'before current')
  assert.deepEqual(h.texts, texts)
})

test('stale lifecycle events after automatic restart are ignored', async (t) => {
  const h = harness(t)
  const first = await h.listen()
  const late = handlers(first)
  first.emitEnd()
  await h.clock.advance(RESTART_DELAY)
  const second = h.instances[1]
  second.emitStart()
  const statuses = [...h.statuses]
  late.error({ error: 'not-allowed' })
  late.end()
  await h.clock.advance(RESTART_DELAY)
  h.speech.abort()
  assert.ok(second.abortCalls >= 1, 'stale onend must not lose the active microphone reference')
  assert.equal(second.active, false)
  assert.equal(h.instances.length, 2)
  assert.deepEqual(h.statuses.slice(0, -1), statuses)
})

test('start timeout releases resources and can retry', async (t) => {
  const h = harness(t)
  const request = observe(h.speech.start())
  const first = h.instances[0]
  await h.clock.advance(START_TIMEOUT - 1)
  assert.equal(request.state, 'pending')
  assert.equal(first.abortCalls, 0)
  await h.clock.advance(1)
  await rejected(request, 'speech_start_timeout')
  assert.equal(h.statuses.at(-1), 'failed')
  assert.ok(first.abortCalls >= 1)
  assert.equal(first.active, false)
  assert.equal(h.clock.jobs.size, 0)
  const second = await h.listen()
  second.emitResults([['retry succeeded', true]])
  assert.equal(h.speech.transcript, 'retry succeeded')
  assert.equal(h.statuses.at(-1), 'listening')
  await h.clock.advance(START_TIMEOUT)
  assert.equal(h.instances.length, 2)
  assert.equal(second.abortCalls, 0)
  assert.equal(h.clock.jobs.size, 0)
})

test('late results after start timeout are ignored', async (t) => {
  const h = harness(t)
  const request = observe(h.speech.start())
  const late = handlers(h.instances[0])
  await h.clock.advance(START_TIMEOUT)
  await rejected(request, 'speech_start_timeout')
  const texts = [...h.texts]
  late.result(resultEvent([['stale answer', true]]))
  assert.equal(h.speech.transcript, '')
  assert.deepEqual(h.texts, texts)
  assert.equal(h.clock.jobs.size, 0)
})

test('late errors after start timeout are ignored', async (t) => {
  const h = harness(t)
  const request = observe(h.speech.start())
  const late = handlers(h.instances[0])
  await h.clock.advance(START_TIMEOUT)
  await rejected(request, 'speech_start_timeout')
  const statuses = [...h.statuses]
  late.error({ error: 'not-allowed' })
  late.end()
  late.start()
  await h.clock.advance(START_TIMEOUT)
  assert.deepEqual(h.statuses, statuses)
  assert.equal(h.instances.length, 1)
  assert.equal(h.clock.jobs.size, 0)
})

test('start(true) preserves transcript on microphone retry and default start resets it', async (t) => {
  const h = harness(t)
  const first = await h.listen()
  first.emitResults([['saved final', true], ['saved interim', false]])
  const late = handlers(first)
  first.emitError('network')
  first.emitEnd()
  const retry = observe(h.speech.start(true))
  assert.equal(h.speech.transcript, 'saved final saved interim')
  assert.equal(h.texts.at(-1), 'saved final saved interim')
  const second = h.instances[1]
  second.emitStart()
  await flush()
  assert.equal(retry.state, 'fulfilled')
  late.result(resultEvent([['saved final', true], ['stale replacement', true]]))
  second.emitResults([['new speech', false]])
  assert.equal(h.speech.transcript, 'saved final saved interim new speech')
  second.emitResults([['new speech', true]])
  second.emitResults([['new speech', true]])
  assert.equal(h.speech.transcript, 'saved final saved interim new speech')
  assert.equal(h.texts.at(-1), 'saved final saved interim new speech')
  const fresh = await h.listen()
  assert.equal(h.speech.transcript, '')
  assert.equal(h.texts.at(-1), '')
  fresh.emitResults([['new round', true]])
  assert.equal(h.speech.transcript, 'new round')
  assert.equal(h.clock.jobs.size, 0)
})

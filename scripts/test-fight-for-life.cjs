const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { test, before, after } = require('node:test')
const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH || (() => {
  try { return require.resolve('playwright') }
  catch { return path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright') }
})()
const { chromium } = require(playwrightPath)
const BASE = process.env.LIFE_TEST_URL || 'http://127.0.0.1:5181'
const SHOTS = fs.mkdtempSync(path.join(os.tmpdir(), 'russian-life-game-'))
const meterExports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/routes/games/fight-for-life/meter.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: meterExports })
const { LifeMeter } = meterExports
let browser
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }) })
after(async () => { await browser?.close(); console.log(`Screenshots: ${SHOTS}`) })

test('silence boundary, recovery, fractional speech, and two-minute cap', () => {
  const meter = new LifeMeter(0)
  assert.equal(meter.advance(9999, false, false), null)
  assert.equal(meter.advance(10000, false, false), 'silence')
  assert.equal(meter.emotion(false), 'frozen')
  const recovered = new LifeMeter(0)
  recovered.advance(9000, false, false)
  recovered.advance(9500, true, false)
  assert.equal(recovered.silenceMs, 0)
  assert.equal(recovered.speechMs, 500)
  assert.equal(recovered.advance(130000, true, false), 'won')
  assert.equal(recovered.elapsedMs, 120000)
  assert.equal(recovered.speechMs, 111000)
})

test('tutor playback never scores and protects at most eight consecutive seconds', () => {
  const meter = new LifeMeter(0)
  meter.advance(8000, true, true)
  assert.equal(meter.speechMs, 0)
  assert.equal(meter.silenceMs, 0)
  assert.equal(meter.advance(17999, false, true), null)
  assert.equal(meter.advance(18000, false, true), 'silence')
  const resumed = new LifeMeter(0)
  resumed.advance(4000, false, true)
  resumed.advance(5000, true, false)
  assert.equal(resumed.speechMs, 1000)
  assert.equal(resumed.silenceMs, 0)
})

const voiceMock = `
export class VoiceError extends Error { constructor(code) { super(code); this.code = code } }
export async function requestMicrophone() {
  window.lifeMock.requests++;
  if (window.lifeMock.denied) throw new VoiceError('mic_denied');
  if (window.lifeMock.pendingMicrophone) await new Promise(resolve => { window.lifeMock.resolveMicrophone = resolve });
}
export function releaseMicrophone() { window.lifeMock.releases++ }
export class LiveVoiceSession {
  constructor(ticket, callbacks, options) { this.callbacks = callbacks; this.playback = options.playbackContext; window.lifeMock.callbacks = callbacks }
  async start() {
    this.callbacks.onConnected();
    this.callbacks.onStatus('listening');
    this.interval = setInterval(() => this.callbacks.onInputLevel(window.lifeMock.speaking ? .08 : 0, window.lifeMock.speaking, 50), 50);
  }
  requestTutorResponse(text) { window.lifeMock.reminders.push(text); return true }
  async close() { clearInterval(this.interval); window.lifeMock.closed++; this.callbacks.onPlayback(false); await this.playback.close() }
}
export const isPromptAudioPlaying = () => false;
export const prefetchPromptAudio = async () => {};
export const playPromptAudio = async () => {};
export const playLandingCharacterVoice = async () => {};
export const stopPromptAudio = () => {};
export const pausePromptAudio = () => {};
export const resumePromptAudio = async () => {};
`
const topics = [
  { id: '01', title: 'Опоздание на встречу — это нормально?', level: 'A1-A2', mode: 'debate' },
  { id: '02', title: 'Мой идеальный распорядок дня.', level: 'A1-A2', mode: 'monologue' },
  { id: '16', title: 'Ради карьеры можно пожертвовать семьей?', level: 'B1', mode: 'debate' },
  { id: '17', title: 'Какую цель ты ставишь на следующий год?', level: 'B1', mode: 'monologue' },
]
async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: options.desktop ? { width: 1280, height: 960 } : { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const state = { calls: [], errors: [], session: null, hold: null, release: null, voiceMessages: [], socket: null }
  await context.addInitScript(({ denied, locale, realVoice }) => {
    localStorage.setItem('rgg.access', 'local-life-game-test')
    localStorage.setItem('rgg.locale', locale)
    localStorage.setItem('rgg.install.never', 'true')
    localStorage.setItem('rgg.audio-muted', 'true')
    window.lifeMock = { denied, requests: 0, releases: 0, closed: 0, speaking: false, reminders: [] }
    window.lifeAudioContexts = []
    window.lifeAudioStarts = []
    const NativeAudioContext = window.AudioContext
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args)
        window.lifeAudioContexts.push(this)
        this.createdInGesture = navigator.userActivation.isActive
      }
      resume() { this.resumedInGesture = navigator.userActivation.isActive; return super.resume() }
    }
    if (realVoice) {
      const start = AudioBufferSourceNode.prototype.start
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.lifeAudioStarts.push({ state: this.context.state, rate: this.buffer?.sampleRate, peak: Math.max(...this.buffer.getChannelData(0)) })
        return start.apply(this, args)
      }
      navigator.mediaDevices.getUserMedia = async () => {
        const output = window.lifeAudioContexts[0].createMediaStreamDestination()
        window.lifeMicrophone = output.stream
        return output.stream
      }
    }
  }, { denied: options.denied ?? false, locale: options.locale ?? 'uz', realVoice: options.realVoice ?? false })
  const pcm = Buffer.alloc(4800)
  for (let i = 0; i < 2400; i++) pcm.writeInt16LE(Math.round(Math.sin(i * Math.PI / 30) * 8000), i * 2)
  const reply = (text) => state.socket.send(JSON.stringify({ serverContent: {
    outputTranscription: { text }, modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: pcm.toString('base64') } }] },
  } }))
  const turnComplete = () => state.socket.send(JSON.stringify({ serverContent: { turnComplete: true } }))
  await context.routeWebSocket('**/*', socket => {
    if (!options.realVoice) return socket.close()
    state.socket = socket
    socket.onMessage(message => {
      const data = JSON.parse(message)
      state.voiceMessages.push(data)
      if (data.setup) socket.send(JSON.stringify({ setupComplete: {} }))
      if (data.clientContent) reply('Можно ли опаздывать? Как ты думаешь?')
      if (data.realtimeInput?.text) reply('Ты живёшь в городе или деревне?')
    })
  })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== BASE) return route.fulfill({ status: 204, body: '' })
    if (url.pathname === '/src/lib/liveVoice.ts' && !options.realVoice) return route.fulfill({ contentType: 'text/javascript', body: voiceMock })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const endpoint = url.pathname
    const body = request.postData() ? request.postDataJSON() : null
    if (endpoint === '/api/auth/me') return route.fulfill({ json: { id: 'local-life-learner', displayName: 'Learner', role: 'Learner', uiLanguage: options.locale ?? 'uz', phoneNumber: '+998900000000', phoneNumberConfirmed: true, hasCompletedDiagnostic: true, tier: 'Free' } })
    if (endpoint === '/api/billing/welcome-gift') return route.fulfill({ json: { isAvailable: false, isClaimed: true } })
    if (endpoint === '/api/billing/entitlement') return route.fulfill({ json: { tier: 'Free', isPro: false } })
    if (endpoint === '/api/course/progress') return route.fulfill({ json: { currentDay: 2 } })
    if (endpoint === '/api/lesson-feedback') return route.fulfill({ json: { isDue: false } })
    if (endpoint === '/api/tests') return route.fulfill({ json: [] })
    if (endpoint.startsWith('/api/analytics/')) return route.fulfill({ status: 204 })
    if (endpoint === '/api/games') return route.fulfill({ json: options.disabled ? [] : [{ slug: 'fight-for-life', titleUz: 'Помоги!', bodyUz: '', isBuilt: true, isEnabled: true, isAccessible: true, requiresPro: false }] })
    try {
      assert.equal(request.headers().authorization, 'Bearer local-life-game-test')
      state.calls.push({ endpoint, body })
      if (endpoint.endsWith('/catalog')) return route.fulfill({ json: { isEnabled: !options.disabled, isAccessible: !options.disabled, lockReason: null, topics } })
      if (endpoint === '/api/fight-for-life/sessions') {
        state.session = { id: 'session-1', status: 'ready', ...body, topic: topics.find(t => t.id === body.topicId), score: 0, speechMilliseconds: 0, silenceMilliseconds: 0, transcript: '' }
      } else if (endpoint.endsWith('/voice')) {
        state.session.status = 'connecting'
        return route.fulfill({ json: { sessionId: state.session.id, token: 'test-only', connectUrl: 'wss://voice.example.test/BidiGenerateContent', model: 'test-voice', voiceName: { penguin: 'Fenrir', panda: 'Leda', pero: 'Puck' }[state.session.character], languageCode: 'ru-RU', systemInstruction: 'Test Russian conversation', openingCue: 'Introduce the topic and invite the learner to speak.' } })
      } else if (endpoint.endsWith('/begin')) {
        state.session.status = 'playing'
      } else if (endpoint.endsWith('/activity')) {
        if (state.hold && !body.finish) { state.release?.(); await state.hold; state.hold = null }
        Object.assign(state.session, { speechMilliseconds: body.speechMilliseconds, silenceMilliseconds: body.silenceMilliseconds, transcript: body.transcript, score: Math.floor(body.speechMilliseconds / 1000) })
        const outcome = body.finish ? 'stopped' : body.silenceMilliseconds >= 10000 ? 'silence' : body.speechMilliseconds >= 120000 ? 'won' : null
        if (outcome) Object.assign(state.session, { status: 'completed', outcome })
      } else assert.equal(endpoint, '/api/fight-for-life/sessions/session-1')
      return route.fulfill({ json: state.session })
    } catch (error) {
      state.errors.push(error.message)
      return route.fulfill({ status: 500, json: { code: 'test_contract_error', message: error.message } })
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  page.on('pageerror', error => state.errors.push(error.message))
  await page.clock.install()
  async function open(route = '/games/fight-for-life') {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.locator(options.disabled ? '.life-notice svg' : '.life-choices').waitFor()
  }
  async function tick(milliseconds) {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) {
      await page.clock.runFor(Math.min(100, milliseconds - elapsed))
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
    }
  }
  async function shot(name) {
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(width <= page.viewportSize().width, `overflow ${width}`)
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: 'disabled' })
  }
  async function start(character = 'penguin') {
    await open()
    await page.locator(`.life-character-choice[data-character="${character}"]`).click()
    await page.locator('.life-start').click()
    await page.locator('.life-play').waitFor()
  }
  async function close() {
    assert.deepEqual(state.errors, [])
    await context.close()
  }
  return { context, page, state, open, start, tick, shot, close, reply, turnComplete }
}

test('real voice transport plays the opening and consecutive replies with saved mute enabled', async () => {
  for (const character of ['penguin', 'panda', 'pero']) {
    const h = await fixture({ realVoice: true })
    try {
      await h.open()
      await h.page.locator(`.life-character-choice[data-character="${character}"]`).click()
      await h.page.locator('.life-start').click()
      await h.page.locator('.life-connecting .life-speech').waitFor()
      assert.equal(await h.page.locator('.life-speech').innerText(), 'Можно ли опаздывать? Как ты думаешь?')
      assert.equal(h.state.calls.some(c => c.endpoint.endsWith('/begin')), false)
      const unlocked = await h.page.evaluate(() => ({ created: window.lifeAudioContexts[0].createdInGesture, resumed: window.lifeAudioContexts[0].resumedInGesture }))
      assert.deepEqual(unlocked, { created: true, resumed: true })
      h.turnComplete()
      await h.page.locator('.life-play').waitFor()
      for (const [answer, response] of [
        ['Я думаю, нужно приходить вовремя.', 'Согласен! А если автобус опоздал?'],
        ['Можно предупредить друга.', 'Хорошая мысль! Как ты его предупредишь?'],
      ]) {
        h.state.socket.send(JSON.stringify({ serverContent: { inputTranscription: { text: answer } } }))
        h.reply(response)
        await h.page.getByText(response, { exact: true }).waitFor()
        assert.equal(await h.page.locator('.life-speech').getAttribute('lang'), 'ru')
        h.turnComplete()
        await h.tick(1100)
        assert.ok(h.state.session.transcript.includes(answer))
      }
      const output = await h.page.evaluate(() => ({ starts: window.lifeAudioStarts, muted: localStorage.getItem('rgg.audio-muted') }))
      assert.equal(output.muted, 'true', 'the game must not overwrite the saved preference')
      assert.equal(output.starts.length, 3)
      for (const chunk of output.starts) {
        assert.equal(chunk.state, 'running')
        assert.equal(chunk.rate, 24000)
        assert.ok(chunk.peak > .2, 'non-silent PCM must reach the audio destination')
      }
      assert.equal(h.state.voiceMessages[0].setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, { penguin: 'Fenrir', panda: 'Leda', pero: 'Puck' }[character])
      assert.ok(h.state.voiceMessages.some(m => m.clientContent?.turnComplete && m.clientContent.turns[0].parts[0].text.includes('Introduce')))
      await new Promise(resolve => setTimeout(resolve, 400))
      assert.ok(h.state.voiceMessages.some(m => m.realtimeInput?.audio?.data), 'microphone frames must keep reaching the conversation')
      await h.page.locator('.life-mic').click()
      await h.page.locator('.life-results').waitFor()
      assert.ok(await h.page.evaluate(() => window.lifeAudioContexts.every(c => c.state === 'closed')))
      assert.ok(await h.page.evaluate(() => window.lifeMicrophone.getTracks().every(t => t.readyState === 'ended')))
    } finally { await h.close() }
  }
})

test('other live voice sessions still respect the saved mute preference by default', async () => {
  const h = await fixture({ realVoice: true })
  try {
    await h.open()
    await h.page.evaluate(async () => {
      const { LiveVoiceSession } = await import('/src/lib/liveVoice.ts')
      const button = document.createElement('button')
      button.textContent = 'Test default voice session'
      button.onclick = () => {
        const noop = () => {}
        window.defaultVoice = new LiveVoiceSession({ connectUrl: 'wss://voice.example.test/BidiGenerateContent', token: 'test-only', model: 'test-voice', voiceName: 'Puck', languageCode: 'ru-RU', systemInstruction: 'Test conversation', openingCue: 'Introduce the topic.' }, {
          onStatus: noop, onConnected: noop, onInputTranscript: noop, onOutputTranscript: noop,
          onError: code => { throw new Error(code) }, onDropped: noop, onTurnComplete: noop, onSilenceTimeout: noop, onNoSpeech: noop,
        }, { continuous: true })
        void window.defaultVoice.start().then(() => { window.defaultVoiceStarted = true })
      }
      document.body.append(button)
    })
    await h.page.getByRole('button', { name: 'Test default voice session' }).click()
    await h.page.waitForFunction(() => window.lifeAudioContexts.length === 2)
    h.turnComplete()
    await h.page.waitForFunction(() => window.defaultVoiceStarted)
    h.reply('Продолжай, я слушаю.')
    h.turnComplete()
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(await h.page.evaluate(() => window.lifeAudioStarts.length), 0)
    await h.page.evaluate(() => window.defaultVoice.close())
    assert.ok(await h.page.evaluate(() => window.lifeAudioContexts.every(c => c.state === 'closed')))
  } finally { await h.close() }
})

test('streamed Russian words stay intact and silence requests a spoken follow-up', async () => {
  const h = await fixture({ realVoice: true })
  try {
    await h.open()
    await h.page.locator('.life-start').click()
    await h.page.locator('.life-connecting .life-speech').waitFor()
    h.turnComplete()
    await h.page.locator('.life-play').waitFor()
    for (const fragments of [
      ['При', 'вет', '! ', 'Как', ' кош', 'ка', '? ', 'Всё', ' хо', 'ро', 'шо', '?'],
      ['Ма', 'ма', ' мыла', ' раму. ', 'Да', ', да', '!'],
    ]) {
      for (const text of fragments) h.state.socket.send(JSON.stringify({ serverContent: { outputTranscription: { text } } }))
      await h.page.getByText(fragments.join(''), { exact: true }).waitFor()
      assert.equal(await h.page.locator('.life-speech').innerText(), fragments.join(''))
      h.turnComplete()
    }
    await new Promise(resolve => setTimeout(resolve, 200))
    await h.tick(4100)
    await h.page.getByText('Ты живёшь в городе или деревне?', { exact: true }).waitFor()
    const reminders = () => h.state.voiceMessages.filter(message => message.realtimeInput?.text)
    assert.equal(reminders().length, 1)
    assert.match(reminders()[0].realtimeInput.text, /\[learner_silent\]/)
    assert.equal(await h.page.evaluate(() => window.lifeAudioStarts.length), 2)
    h.turnComplete()
    await h.tick(2000)
    assert.equal(reminders().length, 1)
    assert.equal(h.state.session.transcript, '')
    assert.equal(h.state.session.score, 0)
    await h.page.locator('.life-mic').click()
    await h.page.locator('.life-results').waitFor()
    await h.tick(5000)
    assert.equal(reminders().length, 1)
  } finally { await h.close() }
})

test('silence reminders wait for speech and tutor turns, send once, and reset after learner speech', async () => {
  const h = await fixture()
  try {
    await h.start()
    await h.page.evaluate(() => { window.lifeMock.speaking = true })
    await h.tick(4500)
    assert.equal(await h.page.evaluate(() => window.lifeMock.reminders.length), 0)
    await h.page.evaluate(() => {
      window.lifeMock.speaking = false
      window.lifeMock.callbacks.onOutputTranscript('Где ты живёшь?')
      window.lifeMock.callbacks.onPlayback(true)
    })
    await h.tick(4500)
    assert.equal(await h.page.evaluate(() => window.lifeMock.reminders.length), 0)
    await h.page.evaluate(() => {
      window.lifeMock.callbacks.onPlayback(false)
      window.lifeMock.callbacks.onTurnComplete()
    })
    await h.tick(3000)
    assert.equal(await h.page.evaluate(() => window.lifeMock.reminders.length), 0)
    await h.tick(1200)
    assert.equal(await h.page.evaluate(() => window.lifeMock.reminders.length), 1)
    await h.page.evaluate(() => window.lifeMock.callbacks.onTurnComplete())
    await h.tick(1000)
    assert.equal(await h.page.evaluate(() => window.lifeMock.reminders.length), 1)
    await h.page.evaluate(() => { window.lifeMock.speaking = true })
    await h.tick(500)
    await h.page.evaluate(() => { window.lifeMock.speaking = false })
    await h.tick(4100)
    assert.equal(await h.page.evaluate(() => window.lifeMock.reminders.length), 2)
    await h.page.locator('.life-mic').click()
    await h.page.locator('.life-results').waitFor()
  } finally { await h.close() }
})

test('default-disabled route offers no way to start or request a microphone', async () => {
  const h = await fixture({ disabled: true })
  await h.open()
  assert.match(await h.page.locator('.life-notice').innerText(), /hali yoqilmagan/)
  assert.equal(await h.page.locator('.life-start').count(), 0)
  assert.equal(await h.page.evaluate(() => window.lifeMock.requests), 0)
  await h.close()
})

test('three costumes, responsive layout, topic mode/level, all locales and shelf route', async () => {
  for (const locale of ['uz', 'ru', 'en']) {
    const h = await fixture({ locale, desktop: locale === 'en' })
    await h.open()
    assert.equal(await h.page.locator('.life-character-choice').count(), 3)
    await h.shot(`setup-${locale}`)
    await h.page.getByRole('button', { name: 'B1', exact: true }).click()
    assert.equal(await h.page.locator('#life-topic').inputValue(), '16')
    await h.page.locator('.life-options fieldset').nth(1).getByRole('button').nth(1).click()
    assert.equal(await h.page.locator('#life-topic').inputValue(), '17')
    await h.page.locator('.life-character-choice[data-character="panda"]').click()
    await h.page.locator('.life-start').click()
    await h.page.locator('.life-play').waitFor()
    assert.equal(h.state.session.character, 'panda')
    assert.equal(h.state.session.level, 'B1')
    assert.equal(h.state.session.topicId, '17')
    await h.page.goto(`${BASE}/games`)
    await h.page.locator('a.life-card').waitFor()
    assert.equal(await h.page.locator('a.life-card').getAttribute('href'), '/games/fight-for-life')
    const images = h.page.locator('a.life-card img')
    assert.deepEqual(await images.evaluateAll(nodes => nodes.map(image => image.getAttribute('src'))), ['panda', 'penguin', 'pero'].map(name => `/games/fight-for-life/characters/${name}.webp`))
    await images.first().scrollIntoViewIfNeeded()
    await h.page.waitForFunction(() => [...document.querySelectorAll('a.life-card img')].every(image => image.complete && image.naturalWidth > 0))
    const boxes = await images.evaluateAll(nodes => nodes.map(image => { const { x, y, width, height } = image.getBoundingClientRect(); return { x, y, width, height } }))
    assert.ok(boxes.every(box => box.width > 0 && box.height > 0))
    assert.ok(boxes[0].x + boxes[0].width <= boxes[1].x && boxes[1].x + boxes[1].width <= boxes[2].x)
    await h.shot(`shelf-${locale}`)
    await h.close()
  }
})

test('each character reacts, fades during silence, freezes, and can replay', async () => {
  for (const character of ['penguin', 'panda', 'pero']) {
    const h = await fixture()
    await h.start(character)
    await h.page.evaluate(() => { window.lifeMock.speaking = true; window.lifeMock.callbacks.onInputTranscript('Я люблю изучать русский язык.') })
    await h.tick(2000)
    assert.equal(await h.page.locator('.life-play .life-scene').getAttribute('data-emotion'), 'speaking')
    await h.shot(`${character}-speaking`)
    await h.page.evaluate(() => { window.lifeMock.speaking = false })
    await h.tick(8500)
    assert.equal(await h.page.locator('.life-play .life-scene').getAttribute('data-emotion'), 'cold')
    await h.shot(`${character}-cold`)
    await h.tick(2000)
    await h.page.locator('.life-results').waitFor()
    assert.equal(h.state.session.outcome, 'silence')
    assert.ok(h.state.session.score >= 1 && h.state.session.score <= 3)
    assert.ok(await h.page.evaluate(() => window.lifeMock.closed) >= 1)
    await h.shot(`${character}-result`)
    await h.page.locator('.life-results .life-start').click()
    await h.page.locator('.life-choices').waitFor()
    await h.close()
  }
})

test('full spoken round wins; tutor playback does not award crystals', async () => {
  const h = await fixture()
  await h.start()
  await h.page.evaluate(() => { window.lifeMock.speaking = true; window.lifeMock.callbacks.onPlayback(true) })
  await h.tick(3000)
  assert.equal(await h.page.locator('.life-hud strong').innerText(), '0')
  await h.page.evaluate(() => { window.lifeMock.callbacks.onPlayback(false) })
  await h.tick(2000)
  assert.ok(Number(await h.page.locator('.life-hud strong').innerText()) > 0)
  await h.page.locator('.life-mic').click()
  await h.page.locator('.life-results').waitFor()
  await h.page.locator('.life-results .life-start').click()
  await h.page.locator('.life-start').click()
  await h.page.locator('.life-play').waitFor()
  await h.tick(120500)
  await h.page.locator('.life-results').waitFor()
  assert.equal(h.state.session.outcome, 'won')
  assert.equal(h.state.session.score, 120)
  await h.shot('won')
  await h.close()
})

test('microphone denial makes no paid session and can return to setup', async () => {
  const h = await fixture({ denied: true })
  await h.open()
  await h.page.locator('.life-start').click()
  await h.page.getByRole('alert').waitFor()
  assert.match(await h.page.getByRole('alert').innerText(), /Mikrofonga ruxsat/)
  assert.equal(h.state.calls.filter(c => c.endpoint.endsWith('/sessions')).length, 0)
  assert.ok(await h.page.evaluate(() => window.lifeAudioContexts.every(c => c.state === 'closed')))
  await h.page.getByRole('alert').getByRole('button').last().click()
  await h.page.locator('.life-choices').waitFor()
  await h.close()
})

test('manual stop while a heartbeat is pending is delivered after that heartbeat', async () => {
  const h = await fixture()
  await h.start()
  let unblock
  let reached
  const pending = new Promise(resolve => { reached = resolve })
  h.state.hold = new Promise(resolve => { unblock = resolve })
  h.state.release = reached
  await h.tick(1100)
  await pending
  await h.page.locator('.life-mic').click()
  unblock()
  await h.page.locator('.life-results').waitFor()
  assert.equal(h.state.session.outcome, 'stopped')
  assert.equal(h.state.calls.at(-1).body.finish, true)
  await h.close()
})

test('dropped connection closes audio, recovers result, and hard navigation finalizes', async () => {
  const h = await fixture()
  await h.start('panda')
  await h.page.evaluate(() => window.lifeMock.callbacks.onDropped())
  await h.page.getByRole('alert').waitFor()
  assert.ok(await h.page.evaluate(() => window.lifeMock.closed) >= 1)
  await h.page.getByRole('alert').getByRole('button').first().click()
  await h.page.locator('.life-results').waitFor()
  await h.page.locator('.life-results .life-start').click()
  await h.page.locator('.life-start').click()
  await h.page.locator('.life-play').waitFor()
  await h.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(h.state.calls.at(-1).body.finish, true)
  await h.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  await h.page.getByRole('alert').waitFor()
  await h.close()
})

test('BFCache return during microphone permission restores setup instead of hanging', async () => {
  const h = await fixture()
  await h.open()
  await h.page.evaluate(() => { window.lifeMock.pendingMicrophone = true })
  await h.page.locator('.life-start').click()
  await h.page.locator('.life-connecting').waitFor()
  await h.page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    window.lifeMock.resolveMicrophone()
  })
  await h.page.locator('.life-choices').waitFor()
  assert.equal(h.state.calls.filter(c => c.endpoint.endsWith('/sessions')).length, 0)
  assert.ok(await h.page.evaluate(() => window.lifeAudioContexts.every(c => c.state === 'closed')))
  await h.close()
})

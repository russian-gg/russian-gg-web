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

test('silence boundary and two minutes of learner speech exclude pauses', () => {
  const meter = new LifeMeter(0)
  assert.equal(meter.advance(9999, false, false), null)
  assert.equal(meter.advance(10000, false, false), 'silence')
  assert.equal(meter.emotion(false), 'frozen')
  const recovered = new LifeMeter(0)
  recovered.advance(9000, false, false)
  recovered.advance(9500, true, false)
  assert.equal(recovered.silenceMs, 0)
  assert.equal(recovered.speechMs, 500)
  assert.equal(recovered.advance(120000, true, false), null)
  assert.equal(recovered.speechMs, 111000)
  assert.equal(recovered.advance(128999, true, false), null)
  assert.equal(recovered.advance(129000, true, false), 'won')
  assert.equal(recovered.speechMs, 120000)
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
  constructor(ticket, callbacks, options) { this.callbacks = callbacks; this.playback = options.playbackContext; window.lifeMock.callbacks = callbacks; window.lifeMock.options = options }
  async start() {
    this.callbacks.onConnected();
    this.callbacks.onStatus('listening');
    this.interval = setInterval(() => this.callbacks.onInputLevel(window.lifeMock.speaking ? .08 : 0, window.lifeMock.speaking, 50), 50);
  }
  pauseInput() { clearInterval(this.interval) }
  requestTutorResponse(text) { window.lifeMock.reminders.push(text); return true }
  async finishWithFeedback(text) {
    this.pauseInput(); window.lifeMock.feedbackRequests.push(text);
    this.callbacks.onPlayback(true);
    this.callbacks.onOutputTranscript(text.includes('outcome=won') ? 'Победа! Отличная речь. Ты говоришь ясно. Добавь пример.' : 'Время вышло. Продолжай мысль. Попробуй начать с простого слова.');
    this.callbacks.onPlayback(false);
    await this.close();
  }
  async close() { if (this.closed) return; this.closed = true; clearInterval(this.interval); window.lifeMock.closed++; this.callbacks.onPlayback(false); await this.playback.close() }
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
  { id: 'v2-01', title: 'Любовь — это чувство или выбор?', level: 'A1', mode: 'both' },
  { id: 'v2-02', title: 'Вкусная еда или полезная еда?', level: 'A1', mode: 'both' },
  { id: 'v2-03', title: 'Утро или вечер?', level: 'A1', mode: 'both' },
  { id: 'v2-04', title: 'Кошки или собаки?', level: 'A1', mode: 'both' },
  { id: 'v2-05', title: 'Жить в городе или в деревне?', level: 'A1', mode: 'both' },
  { id: 'v2-06', title: 'Чай или кофе?', level: 'A1', mode: 'both' },
  { id: 'v2-07', title: 'Смотреть фильм дома или в кинотеатре?', level: 'A1', mode: 'both' },
  { id: 'v2-08', title: 'Спорт — это весело или трудно?', level: 'A1', mode: 'both' },
  { id: 'v2-09', title: 'Какая погода лучше: лето или зима?', level: 'A1', mode: 'both' },
  { id: 'v2-10', title: 'Читать книгу или слушать аудиокнигу?', level: 'A1', mode: 'both' },
  { id: 'v2-11', title: 'Красота спасёт мир?', level: 'A2', mode: 'both' },
  { id: 'v2-12', title: 'Нужно ли всегда говорить правду?', level: 'A2', mode: 'both' },
  { id: 'v2-13', title: 'Телефон — это друг или враг?', level: 'A2', mode: 'both' },
  { id: 'v2-14', title: 'Деньги могут купить счастье?', level: 'A2', mode: 'both' },
  { id: 'v2-15', title: 'Лучше работать одному или в команде?', level: 'A2', mode: 'both' },
  { id: 'v2-16', title: 'Учиться в университете или учиться онлайн?', level: 'A2', mode: 'both' },
  { id: 'v2-17', title: 'Можно ли прощать предательство?', level: 'A2', mode: 'both' },
  { id: 'v2-18', title: 'Идеальная работа — это хобби?', level: 'A2', mode: 'both' },
  { id: 'v2-19', title: 'Друзья важнее семьи?', level: 'A2', mode: 'both' },
  { id: 'v2-20', title: 'Нужно ли путешествовать одному?', level: 'A2', mode: 'both' },
  { id: 'v2-21', title: 'Опаздывать на встречу — это нормально?', level: 'B1', mode: 'both' },
  { id: 'v2-22', title: 'Искусственный интеллект заменит людей?', level: 'B1', mode: 'both' },
  { id: 'v2-23', title: 'Социальные сети делают нас одинокими?', level: 'B1', mode: 'both' },
  { id: 'v2-24', title: 'Свобода — это делать что хочешь или не делать чего не хочешь?', level: 'B1', mode: 'both' },
  { id: 'v2-25', title: 'Патриотизм — что это для тебя?', level: 'B1', mode: 'both' },
  { id: 'v2-26', title: 'Можно ли оправдать ложь ради спасения?', level: 'B1', mode: 'both' },
  { id: 'v2-27', title: 'Образование — это бизнес или служение?', level: 'B1', mode: 'both' },
  { id: 'v2-28', title: 'Мода: самовыражение или глупость?', level: 'B1', mode: 'both' },
  { id: 'v2-29', title: 'Карьера или семья? Что важнее?', level: 'B1', mode: 'both' },
  { id: 'v2-30', title: 'Что важнее: талант или упорный труд?', level: 'B1', mode: 'both' },
]
async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: options.desktop ? { width: 1280, height: 960 } : { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const state = { calls: [], errors: [], session: null, hold: null, release: null, voiceMessages: [], socket: null }
  await context.addInitScript(({ denied, locale, realVoice }) => {
    localStorage.setItem('rgg.access', 'local-life-game-test')
    localStorage.setItem('rgg.locale', locale)
    localStorage.setItem('rgg.install.never', 'true')
    localStorage.setItem('rgg.audio-muted', 'true')
    window.lifeMock = { denied, requests: 0, releases: 0, closed: 0, speaking: false, reminders: [], feedbackRequests: [] }
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
      if (data.clientContent) {
        const text = data.clientContent.turns[0].parts[0].text
        if (text.startsWith('[game_result]')) {
          socket.send(JSON.stringify({ serverContent: { interrupted: true, turnComplete: true } }))
          if (options.feedbackResponse !== false) reply('Время вышло. Твой результат: 0 секунд. Я не слышу ответ. Начни с простого слова.')
        } else reply('Можно ли опаздывать? Как ты думаешь?')
      }
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
        state.session = { id: 'session-1', status: 'ready', ...body, topic: { ...topics.find(t => t.id === body.topicId), mode: body.mode }, score: 0, speechMilliseconds: 0, silenceMilliseconds: 0, transcript: '' }
      } else if (endpoint.endsWith('/voice')) {
        state.session.status = 'connecting'
        return route.fulfill({ json: { sessionId: state.session.id, token: 'test-only', connectUrl: 'wss://voice.example.test/BidiGenerateContent', model: 'test-voice', voiceName: { penguin: 'Fenrir', panda: 'Leda', pero: 'Puck' }[state.session.character], languageCode: 'ru-RU', systemInstruction: 'Test Russian conversation', openingCue: 'Introduce the topic and invite the learner to speak.' } })
      } else if (endpoint.endsWith('/begin')) {
        state.session.status = 'playing'
      } else if (endpoint.endsWith('/activity')) {
        if (state.hold && !body.finish) { state.release?.(); await state.hold; state.hold = null }
        Object.assign(state.session, { speechMilliseconds: body.speechMilliseconds, silenceMilliseconds: body.silenceMilliseconds, transcript: body.transcript, score: Math.floor(body.speechMilliseconds / 1000) })
        const outcome = body.finish ? options.finishOutcome ?? 'stopped' : body.silenceMilliseconds >= 10000 ? 'silence' : body.speechMilliseconds >= 120000 ? 'won' : null
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
  async function start(character = 'penguin', mode = 'debate') {
    await open()
    if (mode === 'monologue') await page.locator('.life-options fieldset').nth(1).getByRole('button').nth(1).click()
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
    assert.equal(await h.page.locator('#life-topic').inputValue(), 'v2-21')
    await h.page.locator('.life-options fieldset').nth(1).getByRole('button').nth(1).click()
    assert.equal(await h.page.locator('#life-topic').inputValue(), 'v2-21')
    await h.page.locator('.life-character-choice[data-character="panda"]').click()
    await h.page.locator('.life-start').click()
    await h.page.locator('.life-play').waitFor()
    assert.equal(h.state.session.character, 'panda')
    assert.equal(h.state.session.level, 'B1')
    assert.equal(h.state.session.topicId, 'v2-21')
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

test('character decorations stay beside the mascot during speech and on results', async () => {
  for (const desktop of [false, true]) {
    for (const character of ['penguin', 'panda', 'pero']) {
      const h = await fixture({ desktop, finishOutcome: 'won' })
      try {
        await h.start(character)
        await h.page.evaluate(() => { window.lifeMock.speaking = true })
        await h.tick(300)
        for (const screen of ['play', 'results']) {
          if (screen === 'results') {
            await h.page.locator('.life-mic').click()
            await h.page.locator('.life-results').waitFor()
          }
          const scene = h.page.locator(`.life-${screen} .life-scene`)
          assert.equal(await scene.getAttribute('data-emotion'), screen === 'play' ? 'speaking' : 'won')
          const decorations = await scene.evaluate(node => {
            const puppet = node.querySelector('.life-puppet').getBoundingClientRect()
            const particles = node.querySelector('.life-particles')
            return {
              visible: getComputedStyle(particles).opacity === '1',
              positions: [...particles.querySelectorAll('svg')].map(icon => {
                const box = icon.getBoundingClientRect()
                return { width: box.width, beside: box.right <= puppet.left || box.left >= puppet.right }
              }),
            }
          })
          assert.ok(decorations.visible)
          assert.ok(decorations.positions.length > 0)
          assert.ok(decorations.positions.every(icon => icon.width > 0 && icon.beside), `${character} decorations overlap on ${screen}`)
          await h.shot(`decorations-${character}-${desktop ? 'desktop' : 'mobile'}-${screen}`)
        }
      } finally { await h.close() }
    }
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
    await h.page.clock.runFor(8200)
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
  assert.match(await h.page.locator('.life-victory').innerText(), /2:00 — G‘alaba!/)
  assert.equal(await h.page.locator('.life-confetti i').count(), 28)
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


test('all thirty topics stay at their selected level in both modes', async () => {
  const h = await fixture()
  try {
    await h.open()
    for (const level of ['A1', 'A2', 'B1']) {
      await h.page.getByRole('button', { name: level, exact: true }).click()
      for (const mode of [0, 1]) {
        await h.page.locator('.life-options fieldset').nth(1).getByRole('button').nth(mode).click()
        const ids = await h.page.locator('#life-topic option').evaluateAll(nodes => nodes.map(node => node.value))
        assert.deepEqual(ids, topics.filter(topic => topic.level === level).map(topic => topic.id))
        assert.equal(ids.length, 10)
      }
    }
    await h.page.locator('.life-start').click()
    await h.page.locator('.life-play').waitFor()
    assert.equal(h.state.session.mode, 'monologue')
    assert.equal(h.state.session.level, 'B1')
    const stop = await h.page.locator('.life-mic').evaluate(node => ({ width: node.getBoundingClientRect().width, background: getComputedStyle(node).backgroundImage }))
    assert.ok(stop.width >= 44 && stop.width <= 76)
    assert.match(stop.background, /237, 104, 31/)
    await h.shot('compact-stop')
  } finally { await h.close() }
})

test('monologue stays silent after opening and plays final feedback before closing audio', async () => {
  const h = await fixture({ realVoice: true })
  try {
    await h.open()
    await h.page.locator('.life-options fieldset').nth(1).getByRole('button').nth(1).click()
    await h.page.locator('.life-start').click()
    await h.page.locator('.life-connecting .life-speech').waitFor()
    h.turnComplete()
    await h.tick(300)
    await h.page.locator('.life-play').waitFor()
    assert.equal(await h.page.evaluate(() => window.lifeAudioStarts.length), 1)
    h.reply('Эта реплика не должна прозвучать.')
    h.turnComplete()
    await h.tick(4500)
    assert.equal(await h.page.evaluate(() => window.lifeAudioStarts.length), 1)
    assert.equal(await h.page.getByText('Эта реплика не должна прозвучать.').count(), 0)
    assert.equal(h.state.voiceMessages.filter(m => m.realtimeInput?.text).length, 0)
    await h.tick(6000)
    await h.page.locator('.life-results').waitFor()
    await h.page.locator('.life-feedback').waitFor()
    assert.match(await h.page.locator('.life-feedback').innerText(), /Твой результат: 0 секунд/)
    assert.equal(await h.page.evaluate(() => window.lifeAudioStarts.length), 2)
    assert.equal(await h.page.locator('.life-victory').count(), 0)
    const signal = h.state.voiceMessages.find(m => m.clientContent?.turns[0].parts[0].text.startsWith('[game_result]'))
    assert.match(signal.clientContent.turns[0].parts[0].text, /outcome=silence; speechSeconds=0/)
    h.turnComplete()
    await h.tick(500)
    assert.ok(await h.page.evaluate(() => window.lifeAudioContexts.every(context => context.state === 'closed')))
    await h.shot('monologue-feedback')
  } finally { await h.close() }
})

test('monologue victory announces measured speech and can replay without stale feedback', async () => {
  const h = await fixture()
  try {
    await h.start('panda', 'monologue')
    assert.equal(await h.page.evaluate(() => window.lifeMock.options.listenOnlyAfterOpening), true)
    await h.page.evaluate(() => { window.lifeMock.speaking = true })
    await h.tick(120500)
    await h.page.locator('.life-results').waitFor()
    assert.equal(h.state.session.speechMilliseconds, 120000)
    assert.match(await h.page.locator('.life-victory').innerText(), /2:00/)
    assert.match(await h.page.locator('.life-feedback').innerText(), /Победа! Отличная речь/)
    assert.deepEqual(await h.page.evaluate(() => window.lifeMock.reminders), [])
    const signals = await h.page.evaluate(() => window.lifeMock.feedbackRequests)
    assert.equal(signals.length, 1)
    assert.match(signals[0], /outcome=won; speechSeconds=120/)
    await h.page.locator('.life-results .life-start').click()
    assert.equal(await h.page.locator('.life-feedback').count(), 0)
    await h.page.locator('.life-start').click()
    await h.page.locator('.life-play').waitFor()
    await h.page.locator('.life-mic').click()
    await h.page.locator('.life-results').waitFor()
    assert.equal(await h.page.locator('.life-feedback').count(), 0)
    assert.equal(await h.page.locator('.life-victory').count(), 0)
    assert.equal(await h.page.evaluate(() => window.lifeMock.feedbackRequests.length), 1)
  } finally { await h.close() }
})


test('missing final voice cannot erase the saved result or keep the microphone open', async () => {
  for (const action of ['timeout', 'disconnect', 'replay']) {
    const h = await fixture({ realVoice: true, feedbackResponse: false })
    try {
      await h.open()
      await h.page.locator('.life-options fieldset').nth(1).getByRole('button').nth(1).click()
      await h.page.locator('.life-start').click()
      await h.page.locator('.life-connecting .life-speech').waitFor()
      h.turnComplete()
      await h.tick(300)
      await h.page.locator('.life-play').waitFor()
      await h.tick(10500)
      await h.page.locator('.life-results').waitFor()
      assert.ok(h.state.voiceMessages.some(m => m.clientContent?.turns[0].parts[0].text.startsWith('[game_result]')))
      if (action === 'timeout') await h.page.clock.runFor(20001)
      else if (action === 'disconnect') h.state.socket.close({ code: 1011, reason: 'test failure' })
      else await h.page.locator('.life-results .life-start').click()
      await h.page.waitForFunction(() => window.lifeAudioContexts.every(context => context.state === 'closed'))
      assert.equal(await h.page.getByRole('alert').count(), 0)
      assert.equal(await h.page.locator('.life-victory').count(), 0)
      if (action === 'replay') await h.page.locator('.life-choices').waitFor()
      else {
        assert.equal(h.state.session.outcome, 'silence')
        assert.equal(await h.page.locator('.life-results').count(), 1)
      }
    } finally { await h.close() }
  }
})

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test, before, after } = require('node:test')
const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH || (() => {
  try { return require.resolve('playwright') }
  catch { return path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright') }
})()
const { chromium } = require(playwrightPath)

const BASE = 'http://127.0.0.1:5181'
const ROOT = '/api/speaking-games'
const SHOTS = fs.mkdtempSync(path.join(os.tmpdir(), 'russian-speaking-games-'))
const SLUGS = ['tez-gapir', 'error-hunt', 'first-reaction', 'ice-mystery']
const SIZES = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 960 } }
const COPY = {
  en: { start: 'Start', panda: 'Panda', level: 'Level', theme: 'Topic', rounds: 'Round', weekly: 'Weekly leaderboard', all: 'All time', progress: 'Results and achievements', titles: ['Speak fast', 'Error hunter', 'First reaction', 'Mystery of the ice city'] },
  uz: { start: 'Boshlash', panda: 'Panda', level: 'Daraja', theme: 'Mavzu', rounds: 'Raund', weekly: 'Haftalik reyting', all: 'Barcha vaqt', progress: 'Natijalar va yutuqlar', titles: ['Tez gapir', 'Xato ovchisi', 'Birinchi reaksiya', 'Muzli shahar siri'] },
  ru: { start: '\u041d\u0430\u0447\u0430\u0442\u044c', panda: '\u041f\u0430\u043d\u0434\u0430', level: '\u0423\u0440\u043e\u0432\u0435\u043d\u044c', theme: '\u0422\u0435\u043c\u0430', rounds: '\u0420\u0430\u0443\u043d\u0434', weekly: '\u0420\u0435\u0439\u0442\u0438\u043d\u0433 \u0437\u0430 \u043d\u0435\u0434\u0435\u043b\u044e', all: '\u0417\u0430 \u0432\u0441\u0451 \u0432\u0440\u0435\u043c\u044f', progress: '\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0438 \u0434\u043e\u0441\u0442\u0438\u0436\u0435\u043d\u0438\u044f', titles: ['\u0413\u043e\u0432\u043e\u0440\u0438 \u0431\u044b\u0441\u0442\u0440\u043e', '\u041b\u043e\u0432\u0435\u0446 \u043e\u0448\u0438\u0431\u043e\u043a', '\u041f\u0435\u0440\u0432\u0430\u044f \u0440\u0435\u0430\u043a\u0446\u0438\u044f', '\u0422\u0430\u0439\u043d\u0430 \u043b\u0435\u0434\u044f\u043d\u043e\u0433\u043e \u0433\u043e\u0440\u043e\u0434\u0430'] },
}
const READY = { en: 'Ready', uz: 'Tayyorman', ru: '\u042f \u0433\u043e\u0442\u043e\u0432' }
const ANSWER = '\u042f \u043b\u044e\u0431\u043b\u044e \u0440\u0443\u0441\u0441\u043a\u0438\u0439 \u044f\u0437\u044b\u043a.'
const QUESTION = '\u0413\u0434\u0435 \u0432\u044b \u0431\u044b\u043b\u0438 \u0432\u0447\u0435\u0440\u0430?'
const ACCUSATION = '\u041b\u0438\u0441\u0430 \u0443\u043a\u0440\u0430\u043b\u0430 \u0440\u044b\u0431\u0443, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u043d\u0430 \u0441\u043d\u0435\u0433\u0443 \u0435\u0441\u0442\u044c \u0435\u0451 \u0441\u043b\u0435\u0434\u044b.'
const LOCATIONS = ['square', 'bakery', 'post-office', 'library', 'harbour'].map((id, index) => ({
  id, titleRu: ['\u041f\u043b\u043e\u0449\u0430\u0434\u044c', '\u041f\u0435\u043a\u0430\u0440\u043d\u044f', '\u041f\u043e\u0447\u0442\u0430', '\u0411\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430', '\u041f\u043e\u0440\u0442'][index],
  character: ['penguin', 'bear', 'fox', 'panda', 'pero'][index], characterNameRu: `Witness ${index + 1}`,
  questionsAsked: 0, maxQuestions: 10, visited: false,
}))
const clone = (value) => structuredClone(value)
const now = () => new Date().toISOString()
const button = (page, name) => page.getByRole('button', { name, exact: true })
let browser

before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }) })
after(async () => { await browser?.close(); console.log(`Screenshots: ${SHOTS}`) })

function catalog() {
  return SLUGS.map((slug, index) => ({
    slug, titleRu: COPY.ru.titles[index], titleUz: COPY.uz.titles[index], descriptionRu: `Game ${index + 1}`,
    isEnabled: true, isAccessible: true, lockReason: null,
    durationSeconds: [30, 10, 5, 60][index], totalRounds: [3, 2, 7, 50][index], levels: ['A1', 'A2', 'B1'],
    themes: [{ id: 'food-a1', titleRu: 'Food A1', titleUz: 'Taom A1', level: 'A1' }, { id: 'work-a2', titleRu: 'Work A2', titleUz: 'Ish A2', level: 'A2' }],
  }))
}

function prompt(slug, round = 0, locationId = null) {
  return { id: locationId ?? `${slug}-${round}`, textRu: `${locationId ? QUESTION : ANSWER} ${round + 1}`, titleUz: 'Ruscha javob bering', kind: slug, scene: locationId, options: [] }
}

function readyPrompt(slug, round = 0, locationId = null) {
  if (slug === 'ice-mystery') return prompt(slug, round, locationId)
  return { id: `ready-${round}`, kind: 'ready', textRu: '', titleUz: null, scene: null, options: [] }
}

function feedback(text) {
  return { answer: text, correct: true, points: 7, explanation: 'Mock explanation: complete and relevant sentence.', correctAnswer: ANSWER,
    criteria: [{ code: 'grammar', label: 'Grammar', passed: true, points: 2 }, { code: 'speed', label: 'Speed', passed: true, points: 3 }, { code: 'relevance', label: 'Relevance', passed: true, points: 2 }],
    words: [{ text: '\u044f\u0437\u044b\u043a', category: 'unique', points: 1 }, { text: '\u044f\u0437\u044b\u043a', category: 'repeat', points: -1 }],
    characterPhrase: 'Mock witness response: follow the tracks.', evaluationKind: 'mock' }
}

function makeSession(slug, settings = {}) {
  const game = catalog().find((entry) => entry.slug === slug)
  return { id: `mock-${slug}-saved`, gameSlug: slug, version: 1, status: 'ready', character: 'penguin', level: 'A1', score: 0, roundIndex: 0,
    totalRounds: game.totalRounds, durationSeconds: game.durationSeconds, roundStartedAt: null, deadlineUtc: null, serverNowUtc: now(),
    prompt: !settings.status || settings.status === 'ready' ? readyPrompt(slug) : prompt(slug), feedback: null, history: [], clues: [], locations: slug === 'ice-mystery' ? clone(LOCATIONS) : [], achievements: [], summary: null,
    availableActions: ['begin', 'end', ...(slug === 'ice-mystery' ? ['visit'] : [])], pendingAnswer: null, ...settings }
}

function complete(session, won = null) {
  session.status = 'completed'
  session.deadlineUtc = null
  session.availableActions = []
  session.summary = { score: session.score, bestScore: session.score, isNewBest: true, correctAnswers: session.history.length, roundsPlayed: session.history.length, won,
    rewardPoints: 12, dailyReward: 5, cityPoints: 112, cityObjects: ['house', ...(won ? ['detective-agency'] : [])] }
  session.achievements = [{ code: 'mock-achievement', titleRu: 'Mock achievement', reward: 12, unlockedAt: now() }]
}

function model(options) {
  const state = { games: catalog(), sessions: new Map(), calls: [], errors: [], requests: new Map(), failures: options.failAnswers ?? (options.answerError ? 1 : 0), starts: 0 }
  if (options.access) Object.assign(state.games.find((game) => game.slug === options.slug), options.access)
  if (options.saved) state.sessions.set(options.saved.id, clone(options.saved))
  state.handle = (method, url, body) => {
    const endpoint = url.pathname
    if (method === 'GET' && endpoint === `${ROOT}/catalog`) return state.games
    if (method === 'GET' && endpoint === `${ROOT}/dashboard`) return { cityPoints: 100, cityObjects: ['house'], dailyStreak: 2, achievements: [], bestScores: { [options.slug]: 21 }, sessionsPlayed: 4,
      dailyChallenges: SLUGS.map((gameSlug) => ({ gameSlug, completed: 1, target: 3, reward: 5 })),
      activeSessions: [...state.sessions.values()].filter((session) => session.status !== 'completed').map(({ id, gameSlug, status }) => ({ id, gameSlug, status })) }
    const parts = endpoint.slice(ROOT.length + 1).split('/')
    const [slug, id, action] = parts
    assert.ok(SLUGS.includes(slug), `unknown game route: ${method} ${endpoint}`)
    if (id === 'leaderboard' && method === 'GET') {
      assert.ok(['weekly', 'all'].includes(url.searchParams.get('period')), 'leaderboard must send period=weekly|all')
      state.calls.push({ action: 'leaderboard', slug, period: url.searchParams.get('period') })
      return [{ rank: 1, displayName: `Mock ${url.searchParams.get('period')} winner`, score: 99, durationSeconds: 30, isCurrentUser: false }, { rank: 2, displayName: 'Mock learner', score: 21, durationSeconds: 30, isCurrentUser: true }]
    }
    state.calls.push({ action: id === 'start' ? 'start' : action ?? 'session', slug, id, body: clone(body) })
    if (id === 'start' && method === 'POST') {
      assert.match(body.requestId, /^[\da-f-]{36}$/i)
      assert.ok(['penguin', 'panda', 'pero'].includes(body.character))
      const session = makeSession(slug, { id: `mock-${slug}-${++state.starts}`, character: body.character, level: body.level })
      if (slug === 'tez-gapir') {
        assert.ok([3, 4, 5].includes(body.rounds))
        assert.ok(state.games.find((game) => game.slug === slug).themes.some((theme) => theme.id === body.themeId && theme.level === body.level))
        session.totalRounds = body.rounds
      }
      state.sessions.set(session.id, session)
      return session
    }
    const session = state.sessions.get(id)
    assert.ok(session, `unknown session ${id}`)
    assert.equal(session.gameSlug, slug, 'session requests must carry the correct slug')
    if (method === 'GET' && !action) return { ...session, serverNowUtc: now() }
    assert.equal(method, 'POST')
    if (action === 'tts') throw new Error('Muted preference must suppress TTS requests')
    assert.match(body.requestId, /^[\da-f-]{36}$/i)
    assert.equal(body.expectedVersion, session.version, `${action} must use the latest session version`)
    if (state.requests.has(body.requestId)) assert.deepEqual(body, state.requests.get(body.requestId), 'retry must preserve its entire request body')
    else state.requests.set(body.requestId, clone(body))
    if (action === 'answer' && state.failures-- > 0) {
      if (options.answerError === 409) {
        session.version++
        session.status = 'feedback'
        session.deadlineUtc = null
        session.feedback = feedback('Recovered server answer')
        session.score = 7
        session.history.push({ roundIndex: session.roundIndex, prompt: clone(session.prompt), feedback: clone(session.feedback), answeredAt: now(), locationId: null })
        session.availableActions = ['next', 'end']
      }
      return { failure: options.answerError ?? 503 }
    }
    if (action === 'begin') {
      assert.equal(session.status, 'ready', 'begin must not restart an answering or feedback session')
      session.status = 'answering'
      session.prompt = prompt(slug, session.roundIndex, body.locationId)
      session.roundStartedAt = now()
      session.deadlineUtc = new Date(Date.now() + session.durationSeconds * 1000).toISOString()
      session.availableActions = ['answer']
    } else if (action === 'visit') {
      assert.equal(slug, 'ice-mystery')
      assert.equal(session.status, 'ready', 'visit is ready-only; feedback must use next(location)')
      const location = session.locations.find((entry) => entry.id === body.locationId)
      assert.ok(location && location.questionsAsked < location.maxQuestions)
      location.visited = true
      session.status = 'ready'
      session.prompt = prompt(slug, session.roundIndex, body.locationId)
      session.feedback = null
      session.availableActions = ['begin', 'visit', 'end']
    } else if (action === 'answer') {
      if (body.action === 'accuse') assert.ok(['ready', 'feedback', 'answering'].includes(session.status))
      else assert.equal(session.status, 'answering')
      assert.equal(typeof body.text, 'string')
      assert.ok(body.text.trim(), 'this fixture expects a substantive answer')
      assert.equal(body.action, slug === 'ice-mystery' ? body.locationId ? 'question' : 'accuse' : 'answer')
      session.feedback = feedback(body.text)
      session.score += session.feedback.points
      session.history.push({ roundIndex: session.roundIndex, prompt: clone(session.prompt), feedback: clone(session.feedback), answeredAt: now(), locationId: body.locationId ?? null })
      session.deadlineUtc = null
      session.pendingAnswer = null
      session.status = 'feedback'
      session.availableActions = ['next', 'end']
      if (body.action === 'question') {
        const location = session.locations.find((entry) => entry.id === body.locationId)
        assert.ok(location)
        location.questionsAsked++
        if (!session.clues.some((clue) => clue.locationId === location.id)) session.clues.push({ id: `clue-${location.id}`, locationId: location.id, textRu: `Clue ${location.id}: ${ANSWER}` })
      }
      if (body.action === 'accuse') {
        assert.equal(session.clues.length, 5)
        assert.equal(body.text, ACCUSATION)
        assert.equal(body.suspectId, undefined, 'accusation is inferred from spoken text, not a suspect selector')
        complete(session, true)
      }
    } else if (action === 'next') {
      assert.equal(session.status, 'feedback', 'next requires explicit feedback acknowledgement')
      if (slug !== 'ice-mystery' && session.history.length === session.totalRounds) complete(session)
      else {
        session.roundIndex++
        session.status = 'ready'
        session.feedback = null
        session.prompt = readyPrompt(slug, session.roundIndex, body.locationId)
        if (slug === 'ice-mystery' && body.locationId) session.locations.find((location) => location.id === body.locationId).visited = true
        session.availableActions = ['begin', 'end', ...(slug === 'ice-mystery' ? ['visit'] : [])]
      }
    } else if (action === 'end') complete(session)
    else throw new Error(`Unexpected command ${action}`)
    session.version++
    session.serverNowUtc = now()
    return session
  }
  return state
}

function installSpeech({ locale, unsupported }) {
  localStorage.setItem('rgg.access', 'local-speaking-games-test-only')
  localStorage.setItem('rgg.locale', locale)
  localStorage.setItem('rgg.audio-muted', 'true')
  localStorage.setItem('rgg.theme', 'light')
  const instances = []
  const emit = (recognition, text, final) => {
    const result = [{ transcript: text, confidence: 1 }]
    result.isFinal = final
    recognition.onresult?.({ resultIndex: 0, results: [result] })
  }
  class Recognition {
    constructor() { this.active = false; this.starts = 0; this.stops = 0; this.aborts = 0; instances.push(this) }
    start() { this.starts++; this.active = true }
    stop() {
      this.stops++
      this.active = false
      queueMicrotask(() => {
        if (this.finalOnStop !== undefined) emit(this, this.finalOnStop, true)
        this.onend?.()
      })
    }
    abort() { this.aborts++; this.active = false }
  }
  window.SpeechRecognition = unsupported ? undefined : Recognition
  window.webkitSpeechRecognition = unsupported ? undefined : Recognition
  const last = () => {
    const value = instances.at(-1)
    if (!value) throw new Error('No mock recognizer has started')
    return value
  }
  window.__gameSpeech = {
    started() { last().onstart?.() },
    result(text, final = false) { emit(last(), text, final) },
    finalOnStop(text) { last().finalOnStop = text },
    error(error) { last().active = false; last().onerror?.({ error }); last().onend?.() },
    end() { last().active = false; last().onend?.() },
    snapshot() { return instances.map(({ active, starts, stops, aborts, lang }) => ({ active, starts, stops, aborts, lang })) },
  }
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { throw new Error('Real microphone access forbidden by test harness') }
}

async function until(check, message) {
  const end = Date.now() + 6000
  do {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  } while (Date.now() < end)
  assert.fail(message)
}

async function noOverflow(page) {
  const size = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
  size.viewport = page.viewportSize().width
  assert.ok(size.document <= size.viewport + 1 && size.body <= size.viewport + 1, `horizontal overflow: ${JSON.stringify(size)}`)
}

async function screenshot(page, name) {
  await noOverflow(page)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: 'disabled' })
}

async function fixture(options = {}) {
  options = { slug: 'tez-gapir', locale: 'en', size: 'mobile', ...options }
  const context = await browser.newContext({ viewport: SIZES[options.size], isMobile: options.size === 'mobile', hasTouch: options.size === 'mobile', serviceWorkers: 'block', reducedMotion: 'reduce', timezoneId: 'Asia/Tashkent' })
  const state = model(options)
  const errors = []
  await context.addInitScript(installSpeech, options)
  await context.routeWebSocket('**/*', (socket) => socket.close())
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== BASE) return route.fulfill({ status: 204, body: '' })
    if (!url.pathname.startsWith('/api/')) {
      if (request.method() !== 'GET') { state.errors.push(`Non-API write: ${request.method()} ${url.pathname}`); return route.abort() }
      return route.continue()
    }
    try {
      const method = request.method()
      const endpoint = url.pathname
      if (endpoint === '/api/auth/me' && method === 'GET') return route.fulfill({ json: { id: 'mock-speaking-learner', displayName: 'Mock learner', role: 'Learner', uiLanguage: options.locale, phoneNumberConfirmed: true, phoneConfirmed: true, hasCompletedDiagnostic: true, tier: 'Free', timeZoneId: 'Asia/Tashkent' } })
      if (endpoint === '/api/billing/welcome-gift') return route.fulfill({ json: { isAvailable: false, isClaimed: true, isDiscountActive: false } })
      if (endpoint === '/api/billing/entitlement') return route.fulfill({ json: { tier: 'Free', isPro: false } })
      if (endpoint === '/api/course/progress') return route.fulfill({ json: { currentDay: 2 } })
      if (endpoint === '/api/lesson-feedback') return route.fulfill({ json: { isDue: false } })
      if (endpoint === '/api/games') return route.fulfill({ json: state.games.map((game) => ({ ...game, bodyUz: game.descriptionRu, isBuilt: true })) })
      if (endpoint.startsWith('/api/analytics/')) return route.fulfill({ status: 204 })
      assert.ok(endpoint.startsWith(`${ROOT}/`), `Unmocked API: ${method} ${endpoint}`)
      assert.equal(request.headers().authorization, 'Bearer local-speaking-games-test-only')
      assert.equal(request.headers()['accept-language'], options.locale)
      const response = state.handle(method, url, request.postDataJSON())
      if (response.failure) return route.fulfill({ status: response.failure, json: { code: 'mock_retry_required', message: response.failure === 400 ? 'Name the culprit and explain why.' : 'Deliberate answer failure' } })
      return route.fulfill({ json: clone(response) })
    } catch (error) {
      state.errors.push(error.message)
      return route.fulfill({ status: 500, json: { code: 'mock_contract_violation', message: error.message } })
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.clock.install()
  const h = { context, page, state, errors, options,
    calls(action) { return state.calls.filter((call) => call.action === action) },
    session() { return [...state.sessions.values()].at(-1) },
    async open(suffix = '') {
      await page.goto(`${BASE}/games/${options.slug}${suffix}`)
      await page.locator(`main[data-game="${options.slug}"]`).waitFor()
      await until(async () => await page.locator('.sg-setup, .sg-hud, .sg-score-big, .sg-error').count() > 0, 'game must finish loading')
      assert.equal(new URL(page.url()).pathname, `/games/${options.slug}`)
      await noOverflow(page)
    },
    async start() {
      await h.open()
      await button(page, COPY[options.locale].start).click()
      await page.locator('.sg-hud').waitFor()
      assert.equal(h.calls('start').length, 1)
      assert.equal(new URL(page.url()).searchParams.get('session'), h.session().id)
    },
  }
  return h
}

function scenario(name, options, action) {
  test(name, { timeout: 90000 }, async () => {
    const h = await fixture(options)
    try {
      await action(h)
      assert.deepEqual(h.state.errors, [], 'all requests must satisfy the mocked API contract')
      assert.deepEqual(h.errors, [], 'no uncaught browser errors')
      await noOverflow(h.page)
    } catch (error) {
      console.error(`DETAIL ${name}: ${error.message}; contract=${JSON.stringify(h.state.errors)}; browser=${JSON.stringify(h.errors)}`)
      await h.page.screenshot({ path: path.join(SHOTS, `FAIL-${name.replace(/[^a-z0-9-]/gi, '_')}.png`), fullPage: true, animations: 'disabled' }).catch(() => {})
      throw error
    } finally { await h.context.close() }
  })
}

async function beginVoice(h, alreadyAnswering = false, accusation = false) {
  const count = h.calls('begin').length
  const before = await h.page.evaluate(() => window.__gameSpeech.snapshot().length)
  const hidden = !alreadyAnswering && !accusation && h.options.slug !== 'ice-mystery'
  if (hidden) {
    assert.equal(h.session().prompt.kind, 'ready')
    await h.page.getByRole('heading', { name: 'Ready', exact: true }).waitFor()
    assert.equal(await button(h.page, 'Listen').count(), 0)
    assert.equal(await h.page.locator('.sg-reaction-scene').count(), 0)
    assert.equal((await h.page.locator('.sg-board').innerText()).includes(prompt(h.options.slug, h.session().roundIndex).textRu), false)
  }
  await button(h.page, 'Speak').click()
  await h.page.waitForFunction((count) => window.__gameSpeech.snapshot().length === count + 1, before)
  await h.page.clock.fastForward(500)
  assert.equal(h.calls('begin').length, count, 'begin API must wait for microphone onstart')
  assert.equal(h.session().status, alreadyAnswering ? 'answering' : 'ready')
  if (hidden) assert.equal(await h.page.locator('.sg-prompt').innerText(), 'Ready', 'question must remain hidden while the microphone connects')
  await h.page.evaluate(() => window.__gameSpeech.started())
  if (!alreadyAnswering && !accusation) await until(() => h.calls('begin').length === count + 1, 'microphone onstart must begin the round exactly once')
  await h.page.getByRole('status').filter({ hasText: 'Listening. Speak in Russian.' }).waitFor()
  assert.equal(h.session().status, accusation ? 'ready' : 'answering')
  if (accusation) assert.equal(h.calls('begin').length, count, 'accusation records locally without a begin command')
  if (hidden) {
    await h.page.getByRole('heading', { name: h.session().prompt.textRu, exact: true }).waitFor()
    assert.notEqual(h.session().prompt.kind, 'ready')
    assert.equal(await h.page.locator('.sg-prompt').getAttribute('lang'), 'ru')
    if (h.options.slug === 'first-reaction') assert.equal(await h.page.locator('.sg-reaction-scene').count(), 1)
  }
  const recognizers = await h.page.evaluate(() => window.__gameSpeech.snapshot())
  assert.equal(recognizers.at(-1).lang, 'ru-RU')
}

async function sendVoice(h, text = ANSWER, deadline = false) {
  const count = h.calls('answer').length
  await h.page.evaluate((text) => { window.__gameSpeech.result(text.slice(0, 8), false); window.__gameSpeech.finalOnStop(text) }, text)
  if (deadline) {
    await h.page.clock.fastForward(h.session().durationSeconds * 1000 - 2000)
    assert.equal(h.calls('answer').length, count, 'the deadline must not submit two seconds early')
    await h.page.clock.fastForward(2250)
  }
  else await button(h.page, h.options.slug === 'tez-gapir' ? 'Finish' : 'Submit answer').click()
  await until(() => h.calls('answer').length === count + 1, 'answer must be submitted once')
  assert.equal(h.calls('answer').at(-1).body.text, text, 'submission must include the final event emitted during stop')
}

async function checkFeedback(h, text = ANSWER) {
  const panel = h.page.getByRole('region', { name: 'Review your results', exact: true })
  await panel.waitFor()
  assert.equal(h.session().status, 'feedback')
  assert.ok((await panel.innerText()).includes(text))
  assert.ok((await h.page.locator('.sg-board').innerText()).includes('Mock explanation'))
  assert.equal(await panel.locator('[data-positive="true"]').count(), 4)
  assert.equal(await panel.locator('[data-positive="false"]').count(), 1)
  const nexts = h.calls('next').length
  const version = h.session().version
  await h.page.clock.fastForward(65000)
  assert.equal(h.calls('next').length, nexts, 'feedback may not advance without an explicit Next click')
  assert.equal(h.session().version, version)
  assert.equal(await button(h.page, 'Next').isEnabled(), true)
  await noOverflow(h.page)
}

for (const size of Object.keys(SIZES)) {
  for (const locale of Object.keys(COPY)) {
    for (const slug of SLUGS) {
      scenario(`setup ${slug} ${locale} ${size}`, { slug, locale, size }, async (h) => {
        const c = COPY[locale]
        await h.open()
        await h.page.getByRole('heading', { name: c.titles[SLUGS.indexOf(slug)], exact: true }).waitFor()
        await button(h.page, c.panda).click()
        assert.equal(await button(h.page, c.panda).getAttribute('aria-pressed'), 'true')
        if (slug !== 'ice-mystery') await h.page.getByLabel(c.level).selectOption('A2')
        if (slug === 'tez-gapir') {
          await h.page.getByLabel(c.theme).selectOption('work-a2')
          await h.page.getByLabel(c.rounds).selectOption('5')
          const themes = await h.page.getByLabel(c.theme).locator('option').allTextContents()
          assert.deepEqual(themes, [locale === 'uz' ? 'Ish A2' : 'Work A2'])
        }
        await h.page.getByRole('tab', { name: c.all, exact: true }).click()
        await h.page.getByRole('cell', { name: 'Mock all winner', exact: true }).waitFor()
        assert.equal(h.calls('leaderboard').at(-1).period, 'all')
        await h.page.getByRole('tab', { name: c.progress, exact: true }).click()
        assert.ok((await h.page.getByRole('tabpanel').innerText()).includes('100'))
        assert.equal(await h.page.getByRole('progressbar').getAttribute('value'), '1')
        assert.equal(await h.page.getByRole('progressbar').getAttribute('max'), '3')
        await h.page.getByRole('tab', { name: c.weekly, exact: true }).click()
        await h.page.getByRole('cell', { name: 'Mock weekly winner', exact: true }).waitFor()
        await screenshot(h.page, `setup-${slug}-${locale}-${size}`)
        await button(h.page, c.start).click()
        await h.page.locator('.sg-hud').waitFor()
        const body = h.calls('start')[0].body
        assert.equal(body.character, 'panda')
        assert.equal(body.level, slug === 'ice-mystery' ? 'A1' : 'A2')
        if (slug === 'tez-gapir') { assert.equal(body.rounds, 5); assert.equal(body.themeId, 'work-a2') }
        else assert.equal(body.themeId, undefined)
        assert.equal(h.session().status, 'ready')
        assert.equal(h.calls('begin').length, 0)
        assert.deepEqual(await h.page.evaluate(() => window.__gameSpeech.snapshot()), [])
        if (slug !== 'ice-mystery') {
          await h.page.getByRole('heading', { name: READY[locale], exact: true }).waitFor()
          assert.equal(h.session().prompt.textRu, '')
        }
      })
    }
  }

  for (const slug of SLUGS.filter((slug) => slug !== 'ice-mystery')) {
    scenario(`voice deadline feedback results replay ${slug} ${size}`, { slug, size }, async (h) => {
      await h.start()
      const originalId = h.session().id
      const total = h.session().totalRounds
      await screenshot(h.page, `ready-${slug}-${size}`)
      for (let round = 0; round < total; round++) {
        assert.equal(h.session().roundIndex, round)
        await beginVoice(h)
        await sendVoice(h, `${ANSWER} ${round + 1}`, round === 0)
        await checkFeedback(h, `${ANSWER} ${round + 1}`)
        if (round === 0) await screenshot(h.page, `feedback-${slug}-${size}`)
        assert.equal(await h.page.locator('.sg-score-big').count(), 0, 'even the final answer needs explicit Next')
        await button(h.page, 'Next').click()
        if (round < total - 1) {
          await button(h.page, 'Speak').waitFor()
          assert.equal(h.session().status, 'ready')
          assert.equal(await h.page.locator('.sg-transcript').count(), 0)
          assert.equal(await h.page.locator('.sg-prompt').innerText(), 'Ready')
        }
      }
      await button(h.page, 'Play again').waitFor()
      assert.equal(h.session().status, 'completed')
      assert.equal(await h.page.locator('.sg-score-big').innerText(), String(total * 7))
      assert.equal(await h.page.locator('details').count(), total)
      await h.page.locator('details summary').first().click()
      assert.ok((await h.page.locator('details').first().innerText()).includes(`${ANSWER} 1`))
      assert.ok((await h.page.locator('.sg-stat-grid').innerText()).includes('+12'))
      assert.ok((await h.page.locator('.sg-achievements').first().innerText()).includes('Mock achievement'))
      await screenshot(h.page, `results-${slug}-${size}`)
      await button(h.page, 'Play again').click()
      await button(h.page, 'Start').waitFor()
      assert.equal(new URL(h.page.url()).search, '')
      await button(h.page, 'Start').click()
      await h.page.locator('.sg-hud').waitFor()
      assert.notEqual(h.session().id, originalId)
      assert.notEqual(h.calls('start')[0].body.requestId, h.calls('start')[1].body.requestId)
      assert.equal(h.session().score, 0)
      assert.equal(h.session().history.length, 0)
      assert.equal(h.calls('answer').length, total)
    })
  }

  scenario(`mystery five locations questions clues accusation ${size}`, { slug: 'ice-mystery', size }, async (h) => {
    await h.start()
    assert.equal(await h.page.locator('.sg-map > button').count(), 5)
    assert.equal(await button(h.page, 'Name the culprit').isDisabled(), true)
    await screenshot(h.page, `mystery-map-${size}`)
    for (const [index, location] of LOCATIONS.entries()) {
      await button(h.page, `${location.titleRu}: Enter`).click()
      await button(h.page, 'Speak').waitFor()
      assert.equal(h.calls('visit').at(-1).body.locationId, location.id)
      await beginVoice(h)
      await sendVoice(h, `${QUESTION} ${index + 1}`)
      await checkFeedback(h, `${QUESTION} ${index + 1}`)
      const request = h.calls('answer').at(-1).body
      assert.equal(request.action, 'question')
      assert.equal(request.locationId, location.id)
      assert.equal(await h.page.locator('.sg-journal li').count(), index + 1)
      assert.ok((await h.page.getByLabel('Recent results', { exact: true }).innerText()).includes(`${QUESTION} ${index + 1}`))
      if (index === 0) await screenshot(h.page, `mystery-dialogue-${size}`)
      await button(h.page, 'Next').click()
      await button(h.page, 'Speak').waitFor()
      await h.page.getByRole('button', { name: /Back to map/ }).click()
      await h.page.locator('.sg-map').waitFor()
      assert.ok((await button(h.page, `${location.titleRu}: Enter`).innerText()).includes('1/10'))
      assert.equal(await button(h.page, 'Name the culprit').isEnabled(), index === 4)
    }
    await screenshot(h.page, `mystery-evidence-${size}`)
    await button(h.page, 'Name the culprit').click()
    await h.page.getByRole('heading', { name: /Who is guilty/ }).waitFor()
    assert.equal(await h.page.locator('select').count(), 0)
    await beginVoice(h, false, true)
    await sendVoice(h, ACCUSATION)
    await h.page.getByRole('heading', { name: 'Case solved!', exact: true }).waitFor()
    assert.equal(h.calls('answer').length, 6)
    assert.equal(h.calls('answer').at(-1).body.action, 'accuse')
    assert.equal(h.calls('answer').at(-1).body.suspectId, undefined)
    assert.equal(h.session().summary.won, true)
    assert.ok((await h.page.locator('.sg-city').first().innerText()).includes('Detective agency'))
    await screenshot(h.page, `mystery-results-${size}`)
  })

  scenario(`answer failure retries identical request ${size}`, { slug: 'error-hunt', size, failAnswers: 1 }, async (h) => {
    await h.start()
    await beginVoice(h)
    await sendVoice(h, ANSWER, true)
    await h.page.getByRole('alert').waitFor()
    const failed = clone(h.calls('answer')[0].body)
    assert.equal(await button(h.page, 'Next').count(), 0)
    assert.ok((await h.page.locator('.sg-transcript').innerText()).includes(ANSWER))
    await h.page.clock.fastForward(20000)
    assert.equal(h.calls('answer').length, 1, 'failure must not silently resend or advance')
    await h.page.getByRole('alert').getByRole('button', { name: 'Try again', exact: true }).click()
    await checkFeedback(h)
    assert.equal(h.calls('answer').length, 2)
    assert.deepEqual(h.calls('answer')[1].body, failed)
    assert.equal(h.session().history.length, 1)
    assert.equal(h.session().score, 7)
    assert.equal(h.calls('next').length, 0)
    assert.equal((await h.page.evaluate(() => window.__gameSpeech.snapshot())).length, 1)
    await screenshot(h.page, `retry-${size}`)
  })

  for (const unsupported of [true, false]) {
    scenario(`text fallback ${unsupported ? 'unsupported' : 'permission denied'} ${size}`, { slug: 'error-hunt', size, unsupported }, async (h) => {
      await h.start()
      if (unsupported) {
        assert.equal(await button(h.page, 'Speak').isDisabled(), true)
        assert.ok((await h.page.locator('.sg-board').innerText()).includes('Speech recognition is unavailable'))
      } else {
        await button(h.page, 'Speak').click()
        await h.page.waitForFunction(() => window.__gameSpeech.snapshot().length === 1)
        await h.page.evaluate(() => window.__gameSpeech.error('not-allowed'))
        await h.page.getByRole('alert').filter({ hasText: 'Allow microphone access' }).waitFor()
      }
      assert.equal(h.calls('begin').length, 0)
      await button(h.page, 'Type an answer').click()
      await button(h.page, 'Speak').click()
      await h.page.getByRole('textbox', { name: 'Your answer', exact: true }).fill(`  ${ANSWER}  `)
      assert.equal(await button(h.page, 'Answer by voice').count(), 0, 'input mode is fixed while a round is answering')
      await button(h.page, 'Submit answer').click()
      await checkFeedback(h)
      assert.equal(h.calls('answer').at(-1).body.text, ANSWER)
      assert.equal((await h.page.evaluate(() => window.__gameSpeech.snapshot())).length, unsupported ? 0 : 1)
    })
  }
}

for (const gate of ['disabled', 'locked']) {
  for (const slug of SLUGS) {
    scenario(`${gate} prevents start ${slug}`, { slug, access: gate === 'disabled' ? { isEnabled: false } : { isAccessible: false, lockReason: 'lesson_required' } }, async (h) => {
      await h.open()
      const expected = gate === 'disabled' ? 'The administrator has not enabled this game yet.' : 'This game is not unlocked yet.'
      assert.ok((await h.page.getByRole('status').innerText()).includes(expected))
      assert.equal(await button(h.page, 'Start').count(), 0)
      assert.equal(h.calls('start').length, 0)
      assert.deepEqual(await h.page.evaluate(() => window.__gameSpeech.snapshot()), [])
    })
  }
}

for (const via of ['dashboard', 'url']) {
  scenario(`resume saved answering via ${via}`, { slug: 'error-hunt', saved: makeSession('error-hunt', { status: 'answering', version: 8, score: 7, deadlineUtc: new Date(Date.now() + 3600000).toISOString() }) }, async (h) => {
    const saved = h.session()
    await h.open(via === 'url' ? `?session=${saved.id}` : '')
    if (via === 'dashboard') await button(h.page, 'Resume').click()
    await button(h.page, 'Submit answer').waitFor()
    assert.equal(h.calls('start').length, 0)
    assert.equal(h.calls('session').at(-1).id, saved.id)
    await beginVoice(h, true)
    assert.equal(h.calls('begin').length, 0, 'resuming recording must not reset the server round/deadline')
    await sendVoice(h)
    await checkFeedback(h)
    assert.equal(h.calls('answer')[0].body.expectedVersion, 8)
  })
}

scenario('resume pending answer preserves persisted request id', { slug: 'error-hunt', saved: makeSession('error-hunt', {
  status: 'answering', version: 4, pendingAnswer: { requestId: '00000000-0000-4000-8000-000000000001', expectedVersion: 4, text: ANSWER, action: 'answer' },
}) }, async (h) => {
  const saved = clone(h.session())
  await h.open(`?session=${saved.id}`)
  await button(h.page, 'Try again').click()
  await checkFeedback(h)
  assert.deepEqual(h.calls('answer')[0].body, saved.pendingAnswer)
  assert.equal(h.calls('begin').length, 0)
  assert.deepEqual(await h.page.evaluate(() => window.__gameSpeech.snapshot()), [])
})

scenario('mystery resume feedback map acknowledges next before another question', { slug: 'ice-mystery', saved: makeSession('ice-mystery', {
  status: 'feedback', version: 4, prompt: prompt('ice-mystery', 0, LOCATIONS[0].id), feedback: feedback(QUESTION),
  locations: LOCATIONS.map((location, index) => ({ ...location, visited: index === 0, questionsAsked: index === 0 ? 1 : 0 })),
  history: [{ roundIndex: 0, prompt: prompt('ice-mystery', 0, LOCATIONS[0].id), feedback: feedback(QUESTION), locationId: LOCATIONS[0].id, answeredAt: now() }],
  clues: [{ id: 'clue-square', locationId: 'square', textRu: 'Saved clue' }],
}) }, async (h) => {
  await h.open(`?session=${h.session().id}`)
  await h.page.locator('.sg-map').waitFor()
  assert.equal(await h.page.locator('.sg-journal li').count(), 1)
  assert.equal(h.calls('next').length, 0)
  await button(h.page, `${LOCATIONS[1].titleRu}: Enter`).click()
  await button(h.page, 'Speak').waitFor()
  assert.equal(h.calls('visit').length, 0, 'feedback location switch must acknowledge next, not call visit')
  assert.equal(h.calls('next').length, 1)
  assert.equal(h.calls('next')[0].body.locationId, LOCATIONS[1].id)
  assert.equal(h.session().status, 'ready')
  assert.equal(h.session().history[0].feedback.answer, QUESTION)
})

scenario('mystery exhausted location cannot be visited', { slug: 'ice-mystery', saved: makeSession('ice-mystery', {
  locations: LOCATIONS.map((location, index) => ({ ...location, visited: index === 0, questionsAsked: index === 0 ? 10 : 0 })),
}) }, async (h) => {
  await h.open(`?session=${h.session().id}`)
  assert.equal(await button(h.page, `${LOCATIONS[0].titleRu}: Enter`).isDisabled(), true)
  assert.equal(await button(h.page, `${LOCATIONS[1].titleRu}: Enter`).isEnabled(), true)
  assert.equal(await button(h.page, 'Name the culprit').isDisabled(), true)
  assert.equal(h.calls('visit').length, 0)
})

scenario('400 accusation rejection allows re-record with a new request id', { slug: 'ice-mystery', answerError: 400, saved: makeSession('ice-mystery', {
  locations: LOCATIONS.map((location) => ({ ...location, visited: true, questionsAsked: 1 })),
  clues: LOCATIONS.map((location) => ({ id: `clue-${location.id}`, locationId: location.id, textRu: `Clue ${location.id}` })),
}) }, async (h) => {
  await h.open(`?session=${h.session().id}`)
  await button(h.page, 'Name the culprit').click()
  await beginVoice(h, false, true)
  await sendVoice(h, 'Unclear accusation')
  await h.page.getByRole('alert').filter({ hasText: 'Name the culprit and explain why.' }).waitFor()
  const first = clone(h.calls('answer')[0].body)
  assert.equal(h.session().status, 'ready')
  await beginVoice(h, false, true)
  await sendVoice(h, ACCUSATION)
  await h.page.getByRole('heading', { name: 'Case solved!', exact: true }).waitFor()
  assert.equal(h.calls('begin').length, 0)
  assert.notEqual(h.calls('answer')[1].body.requestId, first.requestId)
  assert.equal(h.calls('answer')[1].body.expectedVersion, first.expectedVersion)
  assert.equal(h.calls('answer')[1].body.text, ACCUSATION)
  assert.equal(h.session().history.length, 1)
})

scenario('409 answer conflict reloads authoritative session without resending', { slug: 'error-hunt', answerError: 409 }, async (h) => {
  await h.start()
  await beginVoice(h)
  await sendVoice(h)
  await checkFeedback(h, 'Recovered server answer')
  assert.equal(h.calls('session').length, 1)
  assert.equal(h.calls('answer').length, 1)
  assert.equal(h.session().version, 3)
  await button(h.page, 'Next').click()
  await button(h.page, 'Speak').waitFor()
  assert.equal(h.calls('next')[0].body.expectedVersion, 3)
  assert.equal(h.session().roundIndex, 1)
})

scenario('active round microphone retry preserves transcript', { slug: 'tez-gapir' }, async (h) => {
  await h.start()
  await beginVoice(h)
  await h.page.evaluate((text) => { window.__gameSpeech.result(text, true); window.__gameSpeech.error('network') }, ANSWER)
  await h.page.getByRole('alert').waitFor()
  assert.ok((await h.page.locator('.sg-transcript').innerText()).includes(ANSWER))
  await beginVoice(h, true)
  await h.page.evaluate(() => window.__gameSpeech.finalOnStop('again'))
  await button(h.page, 'Finish').click()
  await checkFeedback(h, `${ANSWER} again`)
  assert.equal(h.calls('begin').length, 1)
  assert.equal(h.calls('answer')[0].body.text, `${ANSWER} again`)
  assert.equal((await h.page.evaluate(() => window.__gameSpeech.snapshot())).length, 2)
})

scenario('mystery resume answering restores the active location', { slug: 'ice-mystery', saved: makeSession('ice-mystery', {
  status: 'answering', version: 6, prompt: prompt('ice-mystery', 0, LOCATIONS[2].id),
  deadlineUtc: new Date(Date.now() + 3600000).toISOString(),
  locations: LOCATIONS.map((location, index) => ({ ...location, visited: index === 2 })),
}) }, async (h) => {
  await h.open(`?session=${h.session().id}`)
  await button(h.page, 'Submit answer').waitFor()
  assert.equal(await h.page.locator('.sg-map').count(), 0)
  await beginVoice(h, true)
  await sendVoice(h, QUESTION)
  await checkFeedback(h, QUESTION)
  assert.equal(h.calls('begin').length, 0)
  assert.equal(h.calls('answer')[0].body.locationId, LOCATIONS[2].id)
  assert.equal(h.calls('answer')[0].body.expectedVersion, 6)
})

scenario('canonical pero companion is sent to the server', { slug: 'first-reaction' }, async (h) => {
  await h.open()
  await button(h.page, 'Feather').click()
  await button(h.page, 'Start').click()
  await h.page.locator('.sg-hud').waitFor()
  assert.equal(h.calls('start')[0].body.character, 'pero')
  assert.equal(h.session().character, 'pero')
})

scenario('leaving game aborts microphone and cancels restart', { slug: 'tez-gapir' }, async (h) => {
  await h.start()
  await beginVoice(h)
  await h.page.locator('.sg-nav a').click()
  await h.page.waitForURL(`${BASE}/games`)
  await h.page.locator('main[data-game]').waitFor({ state: 'detached' })
  await h.page.locator('a[href="/games/tez-gapir"]').waitFor()
  await h.page.clock.fastForward(35000)
  const instances = await h.page.evaluate(() => window.__gameSpeech.snapshot())
  assert.equal(instances.length, 1)
  assert.equal(instances[0].active, false)
  assert.ok(instances[0].aborts > 0)
  assert.equal(h.calls('answer').length, 0)
})

const longSentence = `${Array(12).fill(ANSWER.slice(0, -1)).join(', ')}.`
const longWord = '\u0434\u043e\u0441\u0442\u043e\u043f\u0440\u0438\u043c\u0435\u0447\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u0438'.repeat(10)

scenario('tez feedback long sentence and unbroken word fit mobile', { slug: 'tez-gapir', size: 'mobile', saved: makeSession('tez-gapir', {
  status: 'feedback', version: 3, score: 3, availableActions: ['next', 'end'],
  feedback: { ...feedback(longSentence), points: 3,
    criteria: [{ code: 'sentence', label: longSentence, passed: true, points: 2 }],
    words: [{ text: longWord, category: 'unique', points: 1 }],
  },
}) }, async (h) => {
  await h.open(`?session=${h.session().id}`)
  assert.equal(h.page.viewportSize().width, 390)
  const panel = h.page.getByRole('region', { name: 'Review your results', exact: true })
  await panel.waitFor()
  assert.equal(await panel.locator('.sg-chip').count(), 2)
  for (const [text, points] of [[longSentence, '+2'], [longWord, '+1']]) {
    const chip = panel.locator('.sg-chip').filter({ hasText: text })
    await chip.scrollIntoViewIfNeeded()
    assert.equal(await chip.isVisible(), true)
    assert.equal(await chip.locator('strong').innerText(), points)
    const layout = await chip.evaluate((element) => {
      const box = (rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })
      const texts = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      const ranges = texts.flatMap((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return [...range.getClientRects()].map(box)
      })
      const badge = element.querySelector('strong')
      const badgeRange = document.createRange()
      badgeRange.selectNodeContents(badge)
      return {
        text: texts.map((node) => node.textContent).join('').trim(),
        box: box(element.getBoundingClientRect()), group: box(element.parentElement.getBoundingClientRect()),
        ranges, badgeRanges: [...badgeRange.getClientRects()].map(box),
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      }
    })
    assert.equal(layout.text, text, 'the entire backend label/word must be rendered, not substituted or truncated')
    assert.ok(layout.ranges.length > 1, 'long sentence and unbroken word must both wrap onto multiple lines')
    assert.ok(layout.badgeRanges.length > 0, 'point badge must remain rendered')
    assert.ok(layout.box.left >= layout.group.left - 1 && layout.box.right <= layout.group.right + 1, 'chip must fit its criteria group')
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'chip must not scroll or clip text horizontally')
    assert.ok(layout.scrollHeight <= layout.clientHeight + 1, 'chip must grow vertically instead of clipping wrapped lines')
    for (const rect of [...layout.ranges, ...layout.badgeRanges]) {
      assert.ok(rect.right > rect.left && rect.bottom > rect.top, 'text and points must have nonzero rendered size')
      assert.ok(rect.left >= layout.box.left - 1 && rect.right <= layout.box.right + 1, 'every text fragment and point badge must fit horizontally')
      assert.ok(rect.top >= layout.box.top - 1 && rect.bottom <= layout.box.bottom + 1, 'every wrapped line and point badge must fit vertically')
    }
  }
  assert.equal(await button(h.page, 'Next').isEnabled(), true)
  await screenshot(h.page, 'tez-long-feedback-mobile')
})

scenario('pending 503 answer can finish once and replay a fresh session', { slug: 'tez-gapir', size: 'mobile', failAnswers: 4 }, async (h) => {
  await h.start()
  const originalId = h.session().id
  const originalStart = clone(h.calls('start')[0].body)
  await beginVoice(h)
  await sendVoice(h, ANSWER, true)
  const alert = h.page.getByRole('alert')
  await alert.waitFor()
  const pending = clone(h.calls('answer')[0].body)
  for (let retry = 0; retry < 3; retry++) {
    const response = h.page.waitForResponse((item) => item.url().endsWith(`/${originalId}/answer`) && item.status() === 503)
    await alert.getByRole('button', { name: 'Try again', exact: true }).click()
    await response
    await alert.waitFor()
    assert.equal(h.calls('answer').length, retry + 2)
    assert.deepEqual(h.calls('answer').at(-1).body, pending)
  }
  assert.equal(h.session().status, 'answering')
  assert.equal(h.session().version, pending.expectedVersion)
  assert.equal(h.session().history.length, 0)
  assert.ok((await h.page.locator('.sg-transcript').innerText()).includes(ANSWER))
  const finish = button(h.page, 'Finish game')
  await finish.waitFor()
  assert.equal(await finish.isEnabled(), true, 'pending answers must offer a way to finish even while the server status is answering')

  const cancelDialog = h.page.waitForEvent('dialog')
  const cancelClick = finish.click()
  const cancelled = await cancelDialog
  assert.equal(cancelled.type(), 'confirm')
  await cancelled.dismiss()
  await cancelClick
  assert.equal(h.calls('end').length, 0, 'cancelling confirmation must not end the session')
  assert.equal(h.session().status, 'answering')

  let releaseEnd
  const endGate = new Promise((resolve) => { releaseEnd = resolve })
  const endRequests = []
  await h.page.route(`${BASE}${ROOT}/tez-gapir/${originalId}/end`, async (route) => {
    endRequests.push(route.request().postDataJSON())
    await endGate
    await route.fallback()
  })
  const expectedVersion = h.session().version
  try {
    const confirmDialog = h.page.waitForEvent('dialog')
    const confirmClick = finish.click()
    const confirmed = await confirmDialog
    assert.equal(confirmed.type(), 'confirm')
    await confirmed.accept()
    await confirmClick
    await until(() => endRequests.length === 1, 'accepting confirmation must send one end command')
    assert.equal(endRequests[0].expectedVersion, expectedVersion)
    assert.notEqual(endRequests[0].requestId, pending.requestId, 'ending is a new command, not a replay of the failed answer')
    assert.equal(await finish.isDisabled(), true, 'Finish must be disabled while end is in flight')
    await finish.evaluate((element) => { element.click(); element.click() })
    await h.page.clock.fastForward(65000)
    assert.equal(endRequests.length, 1, 'busy Finish cannot duplicate the end request')
    assert.equal(h.calls('answer').length, 4, 'ending must not resubmit a pending answer at the old deadline')
    const microphones = await h.page.evaluate(() => window.__gameSpeech.snapshot())
    assert.equal(microphones.length, 1)
    assert.equal(microphones[0].active, false)
    assert.ok(microphones[0].stops >= 1)
  } finally { releaseEnd() }

  await button(h.page, 'Play again').waitFor()
  assert.equal(h.calls('end').length, 1)
  assert.equal(h.calls('end')[0].id, originalId)
  assert.equal(h.calls('end')[0].body.expectedVersion, expectedVersion)
  assert.equal(h.session().version, expectedVersion + 1)
  assert.equal(h.session().status, 'completed')
  assert.equal(await h.page.locator('.sg-score-big').innerText(), '0')
  assert.equal(await button(h.page, 'Try again').count(), 0)
  assert.equal(await h.page.locator('.sg-transcript').count(), 0)
  assert.equal(await alert.count(), 0)
  await screenshot(h.page, 'pending-answer-finish-results-mobile')

  await button(h.page, 'Play again').click()
  await button(h.page, 'Start').waitFor()
  assert.equal(new URL(h.page.url()).search, '')
  await button(h.page, 'Start').click()
  await h.page.locator('.sg-hud').waitFor()
  assert.notEqual(h.session().id, originalId)
  assert.notEqual(h.calls('start')[1].body.requestId, originalStart.requestId)
  assert.equal(h.session().status, 'ready')
  assert.equal(h.session().score, 0)
  assert.equal(h.session().history.length, 0)
  assert.equal(await button(h.page, 'Try again').count(), 0)
  assert.equal(await h.page.locator('.sg-transcript').count(), 0)
  await beginVoice(h)
  const freshVersion = h.session().version
  await sendVoice(h, `${ANSWER} replay`)
  await checkFeedback(h, `${ANSWER} replay`)
  const freshAnswer = h.calls('answer').at(-1)
  assert.equal(h.calls('answer').length, 5)
  assert.equal(freshAnswer.id, h.session().id)
  assert.equal(freshAnswer.body.expectedVersion, freshVersion)
  assert.notEqual(freshAnswer.body.requestId, pending.requestId)
  assert.equal(h.session().history.length, 1)
  assert.equal(h.calls('end').length, 1)
})

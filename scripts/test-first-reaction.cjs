const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, 'test-speaking-games.cjs'), 'utf8')
const helpers = new Function('require', `${source.slice(0, source.indexOf('for (const [character, size, width]'))}\nreturn { scenario, button, makeSession, prompt, feedback, until, screenshot, noOverflow, ANSWER, BASE, clone };`)(require)
const { button, makeSession, prompt, feedback, until, screenshot, noOverflow, ANSWER, BASE, clone } = helpers
const scenario = (name, options, action) => helpers.scenario(name, { navigationTimeout: 15000, ...options }, async (h) => {
  await h.page.route('**/api/course/map', (route) => route.fulfill({ json: [] }))
  await action(h)
})

async function begin(h, reconnect = false) {
  const count = h.calls('begin').length
  const recognizers = await h.page.evaluate(() => window.__gameSpeech.snapshot().length)
  await button(h.page, reconnect ? 'Reconnect microphone' : 'Ready').click()
  await h.page.waitForFunction((count) => window.__gameSpeech.snapshot().length === count + 1, recognizers)
  assert.equal(h.calls('begin').length, count)
  await h.page.evaluate(() => window.__gameSpeech.started())
  if (!reconnect) await until(() => h.calls('begin').length === count + 1, 'microphone readiness starts one authoritative round')
  await h.page.getByRole('timer').waitFor()
  return h.session().deadlineUtc
}

const shelf = [
  { slug: 'tez-gapir', titleUz: 'Tez gapir', bodyUz: '', isBuilt: true, isEnabled: true, requiresPro: false, isAccessible: true },
  { slug: 'first-reaction', titleUz: 'Birinchi reaksiya', bodyUz: '', isBuilt: true, isEnabled: true, requiresPro: true, isAccessible: true },
  { slug: 'error-hunt', titleUz: 'Xato ovchisi', bodyUz: '', isBuilt: true, isEnabled: true, requiresPro: false, isAccessible: true },
]

for (const width of [320, 390, 1280]) {
  scenario(`first-reaction shelf card opens game at ${width}px`, { slug: 'first-reaction', size: width < 760 ? 'mobile' : 'desktop', viewport: { width, height: 960 }, shelfGames: shelf }, async (h) => {
    await h.page.goto(`${BASE}/games`, { timeout: 15000 })
    const card = h.page.locator('a[href="/games/first-reaction"]')
    await card.waitFor()
    assert.equal(await card.locator('#first-reaction-card-title').innerText(), 'First reaction')
    assert.match(await card.innerText(), /20 seconds/)
    assert.match(await card.innerText(), /5 situations/)
    const images = card.locator('img')
    assert.equal(await images.count(), 3)
    for (const image of await images.all()) {
      await image.evaluate((element) => element.decode())
      assert.match(await image.getAttribute('src'), /^\/games\/first-reaction\/characters\/(panda|penguin|pero)\.webp$/)
    }
    const box = await card.boundingBox()
    assert.ok(box.width > 250 && box.width <= width, `card fits viewport: ${JSON.stringify(box)}`)
    if (width >= 1024) assert.equal(await card.evaluate((node) => getComputedStyle(node).gridColumnEnd), 'span 2')
    await screenshot(h.page, `reaction-shelf-${width}`)
    await card.click()
    await h.page.locator('.fr-setup').waitFor()
    assert.equal(new URL(h.page.url()).pathname, '/games/first-reaction')
    assert.equal(h.calls('start').length, 0)
  })
}

scenario('first-reaction disabled shelf entry is omitted', { slug: 'first-reaction', shelfGames: shelf.filter((game) => game.slug !== 'first-reaction') }, async (h) => {
  await h.page.goto(`${BASE}/games`, { timeout: 15000 })
  await h.page.locator('a[href="/games/tez-gapir"]').waitFor()
  assert.equal(await h.page.locator('#first-reaction-card-title').count(), 0)
})

scenario('first-reaction inaccessible shelf entry preserves paywall link', { slug: 'first-reaction', shelfGames: shelf.map((game) => game.slug === 'first-reaction' ? { ...game, isAccessible: false } : game) }, async (h) => {
  await h.page.goto(`${BASE}/games`, { timeout: 15000 })
  const title = h.page.locator('#first-reaction-card-title')
  await title.waitFor()
  assert.equal(await title.locator('xpath=ancestor::a').getAttribute('href'), '/paywall')
  assert.equal(await h.page.locator('a[href="/games/first-reaction"]').count(), 0)
  assert.equal(h.calls('start').length, 0)
})

for (const [size, width] of [['mobile', 320], ['desktop', 1280]]) {
  scenario(`first-reaction frozen preparation media hints ${size}`, { slug: 'first-reaction', size, viewport: { width, height: 960 } }, async (h) => {
    await h.open()
    await button(h.page, 'Panda').click()
    await h.page.getByRole('radio', { name: 'B1', exact: true }).check()
    await screenshot(h.page, `reaction-setup-${size}`)
    await button(h.page, 'Start').click()
    await h.page.locator('.fr-hud').waitFor()
    assert.equal(h.calls('start')[0].body.character, 'panda')
    assert.equal(h.calls('start')[0].body.level, 'B1')
    assert.equal(h.calls('start')[0].body.rounds, 5)
    assert.equal(h.session().deadlineUtc, null)
    assert.equal(h.session().roundStartedAt, null)
    await h.page.getByRole('heading', { name: h.session().prompt.textRu, exact: true }).waitFor()
    assert.equal(await h.page.locator('.fr-hints span').count(), 2)
    assert.equal(await h.page.getByRole('timer').count(), 0)
    assert.equal(await h.page.locator('.fr-mic-core').count(), 0)
    assert.deepEqual(await h.page.evaluate(() => window.__gameSpeech.snapshot()), [])
    const images = h.page.locator('.fr-scene-visual img')
    assert.ok(await images.count() > 0)
    for (const image of await images.all()) {
      await image.evaluate((element) => element.decode())
      assert.ok(await image.evaluate((element) => element.complete && element.naturalWidth > 0))
      assert.match(await image.evaluate((element) => element.currentSrc), /\.svg$/, 'reduced motion uses the still scene')
    }
    await h.page.clock.fastForward(60000)
    assert.equal(h.calls('begin').length, 0)
    assert.equal(h.calls('answer').length, 0)
    assert.equal(h.session().deadlineUtc, null)
    await screenshot(h.page, `reaction-preparation-${size}`)
  })
}

scenario('first-reaction animated local GIF loads with motion enabled', { slug: 'first-reaction' }, async (h) => {
  await h.page.emulateMedia({ reducedMotion: 'no-preference' })
  await h.start()
  const image = h.page.locator('.fr-scene-visual img')
  await image.evaluate((element) => element.decode())
  assert.match(await image.evaluate((element) => element.currentSrc), /\/games\/first-reaction\/media\/talking_cat\.gif$/)
  assert.ok(await image.evaluate((element) => element.naturalWidth > 0))
  assert.equal(h.calls('begin').length, 0)
})

scenario('first-reaction unavailable GIF and poster preserve readable preparation', { slug: 'first-reaction' }, async (h) => {
  await h.page.emulateMedia({ reducedMotion: 'no-preference' })
  await h.page.route('**/games/first-reaction/media/talking_cat.*', (route) => route.fulfill({ status: 404, body: '' }))
  await h.start()
  await h.page.locator('.first-reaction-media__fallback').waitFor()
  assert.equal(await h.page.locator('.fr-scene-visual img').count(), 0)
  await h.page.getByRole('heading', { name: h.session().prompt.textRu, exact: true }).waitFor()
  assert.equal(await button(h.page, 'Ready').isEnabled(), true)
  assert.equal(await h.page.getByRole('timer').count(), 0)
  assert.equal(h.calls('begin').length, 0)
})

scenario('first-reaction authoritative 20 seconds onset warning urgent final answer', { slug: 'first-reaction', size: 'desktop' }, async (h) => {
  await h.start()
  const deadline = await begin(h)
  assert.equal(await h.page.getByRole('timer').getAttribute('aria-label'), '20 seconds')
  await h.page.clock.fastForward(1500)
  await h.page.evaluate((text) => window.__gameSpeech.result(text, false), 'Я думаю')
  await until(async () => await h.page.locator('.fr-response').getAttribute('data-reacting') === 'true', 'character responds to recognised speech')
  await h.page.clock.fastForward(9500)
  assert.equal(await h.page.locator('.fr-response').getAttribute('data-mood'), 'warning')
  assert.equal(await h.page.getByRole('timer').getAttribute('aria-label'), '9 seconds')
  await h.page.clock.fastForward(5000)
  assert.equal(await h.page.locator('.fr-response').getAttribute('data-mood'), 'urgent')
  assert.equal(await h.page.getByRole('timer').getAttribute('aria-label'), '4 seconds')
  assert.equal(h.session().deadlineUtc, deadline)
  await screenshot(h.page, 'reaction-active-urgent-desktop')
  await h.page.evaluate((text) => window.__gameSpeech.finalOnStop(text), ANSWER)
  await h.page.clock.fastForward(4000)
  const microphones = await h.page.evaluate(() => window.__gameSpeech.snapshot())
  assert.equal(microphones.at(-1).active, false)
  assert.equal(microphones.at(-1).stops, 1)
  await h.page.clock.fastForward(1000)
  await h.page.locator('.fr-feedback-panel').waitFor()
  assert.equal(h.calls('answer').length, 1)
  assert.equal(h.calls('answer')[0].body.text, ANSWER)
  assert.equal(h.calls('answer')[0].body.inputMode, 'voice')
  assert.ok(Math.abs(h.calls('answer')[0].body.speechStartedMilliseconds - 1500) <= 100, 'speed metadata uses first recognizer text, not 20-second submission')
  assert.equal(h.calls('next').length, 0)
  assert.equal(await h.page.getByRole('heading', { name: h.session().prompt.textRu, exact: true }).count(), 1)
  await screenshot(h.page, 'reaction-feedback-desktop')
})

scenario('first-reaction silent timeout has zero words and no measured onset', { slug: 'first-reaction' }, async (h) => {
  await h.start()
  await begin(h)
  await h.page.clock.fastForward(3500)
  assert.match(await h.page.locator('.fr-encouragement').innerText(), /simple sentence/)
  await h.page.clock.fastForward(17000)
  await h.page.locator('.fr-feedback-panel').waitFor()
  assert.equal(h.calls('answer').length, 1)
  assert.equal(h.calls('answer')[0].body.text, '')
  assert.equal(h.calls('answer')[0].body.speechStartedMilliseconds, null)
  assert.equal(h.session().score, 0)
  assert.equal(h.session().feedback.reactionStartedMilliseconds, null)
})

scenario('first-reaction retry preserves answer identity onset and feedback state', { slug: 'first-reaction', failAnswers: 1 }, async (h) => {
  await h.start()
  await begin(h)
  await h.page.clock.fastForward(700)
  await h.page.evaluate((text) => { window.__gameSpeech.result(text); window.__gameSpeech.finalOnStop(text) }, ANSWER)
  await button(h.page, 'Finish answer').click()
  await h.page.getByRole('alert').waitFor()
  const failed = clone(h.calls('answer')[0].body)
  assert.equal(await button(h.page, 'Next').count(), 0)
  await h.page.clock.fastForward(25000)
  assert.equal(h.calls('answer').length, 1)
  await h.page.getByRole('alert').getByRole('button', { name: 'Try again', exact: true }).click()
  await h.page.locator('.fr-feedback-panel').waitFor()
  assert.deepEqual(h.calls('answer')[1].body, failed)
  assert.equal((await h.page.evaluate(() => window.__gameSpeech.snapshot())).length, 1)
  assert.equal(h.session().history.length, 1)
  assert.equal(await h.page.locator('.fr-answer').first().getByText(ANSWER, { exact: true }).count(), 1)
  assert.equal(await h.page.locator('.fr-better').getByText(ANSWER, { exact: true }).count(), 1)
})

scenario('first-reaction feedback requests persona audio and ready stops it before microphone', { slug: 'first-reaction' }, async (h) => {
  await h.start()
  const tts = []
  await h.page.evaluate(() => {
    localStorage.setItem('rgg.audio-muted', 'false')
    window.__reactionAudio = []
    window.Audio = class {
      constructor(url) { this.url = url; this.paused = true; window.__reactionAudio.push(this) }
      play() { this.paused = false; return Promise.resolve() }
      pause() { this.paused = true }
    }
  })
  await h.page.route('**/api/speaking-games/first-reaction/*/tts', async (route) => {
    tts.push(route.request().postDataJSON())
    await route.fulfill({ contentType: 'audio/wav', body: Buffer.from('RIFFtest') })
  })
  await button(h.page, 'Listen to the situation').click()
  await until(() => tts.length === 1, 'optional prompt audio requests the existing endpoint')
  await h.page.waitForFunction(() => window.__reactionAudio.length === 1)
  await begin(h)
  assert.equal(await h.page.evaluate(() => window.__reactionAudio[0].paused), true)
  await h.page.evaluate((text) => { window.__gameSpeech.result(text); window.__gameSpeech.finalOnStop(text) }, ANSWER)
  await button(h.page, 'Finish answer').click()
  await h.page.locator('.fr-feedback-panel').waitFor()
  await until(() => tts.length === 2, 'feedback auto plays the selected character phrase')
  assert.deepEqual(tts, [{ target: 'prompt' }, { target: 'feedback' }])
  assert.equal(await h.page.locator('.fr-feedback-character p').innerText(), h.session().feedback.characterPhrase)
  assert.equal((await h.page.evaluate(() => window.__gameSpeech.snapshot())).at(-1).active, false)
  await button(h.page, 'Next').click()
  assert.equal(await h.page.evaluate(() => window.__reactionAudio.at(-1).paused), true)
  assert.equal(await h.page.getByRole('timer').count(), 0)
})

for (const via of ['url', 'dashboard']) {
  const saved = makeSession('first-reaction', { status: 'ready', version: 6, character: 'pero', level: 'B1', prompt: prompt('first-reaction', 2), roundIndex: 2 })
  scenario(`first-reaction restores frozen session via ${via}`, { slug: 'first-reaction', saved }, async (h) => {
    await h.open(via === 'url' ? `?session=${saved.id}` : '')
    if (via === 'dashboard') await button(h.page, 'Resume').click()
    await button(h.page, 'Ready').waitFor()
    assert.equal(h.calls('start').length, 0)
    await h.page.getByRole('heading', { name: saved.prompt.textRu, exact: true }).waitFor()
    assert.equal(await h.page.getByRole('timer').count(), 0)
    assert.equal(h.session().version, 6)
    await begin(h)
    assert.equal(h.calls('begin')[0].body.expectedVersion, 6)
  })
}

scenario('first-reaction five rounds results count actual words fastest onset and native share', { slug: 'first-reaction', size: 'mobile', viewport: { width: 320, height: 960 } }, async (h) => {
  await h.start()
  const answers = ['Я рад.', 'Я очень рад.', 'Это хорошо.', 'Я согласен.', 'Давайте начнём!']
  const delays = [1200, 600, 2500, 1800, 1100]
  for (let round = 0; round < 5; round++) {
    await begin(h)
    await h.page.clock.fastForward(delays[round])
    await h.page.evaluate((text) => { window.__gameSpeech.result(text); window.__gameSpeech.finalOnStop(text) }, answers[round])
    await button(h.page, 'Finish answer').click()
    await h.page.locator('.fr-feedback-panel').waitFor()
    await button(h.page, 'Next').click()
    if (round < 4) await button(h.page, 'Ready').waitFor()
  }
  await h.page.locator('.fr-result').waitFor()
  assert.equal(await h.page.locator('.fr-result-score>strong').innerText(), '35 / 50')
  assert.equal(await h.page.locator('.fr-result-stats>div').nth(0).locator('strong').innerText(), '11')
  const fastest = Number.parseFloat(await h.page.locator('.fr-result-stats>div').nth(1).locator('strong').innerText())
  assert.ok(fastest >= .6 && fastest <= .8, `fastest onset must reflect the 600ms response, received ${fastest}`)
  assert.equal(await h.page.locator('.fr-result[data-strong="true"]').count(), 1)
  await h.page.evaluate(() => { window.__reactionShare = null; navigator.share = async (value) => { window.__reactionShare = value } })
  await h.page.locator('[data-game-share="first-reaction"]').click()
  const shared = await h.page.evaluate(() => window.__reactionShare)
  assert.equal(shared.title, 'First reaction')
  assert.match(shared.text, /35 \/ 50/)
  assert.match(shared.text, /11/)
  assert.equal(shared.url, 'https://russian.gg/games/first-reaction')
  await screenshot(h.page, 'reaction-results-320')
  await button(h.page, 'Play again').click()
  await button(h.page, 'Start').waitFor()
  assert.equal(new URL(h.page.url()).search, '')
  await noOverflow(h.page)
})

scenario('first-reaction exhausted AI still permits explicit finish', { slug: 'first-reaction', failAnswers: 1, answerError: 503, answerErrorCode: 'game_ai_retry_exhausted' }, async (h) => {
  await h.start()
  await begin(h)
  await h.page.evaluate((text) => { window.__gameSpeech.result(text); window.__gameSpeech.finalOnStop(text) }, ANSWER)
  await button(h.page, 'Finish answer').click()
  await h.page.getByRole('alert').waitFor()
  assert.equal(await h.page.getByRole('alert').getByRole('button').count(), 0)
  assert.equal(await button(h.page, 'Try again').isDisabled(), true)
  h.page.once('dialog', (dialog) => dialog.accept())
  await button(h.page, 'Finish game').click()
  await h.page.locator('.fr-result').waitFor()
  assert.equal(h.calls('end').length, 1)
  assert.equal(h.session().score, 0)
})

scenario('first-reaction muted preferences suppress TTS and leaving aborts recording', { slug: 'first-reaction' }, async (h) => {
  await h.start()
  await button(h.page, 'Listen to the situation').click()
  await begin(h)
  await h.page.locator('.sg-nav a').click()
  await h.page.waitForURL(`${BASE}/games`)
  await h.page.clock.fastForward(30000)
  assert.equal(h.calls('answer').length, 0)
  const recordings = await h.page.evaluate(() => window.__gameSpeech.snapshot())
  assert.equal(recordings.length, 1)
  assert.equal(recordings[0].active, false)
  assert.ok(recordings[0].aborts > 0)
})

scenario('first-reaction legacy result preserves original maximum and negative points', { slug: 'first-reaction', saved: makeSession('first-reaction', {
  status: 'completed', durationSeconds: 5, totalRounds: 7, score: -1,
  history: [{ roundIndex: 0, prompt: prompt('first-reaction'), feedback: { ...feedback(''), points: -1 }, answeredAt: new Date().toISOString(), locationId: null }],
}) }, async (h) => {
  await h.open(`?session=${h.session().id}`)
  assert.equal(await h.page.locator('.fr-result-score>strong').innerText(), '-1 / 56')
  assert.equal(await h.page.locator('.fr-history summary>strong').innerText(), '-1')
  assert.equal(await h.page.locator('.fr-result-stats>div').first().locator('strong').innerText(), '0')
})

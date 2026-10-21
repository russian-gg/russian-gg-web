const assert = require('node:assert/strict')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const { test, before, after } = require('node:test')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const BASE = process.env.RUNNER_TEST_URL || 'http://127.0.0.1:5181'
const shots = fs.mkdtempSync(path.join(os.tmpdir(), 'rgg-runner-design-'))
let browser
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }) })
after(async () => { await browser?.close(); console.log(`Screenshots: ${shots}`) })

async function fixture(random, width = 390, height = 844, controlTime = true) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.addInitScript(value => {
    Math.random = () => value
    localStorage.setItem('rgg.access', 'runner-test')
    localStorage.setItem('rgg.locale', 'uz')
    localStorage.setItem('rgg.audio-muted', 'true')
    localStorage.setItem('rgg.install.never', 'true')
  }, random)
  await context.route('**/api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname
    if (endpoint === '/api/auth/me') return route.fulfill({ json: { id: 'runner-test', displayName: 'Learner', role: 'Learner', uiLanguage: 'uz', phoneNumber: '+998900000000', phoneNumberConfirmed: true, hasCompletedDiagnostic: true, tier: 'Free' } })
    if (endpoint === '/api/games') return route.fulfill({ json: [{ slug: 'rod-runner', titleUz: 'Лёд и род', bodyUz: 'Old runner description', isBuilt: true, isEnabled: true, isAccessible: true, requiresPro: false }] })
    if (endpoint === '/api/tests') return route.fulfill({ json: [] })
    if (endpoint === '/api/course/progress') return route.fulfill({ json: { currentDay: 2 } })
    return route.fulfill({ json: {} })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  if (controlTime) await page.clock.install({ time: new Date('2026-01-01T08:00:00Z') })
  await page.goto(`${BASE}/games/rod-runner`)
  await page.locator('.runner-overlay').waitFor()
  if (controlTime) await page.clock.pauseAt(new Date('2026-01-01T10:00:00Z'))
  return { page, async close() { assert.deepEqual(errors, []); await context.close() } }
}

for (const { random, lane, gender, key } of [
  { random: .5, lane: 0, gender: 'ЖЕНСКИЙ', key: 'ArrowLeft' },
  { random: 0, lane: 1, gender: 'МУЖСКОЙ', key: null },
  { random: .95, lane: 2, gender: 'СРЕДНИЙ', key: 'ArrowRight' },
]) {
  test(`fixed ${gender} sign matches its lane and scores the approaching word`, async () => {
    const h = await fixture(random)
    assert.deepEqual(await h.page.locator('.runner-signs>span').allTextContents(), ['ЖЕНСКИЙ', 'МУЖСКОЙ', 'СРЕДНИЙ'])
    await h.page.getByRole('button', { name: 'O‘yinni boshlash', exact: true }).click()
    if (key) await h.page.keyboard.press(key)
    assert.equal(await h.page.locator('.runner-signs>span').nth(lane).getAttribute('data-active'), 'true')
    await h.page.clock.runFor(3700)
    assert.equal(await h.page.locator('.runner-feedback p').count(), 0)
    assert.equal(await h.page.locator('.runner-point-flight').innerText(), '+1')
    assert.equal(await h.page.getByLabel('Ball', { exact: true }).innerText(), '1')
    assert.deepEqual(await h.page.locator('.runner-signs>span').allTextContents(), ['ЖЕНСКИЙ', 'МУЖСКОЙ', 'СРЕДНИЙ'])
    assert.equal(await h.page.locator('.runner-signs>span').nth(lane).getAttribute('data-active'), 'true')
    assert.ok(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await h.page.screenshot({ path: path.join(shots, `lane-${lane}-mobile.png`), fullPage: true })
    await h.close()
  })
}

test('Russian error feedback, record result and replay retain scoring and lives', async () => {
  const h = await fixture(0, 1280)
  await h.page.getByRole('button', { name: 'O‘yinni boshlash', exact: true }).click()
  await h.page.clock.runFor(3700)
  assert.equal(await h.page.getByLabel('Ball', { exact: true }).innerText(), '1')
  await h.page.screenshot({ path: path.join(shots, 'runner-desktop.png'), fullPage: true })
  await h.page.keyboard.press('ArrowRight')
  await h.page.clock.runFor(3700)
  assert.match(await h.page.locator('.runner-feedback').innerText(), /Xato: «.+» — МУЖСКОЙ РОД/)
  assert.equal(await h.page.getByLabel('Ball', { exact: true }).innerText(), '1')
  await h.page.clock.runFor(8500)
  await h.page.locator('.runner-reward').waitFor()
  assert.equal(await h.page.locator('.runner-reward').getAttribute('data-record'), 'true')
  assert.equal(await h.page.locator('.runner-reward h1').innerText(), 'YANGI REKORD!')
  assert.equal(await h.page.locator('.runner-stat').first().locator('strong').innerText(), '1')
  await h.page.screenshot({ path: path.join(shots, 'runner-record.png'), fullPage: true })
  await h.page.locator('.runner-reward .runner-replay').click()
  assert.equal(await h.page.getByLabel('Ball', { exact: true }).innerText(), '0')
  assert.equal(await h.page.locator('.runner-signs>span').nth(1).getAttribute('data-active'), 'true')
  await h.close()
})

test('mobile HUD stays visible after scrolling and viewport changes; overlays fit small screens', async () => {
  const h = await fixture(0, 320, 568)
  assert.equal(await h.page.locator('.runner-controls-hint, .runner-listen, .runner-pause, .lucide-bird, .lucide-volume-2, .lucide-volume-x').count(), 0)
  await h.page.screenshot({ path: path.join(shots, 'runner-ready-small.png'), fullPage: true })
  await h.page.getByRole('button', { name: 'O‘yinni boshlash', exact: true }).click()
  for (const height of [568, 480, 700]) {
    await h.page.setViewportSize({ width: 320, height })
    await h.page.clock.runFor(64)
    await h.page.evaluate(() => window.scrollTo(0, 1000))
    for (const selector of ['.runner-game header', '.runner-hud', '.runner-signs', '.runner-stage']) {
      const bounds = await h.page.locator(selector).boundingBox()
      assert.ok(bounds.y >= 0, `${selector} must not be clipped at the top`)
      assert.ok(bounds.y + bounds.height <= height + 1, `${selector} must fit the viewport`)
    }
    assert.ok(await h.page.getByLabel('Ball', { exact: true }).isVisible())
    assert.ok(await h.page.getByLabel('Tangalar', { exact: true }).isVisible())
    assert.ok(await h.page.getByLabel('Rekord', { exact: true }).isVisible())
  }
  await h.page.setViewportSize({ width: 390, height: 744 })
  await h.page.clock.runFor(64)
  await h.page.clock.runFor(3000)
  assert.ok(Number(await h.page.getByLabel('Tangalar', { exact: true }).innerText()) > 0)
  await h.page.screenshot({ path: path.join(shots, 'runner-mobile-before-answer.png'), fullPage: true })
  await h.page.clock.runFor(700)
  const reward = await h.page.locator('.runner-point-flight').boundingBox()
  const stage = await h.page.locator('.runner-stage').boundingBox()
  assert.ok(reward.width < 70 && reward.height < 32)
  assert.ok(reward.y + reward.height < stage.y + 100, 'point reward stays by the HUD, away from the word')
  await h.page.mouse.move(180, 500)
  await h.page.mouse.down()
  await h.page.mouse.move(260, 500, { steps: 4 })
  await h.page.mouse.up()
  assert.equal(await h.page.locator('.runner-signs>span').nth(2).getAttribute('data-active'), 'true')
  await h.page.clock.runFor(12000)
  await h.page.locator('.runner-reward').waitFor()
  await h.page.screenshot({ path: path.join(shots, 'runner-mobile-result.png'), fullPage: true })
  await h.page.locator('.runner-reward .runner-replay').click()
  await h.page.keyboard.press('ArrowRight')
  await h.page.clock.runFor(12000)
  await h.page.locator('.runner-reward').waitFor()
  assert.equal(await h.page.locator('.runner-reward-penguin').getAttribute('data-pose'), 'sad')
  await h.page.screenshot({ path: path.join(shots, 'runner-mobile-sad.png'), fullPage: true })
  await h.close()
})

test('shelf uses the runner character and enters a fully visible game', async () => {
  const h = await fixture(0, 390, 744, false)
  await h.page.getByRole('button', { name: 'O‘yinlardan chiqish', exact: true }).click()
  const card = h.page.locator('a[href="/games/rod-runner"]')
  await card.waitFor()
  await h.page.waitForFunction(() => {
    for (let el = document.querySelector('a[href="/games/rod-runner"]'); el; el = el.parentElement) {
      if (Number(getComputedStyle(el).opacity) < 1) return false
    }
    return true
  })
  assert.doesNotMatch(await card.innerText(), /Old runner description|YANGI O‘YIN|Rekord:/)
  await card.screenshot({ path: path.join(shots, 'runner-shelf-mobile.png') })
  await card.click()
  await h.page.locator('.runner-overlay').waitFor()
  assert.equal((await h.page.locator('.runner-game').boundingBox()).y, 0)
  await h.close()
})

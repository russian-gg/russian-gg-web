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

async function fixture(random, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.addInitScript(value => {
    Math.random = () => value
    localStorage.setItem('rgg.access', 'runner-test')
    localStorage.setItem('rgg.locale', 'uz')
    localStorage.setItem('rgg.audio-muted', 'true')
    localStorage.setItem('rgg.install.never', 'true')
  }, random)
  await context.route('**/api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname
    if (endpoint === '/api/auth/me') return route.fulfill({ json: { id: 'runner-test', role: 'Learner', uiLanguage: 'uz', phoneNumberConfirmed: true, hasCompletedDiagnostic: true, tier: 'Free' } })
    return route.fulfill({ json: {} })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.install()
  await page.goto(`${BASE}/games/rod-runner`)
  await page.locator('.runner-overlay').waitFor()
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
    await h.page.clock.runFor(3350)
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
  await h.page.clock.runFor(3350)
  assert.equal(await h.page.getByLabel('Ball', { exact: true }).innerText(), '1')
  await h.page.screenshot({ path: path.join(shots, 'runner-desktop.png'), fullPage: true })
  await h.page.keyboard.press('ArrowRight')
  await h.page.clock.runFor(3350)
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

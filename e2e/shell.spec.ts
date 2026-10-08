import { expect, test } from '@playwright/test'
import { noHorizontalScroll, tapTargetsAtLeast44 } from './helpers'

const ROUTES = ['#/', '#/course', '#/lesson/m01-l01', '#/lesson/m01-l05', '#/assignment/m01-sql-fluency', '#/settings', '#/resources']

test('every screen fits the width, with large tap targets', async ({ page }) => {
  for (const r of ROUTES) {
    await page.goto(`./${r}`)
    await expect(page.locator('h1').first()).toBeVisible()
    await page.waitForTimeout(300)
    await noHorizontalScroll(page)
    await tapTargetsAtLeast44(page)
  }
})

test('today shows the next lesson and the course', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('link', { name: /Resume/ }).first()).toBeVisible()
  await page.goto('./#/course')
  await expect(page.getByRole('button', { name: /SQL fluency/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('link', { name: /Joins without fear/ })).toBeVisible()
})

test('theme is light by default and dark can be chosen in settings', async ({ page }) => {
  await page.goto('./#/settings')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('lessons are readable without downloading the engine', async ({ page }) => {
  const engine: string[] = []
  page.on('request', (r) => { if (/pglite.*\.(wasm|data)$/.test(r.url())) engine.push(r.url()) })
  await page.goto('./#/lesson/m01-l01')
  await expect(page.locator('article p').first()).toBeVisible()
  await expect(page.locator('.sql-block').first()).toBeVisible()
  await page.goto('./#/workbench')
  await expect(page.getByText(/downloads the engine|Start PostgreSQL/).first()).toBeVisible()
  expect(engine, 'the engine must not download until the learner agrees').toEqual([])
})

test('a lesson stays where the reader scrolled it', async ({ page }) => {
  await page.goto('./#/lesson/m01-l02')
  await expect(page.getByRole('button', { name: 'Mark this lesson done' })).toBeAttached()
  // Scrolled from the page, because mobile WebKit in Playwright has no mouse wheel; scroll events fire either way.
  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForTimeout(500)
  // The reading-progress bar re-renders on scroll; that must never send the page back to the top.
  await page.evaluate(() => window.scrollBy(0, 200))
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500)
})

test('the shell and lessons work offline after the first visit', async ({ page, context }) => {
  await page.goto('./')
  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator)
  test.skip(!hasSW, 'service workers are not available in this browser build')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true)
  await context.setOffline(true)
  await page.goto('./#/lesson/m01-l03')
  await expect(page.locator('article p').first()).toBeVisible()
  await page.goto('./#/course')
  await expect(page.getByRole('heading', { level: 1, name: 'Course' })).toBeVisible()
  await context.setOffline(false)
})

test('progress exports and imports', async ({ page }) => {
  await page.goto('./#/lesson/m01-l02')
  await page.getByRole('button', { name: 'Mark this lesson done' }).click()
  await page.goto('./#/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download export file' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(download.suggestedFilename()).toMatch(/^dsm-progress-\d{4}-\d{2}-\d{2}\.json$/)
  page.on('dialog', (d) => void d.accept())
  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByRole('status')).toContainText('Imported: 1 lesson records')
})

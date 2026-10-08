import { expect, test, type Page } from '@playwright/test'

async function noHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(innerWidth)
}

async function tapTargetsAtLeast44(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, .nav a, .brand, .btn')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: el.textContent?.trim(), ...el.getBoundingClientRect().toJSON() }))
      .filter((r) => r.height < 44 || r.width < 44),
  )
  expect(small, 'tap targets must be at least 44 px').toEqual([])
}

test('course map renders all modules', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'Course map' })).toBeVisible()
  await expect(page.locator('main li.card')).toHaveCount(11)
  await noHorizontalScroll(page)
  await tapTargetsAtLeast44(page)
})

test('hash routes load directly and the 404 page works', async ({ page }) => {
  await page.goto('./#/resources')
  await expect(page.getByRole('heading', { level: 1, name: 'Free resources' })).toBeVisible()
  await noHorizontalScroll(page)
  await page.goto('./#/no-such-page')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})

test('theme is light by default and can switch to dark', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('engine check states the download size before loading anything', async ({ page }) => {
  const engineRequests: string[] = []
  page.on('request', (r) => {
    if (/pglite.*\.(wasm|data)$/.test(r.url())) engineRequests.push(r.url())
  })
  await page.goto('./#/spikes')
  await expect(page.getByRole('note')).toContainText(/about \d+\.\d MB/)
  await noHorizontalScroll(page)
  await tapTargetsAtLeast44(page)
  expect(engineRequests, 'engine must not download until asked').toEqual([])
})

test('the shell works offline after the first visit', async ({ page, context }) => {
  await page.goto('./')
  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator)
  test.skip(!hasSW, 'service workers are not available in this browser build')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.reload() // let the service worker take control
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Course map' })).toBeVisible()
  await page.goto('./#/resources')
  await expect(page.getByRole('heading', { level: 1, name: 'Free resources' })).toBeVisible()
  await context.setOffline(false)
})

// Reading features: highlight, comment, the Highlights page, reading options.
import { expect, test, type Page } from '@playwright/test'

/** Selects the first `length` characters of the lesson's first paragraph, as a reader's drag would. */
async function selectText(page: Page, length: number): Promise<string> {
  return page.evaluate((n) => {
    const p = document.querySelector('article p')!
    p.scrollIntoView({ block: 'center' })
    const text = p.firstChild as Text
    const r = document.createRange()
    r.setStart(text, 0)
    r.setEnd(text, Math.min(n, text.data.length))
    const sel = document.getSelection()!
    sel.removeAllRanges()
    sel.addRange(r)
    return r.toString()
  }, length)
}

const painted = (page: Page, name: string) =>
  page.evaluate((n) => (CSS as unknown as { highlights?: Map<string, Set<Range>> }).highlights?.get(n)?.size ?? 0, name)

test('highlight, comment, find it again, delete it', async ({ page }) => {
  await page.goto('./#/lesson/m01-l01')
  await expect(page.locator('article h2').first()).toBeVisible()

  const quote = await selectText(page, 40)
  await page.getByRole('button', { name: 'Highlight green' }).click()
  await expect.poll(() => painted(page, 'dsm-green')).toBe(1)

  // Still there after a reload: stored in the browser, found again by its text.
  await page.reload()
  await expect(page.locator('article h2').first()).toBeVisible()
  await expect.poll(() => painted(page, 'dsm-green')).toBe(1)

  // A comment on another passage.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() => {
    const ps = document.querySelectorAll('article p')
    ps[1]!.scrollIntoView({ block: 'center' })
    const t = ps[1]!.firstChild as Text
    const r = document.createRange()
    r.setStart(t, 0)
    r.setEnd(t, Math.min(30, t.data.length))
    document.getSelection()!.removeAllRanges()
    document.getSelection()!.addRange(r)
  })
  await page.getByRole('button', { name: 'Comment' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Your comment').fill('Joins pair rows; check the count.')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect.poll(() => painted(page, 'dsm-note')).toBe(1)

  // The Highlights page lists both, and searches comments.
  await page.goto('./#/highlights')
  await expect(page.getByText(quote.trim().slice(0, 25))).toBeVisible()
  await expect(page.getByText('Joins pair rows; check the count.')).toBeVisible()
  await page.getByRole('button', { name: 'Comments' }).click()
  await expect(page.getByText(quote.trim().slice(0, 25))).toHaveCount(0)
  await page.getByRole('button', { name: 'All' }).click()

  // Opening one returns to the lesson; tapping the highlight opens it; delete removes it.
  await page.getByText(quote.trim().slice(0, 25)).click()
  await expect(page).toHaveURL(/#\/lesson\/m01-l01/)
  await expect.poll(() => painted(page, 'dsm-green')).toBe(1)
  const box = await page.evaluate(() => {
    document.querySelector('article p')!.scrollIntoView({ block: 'center' })
    const t = document.querySelector('article p')!.firstChild as Text
    const r = document.createRange()
    r.setStart(t, 2)
    r.setEnd(t, 3)
    const b = r.getBoundingClientRect()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  })
  await page.mouse.click(box.x, box.y)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Delete highlight' }).click()
  await expect.poll(() => painted(page, 'dsm-green')).toBe(0)
})

test('reading options: contents, text size and font', async ({ page }) => {
  await page.goto('./#/lesson/m01-l02')
  await expect(page.locator('article h2').first()).toBeVisible()
  const before = await page.locator('article p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  await page.getByRole('button', { name: /Reading options|Contents and text/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Larger' }).click()
  await sheet.getByRole('button', { name: 'Serif' }).click()
  await expect.poll(() => page.locator('article p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(before)
  await expect(page.locator('article')).toHaveAttribute('data-font', 'serif')
  // Contents jump to a section.
  const sections = sheet.getByRole('navigation', { name: 'Lesson contents' }).getByRole('button')
  expect(await sections.count()).toBeGreaterThan(2)
  await sections.nth(2).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
})

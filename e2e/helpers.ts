import { expect, type Page } from '@playwright/test'

export async function noHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
  expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(innerWidth)
}

export async function tapTargetsAtLeast44(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.btn, .icon-btn, .bottom-nav a, .masthead nav a, button.link, a.link')]
      .filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => ({ text: (el.textContent ?? '').trim().slice(0, 40) || el.getAttribute('aria-label'), h: el.getBoundingClientRect().height }))
      .filter((r) => r.h < 44),
  )
  expect(small, 'tap targets must be at least 44 px tall').toEqual([])
}

/** Replaces the CodeMirror editor's text by typing, as a learner would. */
export async function setEditor(page: Page, text: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(text)
}

/** Agrees to the engine download and waits until PostgreSQL is ready with the dataset. */
export async function startEngine(page: Page) {
  const start = page.getByRole('button', { name: /Download .* and start|Start PostgreSQL/ }).first()
  await start.waitFor({ timeout: 15_000 })
  await start.click()
  if (await page.getByRole('button', { name: /Download .* and start/ }).count()) {
    await page.getByRole('button', { name: /Download .* and start/ }).first().click()
  }
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 120_000 })
}

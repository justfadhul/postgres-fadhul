import { expect, type Page } from '@playwright/test'

export async function noHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
  expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(innerWidth)
}

export async function tapTargetsAtLeast44(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.btn, .icon-btn, .bottom-nav a, .masthead nav a, button.link, a.link, [role=tab], summary')]
      .filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => {
        const r = el.getBoundingClientRect()
        // Text links are as wide as their words; everything else must be 44 px both ways.
        const widthCounts = !el.classList.contains('link')
        return { text: (el.textContent ?? '').trim().slice(0, 40) || el.getAttribute('aria-label'), h: Math.round(r.height), w: Math.round(r.width), widthCounts }
      })
      .filter((r) => r.h < 44 || (r.widthCounts && r.w < 44))
      .map(({ text, h, w }) => ({ text, h, w })),
  )
  expect(small, 'tap targets must be at least 44 px tall').toEqual([])
}

/**
 * Replaces the CodeMirror editor's text. Goes through CodeMirror's own view (as a paste would), so it
 * does not depend on which select-all shortcut a browser's emulation honours; falls back to keys.
 */
export async function setEditor(page: Page, text: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  const done = await editor.evaluate((el, t) => {
    type View = { state: { doc: { length: number } }; dispatch: (tr: unknown) => void; focus: () => void }
    const view = (el as HTMLElement & { cmTile?: { root?: { view?: View } } }).cmTile?.root?.view
    if (!view) return false
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: t }, selection: { anchor: t.length } })
    view.focus()
    return true
  }, text)
  if (done) return
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(text)
}

// Lesson pages show a "Loading the lesson…" <p> inside the article first; wait for `article h2`
// (every lesson has sections) before acting on the text.

/** Prints page errors, console errors and navigations, so a CI failure log says what the page did. */
export function watchPage(page: Page) {
  const tag = `[page ${page.viewportSize()?.width ?? '?'}px]`
  page.on('pageerror', (e) => console.log(`${tag} pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`${tag} console.${m.type()}: ${m.text()}`) })
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log(`${tag} navigated: ${f.url()}`) })
}

/** Agrees to the engine download and waits until PostgreSQL is ready with the dataset. */
export async function startEngine(page: Page) {
  watchPage(page)
  try {
    const start = page.getByRole('button', { name: /Download .* and start|Start PostgreSQL/ }).first()
    await start.waitFor({ timeout: 15_000 })
    const label = (await start.textContent()) ?? ''
    await start.click({ timeout: 30_000 })
    // "Start PostgreSQL" leads to the consent button; "Download … and start" was the consent itself,
    // and the button disappears once loading begins, so it must not be clicked twice.
    if (label.startsWith('Start')) {
      const download = page.getByRole('button', { name: /Download .* and start/ }).first()
      const editor = page.locator('.cm-content')
      await expect(download.or(editor).first()).toBeVisible({ timeout: 30_000 })
      if (await download.isVisible()) await download.click({ timeout: 30_000 })
    }
    await expect(page.locator('.cm-content')).toBeVisible({ timeout: 120_000 })
  } catch (e) {
    const text = await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '(page gone)')
    console.log(`[startEngine] failed; page text:\n${text}`)
    throw e
  }
}

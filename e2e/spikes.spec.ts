// Milestone 0 spikes 1 and 2 in a real browser: PGlite in a Web Worker,
// persisted to IndexedDB, at a phone viewport. Results are printed so CI logs
// carry the timings for docs/SPIKES.md.
import { expect, test, type Page } from '@playwright/test'


async function resultsJson(page: Page) {
  // The JSON sits in a closed <details>; its text is readable without opening it.
  return JSON.parse((await page.getByTestId('spike-json').textContent()) ?? '{}') as {
    environment: Record<string, unknown>
    results: { id: string; title: string; pass: boolean; ms: number; details: string[] }[]
  }
}

const printed = new Set<string>()
function print(project: string, phase: string, data: Awaited<ReturnType<typeof resultsJson>>) {
  for (const r of data.results) {
    const key = `${project}:${r.id}:${r.ms}`
    if (printed.has(key)) continue
    printed.add(key)
    console.log(`[spike:${project}:${phase}] ${r.pass ? 'PASS' : 'FAIL'} ${r.id} ${r.ms}ms :: ${r.details.join(' | ')}`)
  }
}

test('engine loads, runs the spike suite, seeds data and persists across reload', async ({ page }, testInfo) => {
  test.setTimeout(300_000)
  const project = testInfo.project.name
  await page.goto('./#/spikes')

  await page.getByTestId('run-core').click()
  await expect(page.getByTestId('result-persist-write')).toBeVisible({ timeout: 120_000 })
  let data = await resultsJson(page)
  print(project, 'core', data)
  console.log(`[spike:${project}:env] ${JSON.stringify(data.environment)}`)
  for (const r of data.results) expect(r.pass, `${r.title}: ${r.details.join('; ')}`).toBe(true)
  for (const id of ['boot', 'version', 'exclusion', 'rls', 'explain', 'persist-write']) {
    expect(data.results.map((r) => r.id)).toContain(id)
  }

  await page.getByTestId('seed-standard').click()
  await expect(page.getByTestId('result-seed-standard')).toBeVisible({ timeout: 180_000 })
  data = await resultsJson(page)
  print(project, 'seed', data)
  expect(data.results.find((r) => r.id === 'seed-standard')?.pass).toBe(true)

  await page.reload()
  await page.getByTestId('check-saved').click()
  await expect(page.getByTestId('result-persist-read')).toBeVisible({ timeout: 120_000 })
  data = await resultsJson(page)
  print(project, 'reopen', data)
  const read = data.results.find((r) => r.id === 'persist-read')
  expect(read?.pass, read?.details.join('; ')).toBe(true)
  expect(read?.details.join(' ')).toContain('100000 visits')
})

test('large dataset', async ({ page }, testInfo) => {
  test.skip(process.env.SPIKE_LARGE !== '1', 'set SPIKE_LARGE=1 to measure the large dataset')
  test.setTimeout(300_000)
  await page.goto('./#/spikes')
  await page.getByTestId('seed-large').click()
  await expect(page.getByTestId('result-seed-large')).toBeVisible({ timeout: 240_000 })
  const data = await resultsJson(page)
  print(testInfo.project.name, 'seed-large', data)
  expect(data.results.find((r) => r.id === 'seed-large')?.pass).toBe(true)
})

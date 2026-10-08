// The workbench and a lesson against the real engine, end to end.
import { expect, test } from '@playwright/test'
import { CHALLENGES } from '../content/modules/m01/challenges'
import { setEditor, startEngine } from './helpers'

test.describe.configure({ mode: 'serial' })

test('run, error, describe, explain, and pass a challenge', async ({ page }, info) => {
  test.setTimeout(300_000)
  const wide = (page.viewportSize()?.width ?? 0) >= 960
  await page.goto('./#/workbench')
  await startEngine(page)

  const run = page.getByRole('button', { name: /^Run/ }).first()
  await run.click()
  await expect(page.locator('table.table tbody tr')).toHaveCount(10, { timeout: 30_000 })
  await expect(page.getByText(/10 rows/).first()).toBeVisible()

  await setEditor(page, 'SELECT nope FROM visits;')
  await run.click()
  await expect(page.getByRole('alert')).toContainText('SQLSTATE 42703')
  await expect(page.getByRole('alert')).toContainText('line 1, column 8')

  await setEditor(page, '\\dt')
  await run.click()
  await expect(page.getByText('List of tables')).toBeVisible({ timeout: 20_000 })

  await setEditor(page, 'SELECT * FROM visits WHERE patient_id = 7')
  await page.getByRole('button', { name: /Explain/ }).first().click()
  await expect(page.getByText(/Seq Scan|Bitmap Heap Scan|Index Scan/).first()).toBeVisible({ timeout: 20_000 })

  const ch = CHALLENGES.find((c) => c.id === 'm01-a01') ?? CHALLENGES[0]
  test.skip(!ch, 'no challenges yet')
  await page.goto(`./#/workbench/${ch!.id}`)
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 60_000 })
  await setEditor(page, ch!.tests.mustFail[0] ?? 'SELECT 1')
  await page.getByRole('button', { name: /^Check/ }).first().click()
  await expect(page.getByText('Not yet')).toBeVisible({ timeout: 30_000 })
  await setEditor(page, ch!.tests.mustPass[0] ?? ch!.grader.reference)
  await page.getByRole('button', { name: /^Check/ }).first().click()
  await expect(page.getByText('Pass', { exact: true })).toBeVisible({ timeout: 30_000 })
  await page.goto('./#/assignment/m01-sql-fluency')
  await expect(page.getByText(/1 of 30 passed/)).toBeVisible()
  info.annotations.push({ type: 'layout', description: wide ? 'wide' : 'phone' })
})

test('a lesson block runs, a quick check records, and the lesson can be marked done', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('./#/workbench')
  await startEngine(page)
  await page.goto('./#/lesson/m01-l01')
  await page.locator('.sql-block').first().getByRole('button', { name: 'Run' }).click()
  await expect(page.locator('.sql-result table').first()).toBeVisible({ timeout: 30_000 })

  const check = page.getByRole('region', { name: 'Quick check' }).first()
  await check.getByRole('group', { name: 'Answers' }).getByRole('button').first().click()
  await expect(check.getByRole('status')).toBeVisible()

  await page.getByRole('button', { name: 'Mark this lesson done' }).click()
  await page.goto('./#/course')
  await expect(page.locator('a[href="#/lesson/m01-l01"] .box.done')).toBeVisible()
})

test('the phone key row inserts characters', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 960, 'the key row is a phone control')
  await page.goto('./#/workbench')
  await startEngine(page)
  await setEditor(page, 'SELECT count')
  await page.getByRole('button', { name: 'Insert (' }).click()
  await page.getByRole('button', { name: 'Insert *' }).click()
  await page.getByRole('button', { name: 'Insert )' }).click()
  await expect(page.locator('.cm-content')).toContainText('SELECT count(*)')
})

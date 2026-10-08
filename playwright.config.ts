import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const BASE_PATH = process.env.BASE_PATH ?? '/'
const PORT = 4173

// Cloud sandboxes ship a pre-installed Chromium that may not match this
// Playwright version; use it rather than downloading. CI installs browsers.
function localChromium(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (process.env.CI || !root || !existsSync(root)) return undefined
  const dir = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop()
  const exe = dir && join(root, dir, 'chrome-linux', 'chrome')
  return exe && existsSync(exe) ? exe : undefined
}
const chromiumLaunch = localChromium() ? { executablePath: localChromium() } : {}

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // WebKit is the closest available stand-in for iOS Safari; it is not the same engine build.
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    // Layout only: one WebKit run of the engine spikes is enough.
    {
      name: 'iphone-webkit-360',
      testIgnore: /spikes\.spec/,
      use: { ...devices['iPhone 13'], viewport: { width: 360, height: 740 } },
    },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunch } },
    {
      name: 'mobile-chromium-360',
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 }, launchOptions: chromiumLaunch },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

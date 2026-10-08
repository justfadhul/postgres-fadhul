// Measures what the learner downloads, from the production build in dist/.
//  - First load: JavaScript referenced by index.html plus the service-worker
//    registration chunk. Budget: 150 KB gzipped (brief, section 8).
//  - Engine: the PGlite worker, WebAssembly, data bundle and extensions. The
//    figure shown to the learner (app/src/db/engineSize.ts) must stay within 10%.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const dist = 'dist'
const assets = readdirSync(join(dist, 'assets'))
const gz = (file) => gzipSync(readFileSync(join(dist, file)), { level: 9 }).length
const kb = (n) => `${(n / 1024).toFixed(1)} KB`

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const referenced = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1].replace(/^.*?assets\//, 'assets/'))
const afterPaint = assets.filter((a) => /^(virtual_pwa-register|workbox-window)/.test(a)).map((a) => `assets/${a}`)
const firstLoad = [...new Set([...referenced, ...afterPaint])]
const firstLoadBytes = firstLoad.reduce((s, f) => s + gz(f), 0)

const engineFiles = assets
  .filter((a) => /^pglite-worker-.*\.js$|^pglite-.*\.(wasm|data)$|^initdb-.*\.wasm$|^btree_gist\.tar/.test(a))
  .map((a) => `assets/${a}`)
const engineBytes = engineFiles.reduce((s, f) => s + gz(f), 0)

const declared = Number(/ENGINE_DOWNLOAD_BYTES = ([\d_]+)/.exec(readFileSync('app/src/db/engineSize.ts', 'utf8'))[1].replaceAll('_', ''))
const drift = Math.abs(engineBytes - declared) / declared

const report = {
  firstLoad: { files: Object.fromEntries(firstLoad.map((f) => [f, gz(f)])), gzipBytes: firstLoadBytes, budgetBytes: 150 * 1024 },
  engine: { files: Object.fromEntries(engineFiles.map((f) => [f, gz(f)])), gzipBytes: engineBytes, declaredBytes: declared, drift },
}
writeFileSync(join(dist, 'size-report.json'), JSON.stringify(report, null, 2))

console.log(`First load JS: ${kb(firstLoadBytes)} gzipped (budget 150 KB)`)
for (const f of firstLoad) console.log(`  ${f} ${kb(gz(f))}`)
console.log(`Engine download: ${(engineBytes / 1e6).toFixed(2)} MB gzipped (shown to learner: ${(declared / 1e6).toFixed(2)} MB)`)
for (const f of engineFiles) console.log(`  ${f} ${kb(gz(f))}`)

let failed = false
if (firstLoadBytes > report.firstLoad.budgetBytes) {
  console.error('FAIL: first-load JavaScript is over the 150 KB budget.')
  failed = true
}
if (engineFiles.length < 3) {
  console.error('FAIL: could not find the engine files in dist/assets; has the build layout changed?')
  failed = true
}
if (drift > 0.1) {
  console.error(`FAIL: engine size differs from ENGINE_DOWNLOAD_BYTES by ${(drift * 100).toFixed(0)}%. Update app/src/db/engineSize.ts.`)
  failed = true
}
process.exit(failed ? 1 : 0)

// Checks a deployed copy of the site. Usage (from the repo root):
//   node scripts/check-deployed.mjs <url>
//  - the shell, service worker and manifest load
//  - every engine file is served, and how: content encoding, bytes on the wire,
//    cache headers. Fails if the engine travels uncompressed (about 16 MB instead
//    of about 6 MB), because that would make the size shown to the learner false.
import { readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import zlib from 'node:zlib'

const base = process.argv[2]?.replace(/\/?$/, '/')
if (!base) {
  console.error('Usage: node scripts/check-deployed.mjs <url>')
  process.exit(2)
}

/** GET without decompressing, so we count the bytes that actually travel. */
function rawGet(url, redirects = 3) {
  const lib = url.startsWith('https:') ? https : http
  return new Promise((resolve, reject) => {
    const req = lib.get(url, { headers: { 'accept-encoding': 'br, gzip', 'user-agent': 'dsm-deploy-check' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume()
        resolve(rawGet(new URL(res.headers.location, url).href, redirects - 1))
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
      res.on('error', reject)
    })
    req.setTimeout(60_000, () => req.destroy(new Error(`timeout fetching ${url}`)))
    req.on('error', reject)
  })
}

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`FAIL: ${msg}`)
}

const page = await rawGet(base)
console.log(`${page.status} ${base} (${page.headers['content-encoding'] ?? 'identity'})`)
if (page.status !== 200) fail(`site root returned ${page.status}`)

for (const path of ['sw.js', 'manifest.webmanifest', 'icon.svg']) {
  const r = await rawGet(base + path)
  console.log(`${r.status} ${path}  cache-control: ${r.headers['cache-control'] ?? '-'}`)
  if (r.status !== 200) fail(`${path} returned ${r.status}`)
}

// Find the engine the way the browser does: follow asset references from
// index.html through the JavaScript chunks (main → Spikes → PGlite worker →
// .wasm, .data, extension bundles). This depends on nothing but the deployed files.
const decode = (r) => {
  const enc = r.headers['content-encoding']
  return (enc === 'br' ? zlib.brotliDecompressSync(r.body) : enc === 'gzip' ? zlib.gunzipSync(r.body) : r.body).toString('utf8')
}
const ASSET_REF = /(?:assets\/|\.\/)([A-Za-z0-9_.-]+\.(?:js|wasm|data|gz))(?![A-Za-z0-9_.-])/g
const ENGINE = /^pglite-worker-.*\.js$|^pglite-.*\.(wasm|data)$|^initdb-.*\.wasm$|^btree_gist\.tar/
const fetched = new Map() // asset name -> response
const html = decode(page)
const queue = [...html.matchAll(ASSET_REF)].map((m) => m[1])
if (!queue.length) {
  console.log(`\nNo asset references found in the page. Its headers and first 600 characters:`)
  console.log(JSON.stringify(page.headers, null, 1))
  console.log(html.slice(0, 600))
}
while (queue.length && fetched.size < 80) {
  const name = queue.shift()
  if (fetched.has(name)) continue
  const r = await rawGet(`${base}assets/${name}`)
  // Some hosts answer a missing file with the app's index.html and status 200.
  if (r.status === 200 && String(r.headers['content-type']).includes('text/html')) r.status = 404
  fetched.set(name, r)
  if (r.status === 200 && name.endsWith('.js')) {
    for (const m of decode(r).matchAll(ASSET_REF)) if (!fetched.has(m[1])) queue.push(m[1])
  }
}

const engine = [...fetched].filter(([name]) => ENGINE.test(name))
const declared = Number(/ENGINE_DOWNLOAD_BYTES = ([\d_]+)/.exec(readFileSync('app/src/db/engineSize.ts', 'utf8'))[1].replaceAll('_', ''))
let wire = 0
console.log(`\nFollowed ${fetched.size} asset references. Engine files:`)
for (const [name, r] of engine) {
  wire += r.body.length
  console.log(
    `  ${r.status} assets/${name}\n      encoding ${r.headers['content-encoding'] ?? 'none'}, ${(r.body.length / 1e6).toFixed(2)} MB on the wire, ` +
      `type ${r.headers['content-type'] ?? '-'}, cache-control ${r.headers['cache-control'] ?? '-'}`,
  )
  if (r.status !== 200) fail(`assets/${name} returned ${r.status}`)
}
for (const [name, r] of fetched) if (r.status !== 200 && !ENGINE.test(name)) fail(`assets/${name} returned ${r.status}`)
const kinds = ['pglite-worker', '.wasm', '.data']
for (const k of kinds) if (!engine.some(([n]) => n.includes(k))) fail(`no engine file matching "${k}" was reachable from index.html`)

console.log(`\nEngine on the wire: ${(wire / 1e6).toFixed(2)} MB (learner is told about ${(declared / 1e6).toFixed(1)} MB)`)
if (wire > declared * 1.3) {
  fail('the engine is served uncompressed or poorly compressed; ship pre-compressed files (see docs/PLAN.md, Risks)')
}

console.log(failures.length ? `\n${failures.length} problem(s).` : '\nDeployed site OK.')
process.exit(failures.length ? 1 : 0)

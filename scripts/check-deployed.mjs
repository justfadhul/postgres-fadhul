// Checks a deployed copy of the site. Usage: node scripts/check-deployed.mjs <url>
//  - the shell, service worker and manifest load
//  - every engine file is served, and how: content encoding, bytes on the wire,
//    cache headers. Fails if the engine travels uncompressed (about 16 MB instead
//    of about 6 MB), because that would make the size shown to the learner false.
import http from 'node:http'
import https from 'node:https'

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

// Written by `npm run check:size`, which the Vercel build runs after `npm run build`.
const reportRes = await rawGet(base + 'size-report.json')
if (reportRes.status !== 200 || !String(reportRes.headers['content-type']).includes('json')) {
  fail(`size-report.json missing (HTTP ${reportRes.status}, ${reportRes.headers['content-type']}); was check:size part of the build?`)
} else {
  const zlib = await import('node:zlib')
  const enc = reportRes.headers['content-encoding']
  const text = enc === 'br' ? zlib.brotliDecompressSync(reportRes.body) : enc === 'gzip' ? zlib.gunzipSync(reportRes.body) : reportRes.body
  const report = JSON.parse(text.toString('utf8'))
  let wire = 0
  console.log('\nEngine files:')
  for (const file of Object.keys(report.engine.files)) {
    const r = await rawGet(base + file)
    wire += r.body.length
    console.log(
      `  ${r.status} ${file}\n      encoding ${r.headers['content-encoding'] ?? 'none'}, ${(r.body.length / 1e6).toFixed(2)} MB on the wire, ` +
        `type ${r.headers['content-type'] ?? '-'}, cache-control ${r.headers['cache-control'] ?? '-'}`,
    )
    if (r.status !== 200) fail(`${file} returned ${r.status}`)
  }
  const declared = report.engine.declaredBytes
  console.log(`\nEngine on the wire: ${(wire / 1e6).toFixed(2)} MB (learner is told about ${(declared / 1e6).toFixed(1)} MB)`)
  if (wire > declared * 1.3) {
    fail('the engine is served uncompressed or poorly compressed; ship pre-compressed files (see docs/PLAN.md, Risks)')
  }
}

console.log(failures.length ? `\n${failures.length} problem(s).` : '\nDeployed site OK.')
process.exit(failures.length ? 1 : 0)

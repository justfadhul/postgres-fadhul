// Checks every external link in content/, docs/ and the repo's Markdown.
// Dead links (404, 410, 5xx, DNS failure) fail the check. Sites that refuse
// automated requests (401, 403, 429) are reported as warnings to check by hand.
//
// Without network access (for example a sandbox behind a proxy) the check is
// skipped with a clear message, unless LINKCHECK_STRICT=1 or CI=true, where a
// missing network is a failure.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['content', 'docs', 'labs', 'app/src', 'README.md', 'CLAUDE.md']
const SKIP_FILES = new Set(['docs/BRIEF.md']) // kept verbatim; its Appendix B links live in content/resources.ts
const EXTS = new Set(['.md', '.mdx', '.ts', '.tsx', '.json'])
// The deployed site itself is checked by scripts/check-deployed.mjs, not here.
const IGNORE = [/^https:\/\/[a-z0-9-]+\.vercel\.app/, /^https?:\/\/localhost/, /^https?:\/\/127\./, /example\.(com|org)/, /\$\{/, /^https:\/\/codespaces\.new\//]
const STRICT = process.env.LINKCHECK_STRICT === '1' || process.env.CI === 'true'

function* files(path) {
  let st
  try {
    st = statSync(path)
  } catch {
    return
  }
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) if (name !== 'node_modules') yield* files(join(path, name))
  } else if (EXTS.has(extname(path)) && !SKIP_FILES.has(path)) yield path
}

const urls = new Map()
for (const root of ROOTS) {
  for (const file of files(root)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/https?:\/\/[^\s'"`)<>\]]+/g)) {
      const url = m[0].replace(/[.,;:]+$/, '')
      if (IGNORE.some((re) => re.test(url))) continue
      if (!urls.has(url)) urls.set(url, new Set())
      urls.get(url).add(file)
    }
  }
}

const UA = 'Mozilla/5.0 (link check for a self-study course; contact via GitHub) AppleWebKit/537.36 Chrome/130 Safari/537.36'

async function probe(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) })
      if (res.status >= 400) {
        res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) })
        await res.body?.cancel()
      }
      if (res.status >= 500 && attempt < 2) continue
      return { status: res.status }
    } catch (e) {
      if (attempt === 2) return { error: e.cause?.code ?? e.message }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
}

// One probe to decide whether this machine can reach the internet at all.
// A proxy that denies the host (403) counts as no access too.
const canary = await probe('https://www.postgresql.org/')
if (canary.error || canary.status >= 400) {
  const msg = `Link check: no usable network access (${canary.error ?? `HTTP ${canary.status} for postgresql.org`}). ${urls.size} links NOT checked.`
  if (STRICT) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.warn(`SKIPPED: ${msg} CI runs this check with network access.`)
  process.exit(0)
}

const results = []
const queue = [...urls.keys()]
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const url = queue.shift()
      results.push({ url, ...(await probe(url)) })
    }
  }),
)

const dead = results.filter((r) => r.error || r.status === 404 || r.status === 410 || r.status >= 500)
const refused = results.filter((r) => !dead.includes(r) && r.status >= 400)
for (const r of results.sort((a, b) => a.url.localeCompare(b.url))) {
  const tag = dead.includes(r) ? 'DEAD   ' : refused.includes(r) ? 'REFUSED' : 'ok     '
  console.log(`${tag} ${r.status ?? r.error} ${r.url}`)
}
for (const r of dead) console.error(`  ${r.url} is linked from: ${[...urls.get(r.url)].join(', ')}`)
console.log(`\n${results.length} links: ${results.length - dead.length - refused.length} ok, ${refused.length} refused automated checks (check by hand), ${dead.length} dead.`)
process.exit(dead.length ? 1 : 0)

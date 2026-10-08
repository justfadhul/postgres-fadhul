// Splits SQL text into statements on top-level semicolons, respecting
// 'strings', "identifiers", -- and /* */ comments, and $tag$ bodies.
export function splitStatements(sql: string): string[] {
  const out: string[] = []
  let start = 0
  let i = 0
  const n = sql.length
  while (i < n) {
    const c = sql[i]!
    const next = sql[i + 1]
    if (c === "'" || c === '"') {
      i++
      while (i < n && !(sql[i] === c && sql[i + 1] !== c)) i += sql[i] === c ? 2 : 1
      i++
    } else if (c === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') i++
    } else if (c === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? n : end + 2
    } else if (c === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))?.[0]
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length)
        i = end === -1 ? n : end + tag.length
      } else i++
    } else if (c === ';') {
      out.push(sql.slice(start, i))
      start = ++i
    } else i++
  }
  out.push(sql.slice(start))
  return out.map((s) => s.trim()).filter((s) => s.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '').trim() !== '')
}

// A small SQL highlighter for lesson blocks (the full editor is loaded only in the workbench).
import type { ReactNode } from 'react'

const KEYWORDS = new Set(('select from where join left right full inner outer cross on using group by order having limit offset as and or not in is null ' +
  'distinct case when then else end with recursive union all intersect except insert into values update set delete create table index ' +
  'drop alter primary key references foreign unique check default exists between like ilike asc desc nulls first last lateral over partition ' +
  'rows range preceding following current row unbounded filter true false interval timestamptz timestamp date time zone at explain analyze buffers ' +
  'begin commit rollback returning materialized cycle search depth breadth any some cast coalesce').split(' '))

const TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|(\b[a-z_][a-z0-9_]*\b)(\s*\()?|([\s\S])/gi

export function highlightSql(sql: string): ReactNode[] {
  const out: ReactNode[] = []
  let m: RegExpExecArray | null
  let plain = ''
  let i = 0
  const flush = () => { if (plain) { out.push(plain); plain = '' } }
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(sql))) {
    const [, comment, str, num, word, paren, other] = m
    if (comment) { flush(); out.push(<span key={i++} className="cm">{comment}</span>) }
    else if (str) { flush(); out.push(<span key={i++} className="st">{str}</span>) }
    else if (num) { flush(); out.push(<span key={i++} className="nm">{num}</span>) }
    else if (word) {
      if (KEYWORDS.has(word.toLowerCase())) { flush(); out.push(<span key={i++} className="kw">{word}</span>) }
      else if (paren) { flush(); out.push(<span key={i++} className="fn">{word}</span>) }
      else plain += word
      if (paren) plain += paren
    } else if (other !== undefined) plain += other
  }
  flush()
  return out
}

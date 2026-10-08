// Finding a highlight again. A highlight is stored as the quoted text plus a little
// context either side (like the W3C "text quote selector"), not as positions in the
// page, so it survives re-renders and small edits to the lesson. These functions work
// on the lesson's plain text; Annotations.tsx maps between that text and the page.

export interface TextQuote {
  quote: string
  prefix: string
  suffix: string
}

const CONTEXT = 32

export function quoteAt(text: string, start: number, end: number): TextQuote {
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  }
}

function commonSuffix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

function commonPrefix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/** Where the quote starts in the text, choosing the occurrence whose context matches best; -1 if it is gone. */
export function locateQuote(text: string, q: TextQuote): number {
  if (!q.quote) return -1
  let best = -1
  let bestScore = -1
  for (let i = text.indexOf(q.quote); i >= 0; i = text.indexOf(q.quote, i + 1)) {
    const score =
      commonSuffix(text.slice(Math.max(0, i - q.prefix.length), i), q.prefix) +
      commonPrefix(text.slice(i + q.quote.length, i + q.quote.length + q.suffix.length), q.suffix)
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  }
  return best
}

/** Trims spaces off both ends of a selection, so a highlight starts and ends on words. */
export function trimSelection(text: string, start: number, end: number): [number, number] {
  while (start < end && /\s/.test(text[start] ?? '')) start++
  while (end > start && /\s/.test(text[end - 1] ?? '')) end--
  return [start, end]
}

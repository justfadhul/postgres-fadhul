import { describe, expect, it } from 'vitest'
import { locateQuote, quoteAt, trimSelection } from './anchor'

const TEXT = 'A join pairs rows. An inner join keeps matches. A left join keeps every row on the left, matched or not.'

describe('text quote anchors', () => {
  it('finds a quote again by its text', () => {
    const start = TEXT.indexOf('inner join')
    const q = quoteAt(TEXT, start, start + 'inner join'.length)
    expect(q.quote).toBe('inner join')
    expect(locateQuote(TEXT, q)).toBe(start)
  })

  it('picks the right occurrence when the same words appear twice', () => {
    const second = TEXT.indexOf('join keeps', TEXT.indexOf('left'))
    const q = quoteAt(TEXT, second, second + 'join keeps'.length)
    expect(locateQuote(TEXT, q)).toBe(second)
    const first = TEXT.indexOf('join keeps')
    expect(locateQuote(TEXT, quoteAt(TEXT, first, first + 10))).toBe(first)
  })

  it('still finds the quote after text is added before it', () => {
    const start = TEXT.indexOf('left join')
    const q = quoteAt(TEXT, start, start + 9)
    const edited = `New first sentence. ${TEXT}`
    expect(locateQuote(edited, q)).toBe(start + 'New first sentence. '.length)
  })

  it('reports a quote that no longer exists', () => {
    expect(locateQuote(TEXT, { quote: 'outer apply', prefix: '', suffix: '' })).toBe(-1)
    expect(locateQuote(TEXT, { quote: '', prefix: '', suffix: '' })).toBe(-1)
  })

  it('trims spaces from the ends of a selection', () => {
    expect(trimSelection('  hello world ', 0, 14)).toEqual([2, 13])
    expect(trimSelection('   ', 0, 3)).toEqual([3, 3])
  })
})

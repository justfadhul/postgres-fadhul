import { describe, expect, it } from 'vitest'
import { splitStatements } from './statements'

describe('splitStatements', () => {
  it('splits on top-level semicolons only', () => {
    expect(splitStatements(`CREATE INDEX i ON t (a); SELECT 'a;b' AS "x;y" FROM t; -- c;\n`)).toEqual([
      'CREATE INDEX i ON t (a)',
      `SELECT 'a;b' AS "x;y" FROM t`,
    ])
  })
  it('handles doubled quotes, block comments and dollar quotes', () => {
    expect(splitStatements(`SELECT 'it''s; fine'; /* a; b */ SELECT $$x;y$$; SELECT $f$ ; $f$`)).toHaveLength(3)
  })
  it('drops empty and comment-only pieces', () => {
    expect(splitStatements(`;; -- nothing\n /* still nothing */ ;`)).toEqual([])
  })
})

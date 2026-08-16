import { describe, expect, it } from 'vitest'
import { csvString } from './csv'

describe('csvString', () => {
  it('joins rows with newlines and cells with commas', () => {
    expect(csvString([['a', 'b'], ['c']])).toBe('a,b\nc')
  })

  it('neutralises formula-injection cells with a leading apostrophe', () => {
    expect(csvString([['=1+1']])).toBe("'=1+1")
    expect(csvString([['+SUM(A1)']])).toBe("'+SUM(A1)")
    expect(csvString([['-2+3']])).toBe("'-2+3")
    expect(csvString([['@cmd']])).toBe("'@cmd")
  })

  it('does not mangle benign cells', () => {
    expect(csvString([['hello', '123', 'formula?no']])).toBe('hello,123,formula?no')
  })

  it('quotes cells containing commas or newlines and escapes quotes', () => {
    expect(csvString([['a,b']])).toBe('"a,b"')
    expect(csvString([['say "hi"']])).toBe('"say ""hi"""')
    expect(csvString([['line1\nline2']])).toBe('"line1\nline2"')
  })

  it('renders null/undefined as empty cells', () => {
    expect(csvString([[null, undefined, 'x']])).toBe(',,x')
  })
})

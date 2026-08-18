import { describe, expect, it } from 'vitest'
import { pbErrorMessage } from './pbError'

const label = (k: string) => `L(${k})`

describe('pbErrorMessage', () => {
  it('extracts per-field messages from err.data', () => {
    const err = {
      data: {
        data: {
          building: { code: 'validation_required', message: 'Cannot be blank.' },
          from: { code: 'validation_greater_equal', message: 'Must be in the future.' },
        },
      },
    }
    const out = pbErrorMessage(err, label)
    expect(out).toContain('L(building): Cannot be blank.')
    expect(out).toContain('L(reqFrom): Must be in the future.')
  })

  it('maps spot-number uniqueness to a friendly message', () => {
    const err = {
      data: {
        data: { number: { code: 'validation_not_unique', message: 'Failed to create record.' } },
      },
    }
    expect(pbErrorMessage(err, label)).toBe('L(adminSpotNumberExists)')
  })

  it('ignores field entries without a message', () => {
    const err = { data: { data: { name: {} } } }
    expect(pbErrorMessage(err, label)).toBe('')
  })

  it('falls back to the Error message', () => {
    expect(pbErrorMessage(new Error('boom'), label)).toBe('boom')
  })

  it('returns an empty string for unknown input', () => {
    expect(pbErrorMessage(null, label)).toBe('')
    expect(pbErrorMessage('nope', label)).toBe('')
    expect(pbErrorMessage(undefined, label)).toBe('')
  })
})

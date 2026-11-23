import { describe, expect, it } from 'vitest'
import { cleanTag, isTagTaken, nextTag, normalizeTag } from './tags'

describe('tags', () => {
  it('normalises case and whitespace for uniqueness', () => {
    expect(normalizeTag(' kam - 03 ')).toBe('KAM-03')
    expect(isTagTaken('kam-03', ['KAM-01', 'KAM-03'])).toBe(true)
    expect(isTagTaken('KAM-05', ['KAM-01', 'KAM-03'])).toBe(false)
    expect(cleanTag('  valo   01 ')).toBe('VALO 01')
  })

  it('suggests the next free number, keeping prefix and padding', () => {
    expect(nextTag('KAM-03', ['KAM-01', 'KAM-02', 'KAM-03'])).toBe('KAM-04')
    expect(nextTag('KAM-03', ['KAM-03', 'KAM-04', 'kam-05'])).toBe('KAM-06')
    expect(nextTag('KAM-09', ['KAM-09'])).toBe('KAM-10')
    expect(nextTag('XLR10', ['XLR10'])).toBe('XLR11')
    expect(nextTag('MIKSERI', ['MIKSERI'])).toBe('MIKSERI-2')
    expect(nextTag('äänipöytä-1', [])).toBe('ÄÄNIPÖYTÄ-2')
  })
})

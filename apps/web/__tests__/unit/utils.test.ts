import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhone, isValidKoreanPhone } from '@/lib/utils/phone'
import { normalizeBrand, BRAND_ALIAS_MAP } from '@/lib/utils/brand'
import { inferCategory } from '@/lib/utils/category'
import { formatKRW, parseKRW } from '@/lib/utils/currency'
import { chunkArray } from '@/lib/utils/chunk'
import { generateOrderNumber, generateProductNumber } from '@/lib/utils/id'
import { buildSmsMessage } from '@/lib/utils/sms-templates'
import { getPhotoUrl } from '@/lib/utils/photo-url'

describe('phone utils', () => {
  it('normalizePhone removes hyphens', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678')
  })

  it('normalizePhone strips non-digits', () => {
    expect(normalizePhone(' 010 1234 5678 ')).toBe('01012345678')
  })

  it('formatPhone adds hyphens (11 digits)', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678')
  })

  it('isValidKoreanPhone validates correctly', () => {
    expect(isValidKoreanPhone('01012345678')).toBe(true)
    expect(isValidKoreanPhone('0101234567')).toBe(true) // 10 digits (old format)
    expect(isValidKoreanPhone('0212345678')).toBe(false) // landline
    expect(isValidKoreanPhone('abc')).toBe(false)
  })
})

describe('brand utils', () => {
  it('normalizeBrand resolves Korean alias', () => {
    expect(normalizeBrand('에르메스')).toBe('HERMES')
    expect(normalizeBrand('루이비통')).toBe('LOUIS VUITTON')
  })

  it('normalizeBrand resolves English alias', () => {
    expect(normalizeBrand('gucci')).toBe('GUCCI')
    expect(normalizeBrand('Prada')).toBe('PRADA')
  })

  it('normalizeBrand uppercases unknown brands', () => {
    expect(normalizeBrand('UnknownBrand')).toBe('UNKNOWNBRAND')
  })

  it('BRAND_ALIAS_MAP has entries', () => {
    expect(Object.keys(BRAND_ALIAS_MAP).length).toBeGreaterThan(10)
  })
})

describe('category utils', () => {
  it('infers jacket category', () => {
    expect(inferCategory('울 블레이저 자켓')).toBe('자켓')
  })

  it('infers pants category', () => {
    expect(inferCategory('울 슬랙스 팬츠')).toBe('바지')
  })

  it('returns 기타 for unknown', () => {
    expect(inferCategory('something random')).toBe('기타')
  })
})

describe('currency utils', () => {
  it('formatKRW formats with comma', () => {
    const result = formatKRW(1234567)
    expect(result).toContain('1,234,567')
    expect(result).toContain('원')
  })

  it('parseKRW removes formatting', () => {
    expect(parseKRW('1,234,567원')).toBe(1234567)
  })

  it('parseKRW roundtrip', () => {
    expect(parseKRW(formatKRW(999000))).toBe(999000)
  })

  it('parseKRW throws on invalid input', () => {
    expect(() => parseKRW('abc')).toThrow()
  })
})

describe('chunk utils', () => {
  it('chunks array correctly', () => {
    const result = chunkArray([1, 2, 3, 4, 5], 2)
    expect(result).toEqual([[1, 2], [3, 4], [5]])
  })

  it('handles empty array', () => {
    expect(chunkArray([], 3)).toEqual([])
  })

  it('handles exact multiple', () => {
    const result = chunkArray([1, 2, 3, 4], 2)
    expect(result).toEqual([[1, 2], [3, 4]])
  })

  it('handles single chunk', () => {
    expect(chunkArray([1, 2], 10)).toEqual([[1, 2]])
  })

  it('throws on invalid size', () => {
    expect(() => chunkArray([1], 0)).toThrow()
    expect(() => chunkArray([1], -1)).toThrow()
  })
})

describe('id utils', () => {
  it('generateOrderNumber has ORD- prefix', () => {
    const id = generateOrderNumber()
    expect(id).toMatch(/^ORD-\d{8}-\d{6}$/)
  })

  it('generateProductNumber has PRD- prefix', () => {
    const id = generateProductNumber()
    expect(id).toMatch(/^PRD-\d{8}-\d{6}$/)
  })

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateOrderNumber()))
    expect(ids.size).toBe(10)
  })
})

describe('sms-templates', () => {
  it('replaces template variables', () => {
    const msg = buildSmsMessage('CONSIGNMENT_RECEIVED', {
      sellerName: '홍길동',
      warehousePhone: '010-6644-6190',
    })
    expect(msg).toContain('홍길동')
    expect(msg).toContain('010-6644-6190')
    expect(msg).not.toContain('{{')
  })

  it('builds settlement message', () => {
    const msg = buildSmsMessage('SETTLEMENT_CONFIRMED', {
      sellerName: '김판매',
      period: '2026-01-01 ~ 2026-01-31',
      amount: '1,234,567원',
    })
    expect(msg).toContain('김판매')
    expect(msg).toContain('1,234,567원')
  })
})

describe('photo-url', () => {
  it('returns legacy path by default', () => {
    const url = getPhotoUrl('prod-123', 'front.jpg')
    expect(url).toBe('/uploads/photos/prod-123/front.jpg')
  })
})

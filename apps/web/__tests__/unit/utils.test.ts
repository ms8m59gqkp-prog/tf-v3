import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhone, isValidKoreanPhone } from '@/lib/utils/phone'
import { normalizeBrand, BRAND_ALIAS_MAP } from '@/lib/utils/brand'
import { inferCategory } from '@/lib/utils/category'
import { formatKRW, parseKRW } from '@/lib/utils/currency'
import { chunkArray } from '@/lib/utils/chunk'
import { generateOrderNumber, generateProductNumber } from '@/lib/utils/id'
import { buildSmsMessage } from '@/lib/utils/sms-templates'
import { getPhotoUrl } from '@/lib/utils/photo-url'
import {
  isValidDateString,
  toKSTDate,
  toKSTDateTime,
  toStartOfDay,
} from '@/lib/utils/date'

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

  it('normalizeBrand resolves V2 classic brand (Korean)', () => {
    expect(normalizeBrand('드레익스')).toBe("DRAKE'S")
    expect(normalizeBrand('볼리올리')).toBe('BOGLIOLI')
    expect(normalizeBrand('로로피아나')).toBe('LORO PIANA')
  })

  it('normalizeBrand resolves V2 classic brand (English)', () => {
    expect(normalizeBrand('ring jacket')).toBe('RING JACKET')
    expect(normalizeBrand('brooks brothers')).toBe('BROOKS BROTHERS')
  })

  it('BRAND_ALIAS_MAP has 59+ canonical brands (V2 43 + V3 16)', () => {
    const canonicals = new Set(Object.values(BRAND_ALIAS_MAP))
    expect(canonicals.size).toBeGreaterThanOrEqual(59)
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
  it('generateOrderNumber: YYYYMMDD-숫자6 (V2 형식)', () => {
    const id = generateOrderNumber()
    expect(id).toMatch(/^\d{8}-\d{6}$/)
  })

  it('generateProductNumber: YYYYMMDD-알파벳6 (V2 형식)', () => {
    const id = generateProductNumber()
    expect(id).toMatch(/^\d{8}-[A-Z]{6}$/)
  })

  it('generates unique order numbers', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateOrderNumber()))
    expect(ids.size).toBe(10)
  })

  it('generates unique product numbers', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateProductNumber()))
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

// ---------------------------------------------------------------------------
// CR-01: sms-templates ReDoS 방어
// ---------------------------------------------------------------------------

describe('sms-templates (CR-01 ReDoS)', () => {
  it('throws on missing placeholder params', () => {
    expect(() => buildSmsMessage('CONSIGNMENT_RECEIVED', {
      sellerName: '홍길동',
      // warehousePhone intentionally omitted
    })).toThrow('SMS 템플릿 미치환 변수')
  })
})

// ---------------------------------------------------------------------------
// CR-02: date.ts isValidDateString round-trip 검증
// ---------------------------------------------------------------------------

describe('date utils (CR-02 rollover)', () => {
  it('rejects rolled-over dates', () => {
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('2026-02-29')).toBe(false) // 2026 is not a leap year
    expect(isValidDateString('2026-04-31')).toBe(false) // April has 30 days
    expect(isValidDateString('2026-06-31')).toBe(false) // June has 30 days
  })

  it('accepts valid dates', () => {
    expect(isValidDateString('2026-03-04')).toBe(true)
    expect(isValidDateString('2024-02-29')).toBe(true)  // 2024 IS leap year
    expect(isValidDateString('2026-01-31')).toBe(true)
    expect(isValidDateString('2026-12-31')).toBe(true)
  })

  it('rejects bad format', () => {
    expect(isValidDateString('03-04-2026')).toBe(false)
    expect(isValidDateString('not-a-date')).toBe(false)
    expect(isValidDateString('')).toBe(false)
  })

  it('toStartOfDay throws on invalid rollover date', () => {
    expect(() => toStartOfDay('2026-02-30')).toThrow('유효하지 않은 날짜')
  })
})

// ---------------------------------------------------------------------------
// CR-03: toKSTDate/toKSTDateTime Invalid Date 가드
// ---------------------------------------------------------------------------

describe('date display utils (CR-03 invalid input)', () => {
  it('toKSTDate converts UTC ISO to KST date string', () => {
    // 2026-03-04T15:00:00Z = 2026-03-05 00:00 KST
    expect(toKSTDate('2026-03-04T15:00:00Z')).toBe('2026-03-05')
  })

  it('toKSTDate throws on invalid input', () => {
    expect(() => toKSTDate('invalid')).toThrow('유효하지 않은 UTC ISO 문자열')
    expect(() => toKSTDate('')).toThrow('유효하지 않은 UTC ISO 문자열')
  })

  it('toKSTDateTime converts UTC ISO to KST datetime string', () => {
    expect(toKSTDateTime('2026-03-04T15:30:00Z')).toBe('2026-03-05 00:30')
  })

  it('toKSTDateTime throws on invalid input', () => {
    expect(() => toKSTDateTime('not-a-date')).toThrow('유효하지 않은 UTC ISO 문자열')
  })
})

/**
 * 유틸리티 함수 테스트
 * WHY: V2 비즈니스 규칙 정확 재현 검증
 * HOW: 포맷/파싱/정규화 함수 단위 테스트
 * WHERE: Phase 1 유틸리티 검증
 */
import { describe, it, expect } from 'vitest'
import { formatPhone, normalizePhone, isValidPhone } from '@/lib/utils/phone'
import { normalizeBrand, isKnownBrand } from '@/lib/utils/brand'
import { normalizeCategory } from '@/lib/utils/category'
import { formatCurrency, formatNumber, parseCurrency } from '@/lib/utils/currency'
import { formatDate, formatDateTime, isValidDate } from '@/lib/utils/date'
import { generateOrderNumber } from '@/lib/utils/id'
import { chunk } from '@/lib/utils/chunk'
import { getProductPhotoPath, getFileExtension, isImageFile } from '@/lib/utils/path'
import { normalizeHeader, parseExcelDate, isEmptyRow } from '@/lib/utils/excel'

describe('phone', () => {
  it('formatPhone: 11자리 → 010-XXXX-XXXX', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678')
  })

  it('normalizePhone: 하이픈 제거', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678')
  })

  it('isValidPhone: 유효/무효', () => {
    expect(isValidPhone('01012345678')).toBe(true)
    expect(isValidPhone('0201234567')).toBe(false)
  })
})

describe('brand', () => {
  it('normalizeBrand: 한글 → 영문', () => {
    expect(normalizeBrand('루이비통')).toBe('LOUIS VUITTON')
    expect(normalizeBrand('샤넬')).toBe('CHANEL')
  })

  it('normalizeBrand: 약어', () => {
    expect(normalizeBrand('lv')).toBe('LOUIS VUITTON')
    expect(normalizeBrand('ysl')).toBe('SAINT LAURENT')
  })

  it('normalizeBrand: 미등록 → 원본 반환', () => {
    expect(normalizeBrand('UnknownBrand')).toBe('UnknownBrand')
  })

  it('isKnownBrand', () => {
    expect(isKnownBrand('gucci')).toBe(true)
    expect(isKnownBrand('NoSuchBrand')).toBe(false)
  })
})

describe('category', () => {
  it('normalizeCategory: 영문 → 한글', () => {
    expect(normalizeCategory('bag')).toBe('가방')
    expect(normalizeCategory('watches')).toBe('시계')
  })

  it('normalizeCategory: 한글 그대로', () => {
    expect(normalizeCategory('가방')).toBe('가방')
  })
})

describe('currency', () => {
  it('formatCurrency: 원화 포맷', () => {
    const result = formatCurrency(1234567)
    expect(result).toContain('1,234,567')
  })

  it('formatNumber: 숫자 포맷', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('parseCurrency: 문자열 → 숫자', () => {
    expect(parseCurrency('₩1,234,567')).toBe(1234567)
  })
})

describe('date', () => {
  it('formatDate: YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-03-04T12:00:00Z'))).toMatch(/2026-03-0[34]/)
  })

  it('formatDateTime: YYYY-MM-DD HH:mm', () => {
    const result = formatDateTime(new Date('2026-03-04T12:00:00Z'))
    expect(result).toMatch(/2026-03-0[34] \d{2}:\d{2}/)
  })

  it('isValidDate', () => {
    expect(isValidDate('2026-03-04')).toBe(true)
    expect(isValidDate('invalid')).toBe(false)
  })
})

describe('id', () => {
  it('generateOrderNumber: YYYYMMDD-XXXXXX 포맷', () => {
    const num = generateOrderNumber(new Date('2026-03-04'))
    expect(num).toMatch(/^20260304-\d{6}$/)
  })

  it('generateOrderNumber: 6자리 0-패딩', () => {
    const results = Array.from({ length: 20 }, () => generateOrderNumber())
    results.forEach((num) => {
      const suffix = num.split('-')[1]
      expect(suffix).toHaveLength(6)
    })
  })
})

describe('chunk', () => {
  it('배열 분할', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('빈 배열', () => {
    expect(chunk([], 3)).toEqual([])
  })

  it('크기 0 이하 에러', () => {
    expect(() => chunk([1], 0)).toThrow()
  })
})

describe('path', () => {
  it('getProductPhotoPath', () => {
    expect(getProductPhotoPath('2602157392528', 'main.jpg'))
      .toBe('products/2602157392528/main.jpg')
  })

  it('getFileExtension', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg')
    expect(getFileExtension('noext')).toBe('')
  })

  it('isImageFile', () => {
    expect(isImageFile('photo.jpg')).toBe(true)
    expect(isImageFile('doc.pdf')).toBe(false)
  })
})

describe('excel', () => {
  it('normalizeHeader', () => {
    expect(normalizeHeader(' Product Name ')).toBe('product_name')
  })

  it('parseExcelDate', () => {
    const d = parseExcelDate(44926)
    expect(d.getFullYear()).toBe(2022)
  })

  it('isEmptyRow', () => {
    expect(isEmptyRow({ a: null, b: '', c: undefined as unknown as null })).toBe(true)
    expect(isEmptyRow({ a: 'value' })).toBe(false)
  })
})

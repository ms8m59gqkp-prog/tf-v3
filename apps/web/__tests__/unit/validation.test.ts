import { describe, it, expect } from 'vitest'
import {
  PhoneSchema,
  UuidSchema,
  DateSchema,
  PositiveAmountSchema,
  PaginationSchema,
} from '@/lib/utils/validation'

describe('PhoneSchema', () => {
  it.each([
    '010-1234-5678',
    '01012345678',
    '011-234-5678',
    '016-1234-5678',
    '019-1234-5678',
  ])('accepts valid: %s', (phone) => {
    expect(PhoneSchema.safeParse(phone).success).toBe(true)
  })

  it.each([
    '02-1234-5678',
    '012-1234-5678',
    '010-123-567',
    'not-a-phone',
    '',
  ])('rejects invalid: %s', (phone) => {
    expect(PhoneSchema.safeParse(phone).success).toBe(false)
  })
})

describe('UuidSchema', () => {
  it('accepts valid UUID', () => {
    expect(UuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true)
  })
  it('rejects non-UUID', () => {
    expect(UuidSchema.safeParse('not-a-uuid').success).toBe(false)
  })
})

describe('DateSchema', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(DateSchema.safeParse('2026-03-04').success).toBe(true)
  })
  it('rejects invalid format', () => {
    expect(DateSchema.safeParse('03-04-2026').success).toBe(false)
    expect(DateSchema.safeParse('2026/03/04').success).toBe(false)
  })
})

describe('PositiveAmountSchema', () => {
  it('accepts positive number', () => {
    expect(PositiveAmountSchema.safeParse(100).success).toBe(true)
  })
  it('rejects zero', () => {
    expect(PositiveAmountSchema.safeParse(0).success).toBe(false)
  })
  it('rejects negative', () => {
    expect(PositiveAmountSchema.safeParse(-1).success).toBe(false)
  })
})

describe('PaginationSchema', () => {
  it('applies defaults', () => {
    const result = PaginationSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })
  it('coerces string to number', () => {
    const result = PaginationSchema.parse({ page: '3', limit: '50' })
    expect(result.page).toBe(3)
    expect(result.limit).toBe(50)
  })
  it('rejects page < 1', () => {
    expect(PaginationSchema.safeParse({ page: 0 }).success).toBe(false)
  })
  it('rejects limit > 100', () => {
    expect(PaginationSchema.safeParse({ limit: 101 }).success).toBe(false)
  })
})

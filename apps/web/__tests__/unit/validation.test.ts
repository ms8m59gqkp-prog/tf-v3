/**
 * Zod 검증 스키마 테스트
 * WHY: 공용 5개 스키마 통과/거부 검증
 * HOW: 유효값 PASS + 무효값 FAIL 테스트
 * WHERE: Phase 1 validation.ts 검증
 */
import { describe, it, expect } from 'vitest'
import {
  phoneSchema,
  sellerCodeSchema,
  productNumberSchema,
  orderIdSchema,
  priceSchema,
} from '@/lib/utils/validation'

describe('phoneSchema', () => {
  it('유효: 01012345678', () => {
    expect(phoneSchema.safeParse('01012345678').success).toBe(true)
  })

  it('유효: 01112345678', () => {
    expect(phoneSchema.safeParse('01112345678').success).toBe(true)
  })

  it('무효: 하이픈 포함', () => {
    expect(phoneSchema.safeParse('010-1234-5678').success).toBe(false)
  })

  it('무효: 짧은 번호', () => {
    expect(phoneSchema.safeParse('0101234').success).toBe(false)
  })
})

describe('sellerCodeSchema', () => {
  it('유효: 5자리 숫자', () => {
    expect(sellerCodeSchema.safeParse('92528').success).toBe(true)
    expect(sellerCodeSchema.safeParse('00001').success).toBe(true)
  })

  it('무효: 4자리', () => {
    expect(sellerCodeSchema.safeParse('1234').success).toBe(false)
  })

  it('무효: 문자 포함', () => {
    expect(sellerCodeSchema.safeParse('1234a').success).toBe(false)
  })
})

describe('productNumberSchema', () => {
  it('유효: 13자리 숫자', () => {
    expect(productNumberSchema.safeParse('2602157392528').success).toBe(true)
  })

  it('무효: 12자리', () => {
    expect(productNumberSchema.safeParse('260215739252').success).toBe(false)
  })

  it('무효: 하이픈 포함', () => {
    expect(productNumberSchema.safeParse('260215-739252').success).toBe(false)
  })
})

describe('orderIdSchema', () => {
  it('유효: YYYYMMDD-XXXXXX', () => {
    expect(orderIdSchema.safeParse('20260304-000042').success).toBe(true)
  })

  it('무효: 하이픈 없음', () => {
    expect(orderIdSchema.safeParse('20260304000042').success).toBe(false)
  })

  it('무효: 날짜 7자리', () => {
    expect(orderIdSchema.safeParse('2026034-000042').success).toBe(false)
  })
})

describe('priceSchema', () => {
  it('유효: 양수 정수', () => {
    expect(priceSchema.safeParse(150000).success).toBe(true)
  })

  it('유효: 0', () => {
    expect(priceSchema.safeParse(0).success).toBe(true)
  })

  it('무효: 음수', () => {
    expect(priceSchema.safeParse(-100).success).toBe(false)
  })

  it('무효: 소수', () => {
    expect(priceSchema.safeParse(100.5).success).toBe(false)
  })
})

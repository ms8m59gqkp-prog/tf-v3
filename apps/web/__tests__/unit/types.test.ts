/**
 * 도메인 타입 상수 검증 테스트
 * WHY: V2 CHECK 제약 18종과 1:1 대응 확인
 * HOW: 상수 배열 값/길이 검증
 * WHERE: Phase 1 타입 검증
 */
import { describe, it, expect } from 'vitest'
import {
  SELLER_STATUSES, SELLER_TIERS, CHANNEL_TYPES, COMMISSION_RATES, getCommissionRate,
} from '@/lib/types/domain/seller'
import {
  CONSIGNMENT_STATUSES, CONSIGNMENT_SOURCES, SELLER_RESPONSES, ALLOWED_TRANSITIONS,
} from '@/lib/types/domain/consignment'
import {
  ORDER_STATUSES, INSPECTION_STATUSES, CONDITION_LABELS,
} from '@/lib/types/domain/order'
import {
  SETTLEMENT_STATUSES, SOLD_ITEM_STATUSES, SALES_CHANNELS, MATCH_STATUSES,
} from '@/lib/types/domain/settlement'
import {
  PRODUCT_TYPES, PHOTO_STATUSES, SMARTSTORE_STATUSES, RETAIL_PRICE_SOURCES,
} from '@/lib/types/domain/product'
import {
  SMS_STATUSES, BATCH_STATUSES,
} from '@/lib/types/domain/notification'

describe('seller 상수', () => {
  it('SELLER_STATUSES: 5값', () => {
    expect(SELLER_STATUSES).toHaveLength(5)
    expect(SELLER_STATUSES).toContain('pending')
    expect(SELLER_STATUSES).toContain('active')
    expect(SELLER_STATUSES).toContain('inactive')
    expect(SELLER_STATUSES).toContain('suspended')
    expect(SELLER_STATUSES).toContain('expired')
  })

  it('SELLER_TIERS: 3값', () => {
    expect(SELLER_TIERS).toEqual(['general', 'employee', 'vip'])
  })

  it('CHANNEL_TYPES: 3값', () => {
    expect(CHANNEL_TYPES).toEqual(['half_size', 'full_size', 'both'])
  })

  it('COMMISSION_RATES: 티어별 기본값', () => {
    expect(COMMISSION_RATES.general).toBe(0.25)
    expect(COMMISSION_RATES.employee).toBe(0.20)
    expect(COMMISSION_RATES.vip).toBe(0.20)
  })

  it('getCommissionRate: 개별값 우선', () => {
    expect(getCommissionRate({ commissionRate: 0.15, sellerTier: 'general' })).toBe(0.15)
  })

  it('getCommissionRate: 개별값 없으면 티어 기본값', () => {
    expect(getCommissionRate({ commissionRate: null, sellerTier: 'general' })).toBe(0.25)
    expect(getCommissionRate({ commissionRate: 0, sellerTier: 'employee' })).toBe(0.20)
    expect(getCommissionRate({ sellerTier: 'vip' })).toBe(0.20)
  })
})

describe('consignment 상수', () => {
  it('CONSIGNMENT_STATUSES: 7값', () => {
    expect(CONSIGNMENT_STATUSES).toHaveLength(7)
    expect(CONSIGNMENT_STATUSES).toContain('pending')
    expect(CONSIGNMENT_STATUSES).toContain('received')
    expect(CONSIGNMENT_STATUSES).toContain('inspecting')
    expect(CONSIGNMENT_STATUSES).toContain('on_hold')
    expect(CONSIGNMENT_STATUSES).toContain('approved')
    expect(CONSIGNMENT_STATUSES).toContain('rejected')
    expect(CONSIGNMENT_STATUSES).toContain('completed')
  })

  it('CONSIGNMENT_SOURCES: 4값', () => {
    expect(CONSIGNMENT_SOURCES).toEqual(['naver_form', 'employee', 'manual', 'direct'])
  })

  it('SELLER_RESPONSES: 3값', () => {
    expect(SELLER_RESPONSES).toEqual(['accepted', 'counter', 'cancelled'])
  })

  it('ALLOWED_TRANSITIONS: V2 검증 완료 상태 전이', () => {
    expect(ALLOWED_TRANSITIONS.completed).toEqual([])
    expect(ALLOWED_TRANSITIONS.rejected).toEqual([])
    expect(ALLOWED_TRANSITIONS.approved).toEqual(['received', 'on_hold', 'rejected'])
  })
})

describe('order 상수', () => {
  it('ORDER_STATUSES: 10값 (신청관리 전용)', () => {
    expect(ORDER_STATUSES).toHaveLength(10)
    expect(ORDER_STATUSES).toContain('APPLIED')
    expect(ORDER_STATUSES).toContain('CONFIRMED')
    expect(ORDER_STATUSES).toContain('CANCELLED')
  })

  it('INSPECTION_STATUSES: 3값', () => {
    expect(INSPECTION_STATUSES).toEqual(['pending', 'completed', 'hold'])
  })

  it('CONDITION_LABELS: N=NEW', () => {
    expect(CONDITION_LABELS['N']).toBe('NEW')
    expect(CONDITION_LABELS['S']).toBe('S급')
  })
})

describe('settlement 상수', () => {
  it('SETTLEMENT_STATUSES: 4값 (draft, confirmed, paid, failed)', () => {
    expect(SETTLEMENT_STATUSES).toEqual(['draft', 'confirmed', 'paid', 'failed'])
  })

  it('SOLD_ITEM_STATUSES: 4값 (pending, calculated, settled, returned)', () => {
    expect(SOLD_ITEM_STATUSES).toEqual(['pending', 'calculated', 'settled', 'returned'])
  })

  it('SALES_CHANNELS: 2값', () => {
    expect(SALES_CHANNELS).toEqual(['smart_store', 'self_mall'])
  })

  it('MATCH_STATUSES: 3값', () => {
    expect(MATCH_STATUSES).toEqual(['unmatched', 'auto_matched', 'manual_matched'])
  })
})

describe('product 상수', () => {
  it('PRODUCT_TYPES: 2값', () => {
    expect(PRODUCT_TYPES).toEqual(['consignment', 'inventory'])
  })

  it('PHOTO_STATUSES: 4값', () => {
    expect(PHOTO_STATUSES).toEqual(['pending', 'shooting', 'editing', 'completed'])
  })

  it('SMARTSTORE_STATUSES: 4값', () => {
    expect(SMARTSTORE_STATUSES).toEqual(['draft', 'ready', 'uploaded', 'selling'])
  })

  it('RETAIL_PRICE_SOURCES: 3값', () => {
    expect(RETAIL_PRICE_SOURCES).toEqual(['naver_estimate', 'manual', 'desired_price'])
  })
})

describe('notification/batch 상수', () => {
  it('SMS_STATUSES: 3값', () => {
    expect(SMS_STATUSES).toEqual(['pending', 'sent', 'failed'])
  })

  it('BATCH_STATUSES: 4값', () => {
    expect(BATCH_STATUSES).toEqual(['running', 'completed', 'partial', 'failed'])
  })
})

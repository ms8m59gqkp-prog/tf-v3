/**
 * Tokyo DB 실제 연결 통합 테스트
 * WHY: Phase 1 타입/상수가 실제 DB 스키마 및 데이터와 정합하는지 검증
 * HOW: supabase-js로 Tokyo DB 직접 쿼리 → Phase 1 타입으로 파싱
 * WHERE: Phase 1 검증 게이트
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  SELLER_STATUSES, SELLER_TIERS, CHANNEL_TYPES, getCommissionRate,
  type SellerTier,
} from '@/lib/types/domain/seller'
import {
  CONSIGNMENT_STATUSES, CONSIGNMENT_SOURCES,
} from '@/lib/types/domain/consignment'
import {
  ORDER_STATUSES, INSPECTION_STATUSES,
} from '@/lib/types/domain/order'
import {
  PRODUCT_TYPES, PHOTO_STATUSES, SMARTSTORE_STATUSES,
} from '@/lib/types/domain/product'
import { formatPhone, normalizePhone, isValidPhone } from '@/lib/utils/phone'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

// Supabase generated types 미생성 — 런타임 검증 목적이므로 any 캐스팅
type AnyRow = Record<string, unknown>

// Tokyo Supabase (service_role로 RLS 우회)
const TOKYO_URL = 'https://jmgscpmkrvvxxuzejrdf.supabase.co'
const TOKYO_SERVICE_KEY = process.env.TOKYO_SERVICE_ROLE_KEY || ''

let supabase: ReturnType<typeof createClient>
let hasConnection = false

beforeAll(async () => {
  if (!TOKYO_SERVICE_KEY) {
    console.warn('TOKYO_SERVICE_ROLE_KEY 미설정 — DB 테스트 스킵')
    return
  }
  supabase = createClient(TOKYO_URL, TOKYO_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  // 연결 확인
  const { error } = await supabase.from('sellers').select('id').limit(1)
  hasConnection = !error
  if (error) console.warn('DB 연결 실패:', error.message)
})

function skipIfNoConnection() {
  if (!hasConnection) {
    console.warn('DB 미연결 — 테스트 스킵')
    return true
  }
  return false
}

// ─── sellers ────────────────────────────────────────────────

describe('sellers 실데이터 검증', () => {
  it('sellers 조회 + Seller 타입 호환', async () => {
    if (skipIfNoConnection()) return

    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .limit(5)

    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(data!.length).toBeGreaterThan(0)

    // 모든 행이 Phase 1 Seller 인터페이스 필드를 가짐
    for (const row of data as AnyRow[]) {
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('seller_code')
      expect(row).toHaveProperty('name')
      expect(row).toHaveProperty('phone')
      expect(row).toHaveProperty('seller_tier')
      expect(row).toHaveProperty('status')
      expect(row).toHaveProperty('address') // migration 017 추가

      // status가 SELLER_STATUSES에 포함
      if (row.status) {
        expect(SELLER_STATUSES).toContain(row.status)
      }
      // seller_tier가 SELLER_TIERS에 포함
      if (row.seller_tier) {
        expect(SELLER_TIERS).toContain(row.seller_tier)
      }
      // channel_type이 CHANNEL_TYPES에 포함
      if (row.channel_type) {
        expect(CHANNEL_TYPES).toContain(row.channel_type)
      }
    }
  })

  it('getCommissionRate vs DB get_commission_rate 일치', async () => {
    if (skipIfNoConnection()) return

    const { data } = await supabase
      .from('sellers')
      .select('id, commission_rate, seller_tier')
      .limit(5)

    for (const row of data as AnyRow[]) {
      const tsRate = getCommissionRate({
        commissionRate: row.commission_rate as number | null,
        sellerTier: ((row.seller_tier as string) || 'general') as SellerTier,
      })

      // DB RPC 호출
      const { data: rpcData } = await supabase.rpc('get_commission_rate' as never, {
        p_seller_id: row.id,
      } as never)

      expect(tsRate).toBe(Number(rpcData))
    }
  })
})

// ─── consignment_requests ────────────────────────────────────

describe('consignment_requests 실데이터 검증', () => {
  it('조회 + 상태값 CHECK 일치', async () => {
    if (skipIfNoConnection()) return

    const { data, error } = await supabase
      .from('consignment_requests')
      .select('*')
      .limit(10)

    expect(error).toBeNull()

    for (const row of data as AnyRow[]) {
      if (row.status) {
        expect(CONSIGNMENT_STATUSES).toContain(row.status)
      }
      if (row.source) {
        expect(CONSIGNMENT_SOURCES).toContain(row.source)
      }
      // 28컬럼 존재 확인
      expect(row).toHaveProperty('seller_id')
      expect(row).toHaveProperty('product_name')
      expect(row).toHaveProperty('desired_price')
      expect(row).toHaveProperty('product_condition')
    }
  })
})

// ─── orders + order_items ─────────────────────────────────────

describe('orders 실데이터 검증', () => {
  it('orders.status CHECK 일치', async () => {
    if (skipIfNoConnection()) return

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .limit(5)

    expect(error).toBeNull()

    for (const row of data as AnyRow[]) {
      if (row.status) {
        expect(ORDER_STATUSES).toContain(row.status)
      }
      expect(row).toHaveProperty('order_number')
      expect(row).toHaveProperty('customer_name')
      expect(row).toHaveProperty('hold_token')
    }
  })

  it('order_items.inspection_status CHECK 일치', async () => {
    if (skipIfNoConnection()) return

    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .limit(5)

    expect(error).toBeNull()

    for (const row of data as AnyRow[]) {
      expect(INSPECTION_STATUSES).toContain(row.inspection_status)
    }
  })
})

// ─── st_products ───────────────────────────────────────────────

describe('st_products 실데이터 검증', () => {
  it('36컬럼 + CHECK 일치', async () => {
    if (skipIfNoConnection()) return

    const { data, error } = await supabase
      .from('st_products')
      .select('*')
      .limit(5)

    expect(error).toBeNull()

    for (const row of data as AnyRow[]) {
      if (row.product_type) expect(PRODUCT_TYPES).toContain(row.product_type)
      if (row.photo_status) expect(PHOTO_STATUSES).toContain(row.photo_status)
      if (row.smartstore_status) expect(SMARTSTORE_STATUSES).toContain(row.smartstore_status)

      // H-6~8 매핑 확인: retail_price, sale_price, photos 컬럼 존재
      expect(row).toHaveProperty('retail_price')
      expect(row).toHaveProperty('sale_price')
      expect(row).toHaveProperty('photos')
      expect(row).toHaveProperty('product_condition')

      // 팬텀 필드 없음: model, description, sub_category 컬럼 없어야 함
      expect(row).not.toHaveProperty('model')
      expect(row).not.toHaveProperty('description')
      expect(row).not.toHaveProperty('sub_category')
    }
  })
})

// ─── RPC 함수 호출 ─────────────────────────────────────────────

describe('RPC 함수 실행', () => {
  it('generate_seller_code: 5자리 숫자 + 결정적', async () => {
    if (skipIfNoConnection()) return

    const { data: code1 } = await supabase.rpc('generate_seller_code' as never, {
      p_name: '테스트유저',
      p_phone: '01099998888',
      p_address: '서울시 강남구',
    } as never)
    const { data: code2 } = await supabase.rpc('generate_seller_code' as never, {
      p_name: '테스트유저',
      p_phone: '01099998888',
      p_address: '서울시 강남구',
    } as never)

    expect(code1).toMatch(/^\d{5}$/)
    expect(code1).toBe(code2) // 결정적
  })

  it('generate_seller_code: 다른 입력 → 다른 코드', async () => {
    if (skipIfNoConnection()) return

    const { data: code1 } = await supabase.rpc('generate_seller_code' as never, {
      p_name: '김철수', p_phone: '01011112222', p_address: '서울',
    } as never)
    const { data: code2 } = await supabase.rpc('generate_seller_code' as never, {
      p_name: '박영희', p_phone: '01033334444', p_address: '부산',
    } as never)

    expect(code1).not.toBe(code2)
  })

  it('generate_product_number: 셀러코드 형식에 따른 결과', async () => {
    if (skipIfNoConnection()) return

    // V2 레거시 셀러(NF001~8)는 문자열 코드라 순수 숫자가 아닐 수 있음
    // 5자리 숫자 셀러코드를 가진 셀러가 있으면 13자리 숫자, 없으면 포맷만 확인
    const { data: sellers } = await supabase
      .from('sellers')
      .select('id, seller_code')
      .limit(10)

    const rows = sellers as AnyRow[]
    const numericSeller = rows.find((s) => /^\d{5}$/.test(s.seller_code as string))

    if (numericSeller) {
      const { data: prodNum, error } = await supabase.rpc('generate_product_number' as never, {
        p_seller_id: numericSeller.id,
      } as never)
      expect(error).toBeNull()
      expect(String(prodNum)).toMatch(/^\d{13}$/)
    } else {
      // V2 레거시 셀러로 테스트: YYMMDD + 2자리 + 셀러코드 형식
      const { data: prodNum, error } = await supabase.rpc('generate_product_number' as never, {
        p_seller_id: rows[0].id,
      } as never)
      expect(error).toBeNull()
      expect(prodNum).toBeTruthy()
      expect(typeof prodNum).toBe('string')
      expect(String(prodNum).length).toBeGreaterThanOrEqual(8)
    }
  })

  it('generate_order_number: YYYYMMDD-XXXXXX', async () => {
    if (skipIfNoConnection()) return

    const { data, error } = await supabase.rpc('generate_order_number' as never)

    expect(error).toBeNull()
    expect(String(data)).toMatch(/^\d{8}-\d{6}$/)
  })
})

// ─── 유틸리티 vs 실데이터 ───────────────────────────────────────

describe('유틸리티 함수 vs 실데이터', () => {
  it('formatPhone: 실제 판매자 전화번호 (유효 데이터만)', async () => {
    if (skipIfNoConnection()) return

    const { data } = await supabase
      .from('sellers')
      .select('phone')
      .limit(10)

    // V2 테스트 데이터(1, 2, 3 등) 필터링 — 실제 전화번호만 검증
    const validPhones = (data as AnyRow[]).filter((row) => {
      const digits = (row.phone as string).replace(/\D/g, '')
      return digits.length >= 10
    })

    expect(validPhones.length).toBeGreaterThan(0)

    for (const row of validPhones) {
      const normalized = normalizePhone(row.phone as string)
      expect(isValidPhone(normalized)).toBe(true)
      const formatted = formatPhone(normalized)
      expect(formatted).toMatch(/^\d{3}-\d{3,4}-\d{4}$/)
    }
  })

  it('formatCurrency: 실제 상품 가격', async () => {
    if (skipIfNoConnection()) return

    const { data } = await supabase
      .from('st_products')
      .select('sale_price')
      .limit(3)

    for (const row of data as AnyRow[]) {
      const formatted = formatCurrency(row.sale_price as number)
      expect(formatted).toContain('₩')
    }
  })

  it('formatDate: 실제 생성일', async () => {
    if (skipIfNoConnection()) return

    const { data } = await supabase
      .from('sellers')
      .select('created_at')
      .limit(3)

    for (const row of data as AnyRow[]) {
      if (row.created_at) {
        const formatted = formatDate(row.created_at as string)
        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })
})

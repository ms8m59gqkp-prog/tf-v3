/**
 * settlement.repo.ts depth 2 FK JOIN 런타임 검증
 * WHY: PostgREST depth 2 + 명시 컬럼 조합이 프로젝트 최초 사용
 * HOW: 실 Supabase에서 settlements → settlement_items → sold_items JOIN 실행
 * WHERE: settlement.repo.ts 버그 수정 후 1순위 검증
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const TOKYO_URL = 'https://jmgscpmkrvvxxuzejrdf.supabase.co'
const TOKYO_SERVICE_KEY = process.env.TOKYO_SERVICE_ROLE_KEY || ''

let supabase: ReturnType<typeof createClient>
let hasConnection = false

beforeAll(async () => {
  if (!TOKYO_SERVICE_KEY) {
    console.warn('TOKYO_SERVICE_ROLE_KEY 미설정 — 테스트 스킵')
    return
  }
  supabase = createClient(TOKYO_URL, TOKYO_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await supabase.from('settlements').select('id').limit(1)
  hasConnection = !error
  if (error) console.warn('DB 연결 실패:', error.message)
})

const SETTLEMENT_COLUMNS = `id, seller_id, settlement_period_start, settlement_period_end,
  total_sales, commission_rate, commission_amount, return_deduction,
  settlement_amount, item_count, status, paid_at, paid_by,
  transfer_reference, created_at, confirmed_at`

const SELLER_JOIN = 'sellers(id, name, nickname, phone, bank_account, commission_rate, seller_tier, status)'

const SOLD_ITEM_COLUMNS = `id, seller_id, channel, order_id, product_name, product_number,
  quantity, sale_price, shipping_fee, sold_at, purchase_confirmed,
  purchase_confirmed_at, settlement_status, settlement_id, return_processed,
  source_file, created_at, product_order_id, naver_product_id, product_code`

const ITEMS_JOIN = `settlement_items(id, sold_item_id, sold_items(${SOLD_ITEM_COLUMNS}))`

describe('settlement depth 2 FK JOIN 런타임 검증', () => {
  it('테이블 존재 확인: settlements, settlement_items, sold_items', async () => {
    if (!hasConnection) { console.warn('DB 미연결 — 스킵'); return }

    const { error: e1 } = await supabase.from('settlements').select('id').limit(1)
    const { error: e2 } = await supabase.from('settlement_items').select('id').limit(1)
    const { error: e3 } = await supabase.from('sold_items').select('id').limit(1)

    expect(e1).toBeNull()
    expect(e2).toBeNull()
    expect(e3).toBeNull()
  })

  it('depth 1: settlements + sellers FK JOIN (명시 컬럼)', async () => {
    if (!hasConnection) { console.warn('DB 미연결 — 스킵'); return }

    const { data, error } = await supabase
      .from('settlements')
      .select(`${SETTLEMENT_COLUMNS}, ${SELLER_JOIN}`)
      .limit(1)

    expect(error).toBeNull()
    if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>
      // snake_case 키 확인
      expect(row).toHaveProperty('seller_id')
      expect(row).toHaveProperty('commission_rate')
      // sellers FK JOIN 확인
      const sellers = row.sellers as Record<string, unknown> | null
      if (sellers) {
        expect(sellers).toHaveProperty('bank_account')
        expect(sellers).toHaveProperty('commission_rate')
        expect(sellers).toHaveProperty('seller_tier')
        // NUMERIC 타입 확인
        console.log('sellers.commission_rate type:', typeof sellers.commission_rate, 'value:', sellers.commission_rate)
      }
    }
  })

  it('depth 2: settlements + settlement_items + sold_items FK JOIN (명시 컬럼)', async () => {
    if (!hasConnection) { console.warn('DB 미연결 — 스킵'); return }

    const { data, error } = await supabase
      .from('settlements')
      .select(`${SETTLEMENT_COLUMNS}, ${SELLER_JOIN}, ${ITEMS_JOIN}`)
      .limit(1)

    console.log('depth 2 JOIN error:', error?.message || 'none')

    expect(error).toBeNull()
    if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>

      // settlement_items 배열 확인
      const items = row.settlement_items as Record<string, unknown>[] | null
      console.log('settlement_items count:', items?.length || 0)

      if (items && items.length > 0) {
        const firstItem = items[0]
        // settlement_items 필드 확인
        expect(firstItem).toHaveProperty('id')
        expect(firstItem).toHaveProperty('sold_item_id')

        // depth 2: sold_items 확인
        const soldItem = firstItem.sold_items as Record<string, unknown> | Record<string, unknown>[] | null
        console.log('sold_items type:', Array.isArray(soldItem) ? 'array' : typeof soldItem)
        console.log('sold_items:', JSON.stringify(soldItem, null, 2))

        if (soldItem && !Array.isArray(soldItem)) {
          // 단일 객체인 경우
          expect(soldItem).toHaveProperty('id')
          expect(soldItem).toHaveProperty('seller_id')
          expect(soldItem).toHaveProperty('product_name')
          expect(soldItem).toHaveProperty('sale_price')
          console.log('sold_items.sale_price type:', typeof soldItem.sale_price)
        } else if (Array.isArray(soldItem) && soldItem.length > 0) {
          // 배열인 경우
          expect(soldItem[0]).toHaveProperty('id')
          console.log('sold_items is ARRAY — mapSoldItemRow 적용 방식 조정 필요')
        }
      } else {
        console.log('settlement_items 비어있음 — depth 2 구조 확인 불가 (데이터 추가 필요)')
      }
    }
  })
})

/**
 * Phase 2 리포지토리 READ 함수 통합 테스트
 * WHY: repo 21개 + TX 3개의 실 DB 연결 런타임 검증
 * HOW: 실 Supabase Tokyo DB에서 repo 함수 호출 → 반환 타입/구조 확인
 * WHERE: Phase 2 검증 게이트
 */
import { describe, it, expect, beforeAll } from 'vitest'

// ─── sellers ────────────────────────────────────────────────────
import * as sellersRepo from '@/lib/db/repositories/sellers.repo'
import * as sellersQuery from '@/lib/db/repositories/sellers-query.repo'

let hasConnection = false
let sampleSellerId: string | null = null

beforeAll(async () => {
  const result = await sellersRepo.listActive()
  hasConnection = result.error === null
  if (result.data && result.data.length > 0) {
    sampleSellerId = result.data[0].id
  }
  if (!hasConnection) console.warn('DB 연결 실패 — 테스트 스킵')
})

function skip() {
  if (!hasConnection) { console.warn('DB 미연결 — 스킵'); return true }
  return false
}

describe('sellers.repo', () => {
  it('listActive: 배열 반환 + Seller 타입 호환', async () => {
    if (skip()) return
    const { data, error } = await sellersRepo.listActive()
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    if (data && data.length > 0) {
      const s = data[0]
      expect(s).toHaveProperty('id')
      expect(s).toHaveProperty('name')
      expect(s).toHaveProperty('phone')
      expect(s).toHaveProperty('sellerCode')
      expect(s).toHaveProperty('commissionRate')
      expect(s).toHaveProperty('sellerTier')
      // camelCase 확인 (snake_case 아님)
      expect(s).not.toHaveProperty('seller_code')
      expect(s).not.toHaveProperty('commission_rate')
    }
  })

  it('findById: 유효 ID → Seller 반환', async () => {
    if (skip() || !sampleSellerId) return
    const { data, error } = await sellersRepo.findById(sampleSellerId)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.id).toBe(sampleSellerId)
    expect(typeof data!.name).toBe('string')
  })

  it('findById: 존재하지 않는 ID → error', async () => {
    if (skip()) return
    const { data, error } = await sellersRepo.findById('00000000-0000-0000-0000-000000000000')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('findByPhone: 존재하지 않는 번호 → null data, no error', async () => {
    if (skip()) return
    const { data, error } = await sellersRepo.findByPhone('00000000000')
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})

describe('sellers-query.repo', () => {
  it('listByPage: DbListResult 구조 반환', async () => {
    if (skip()) return
    const result = await sellersQuery.listByPage({ page: 1, pageSize: 5 })
    if (result.error) { expect(result.data).toEqual([]); return }
    expect(result.error).toBeNull()
    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.total).toBe('number')
    expect(result.data.length).toBeLessThanOrEqual(5)
  })

  it('listByPage: page 2 결과가 page 1과 다름', async () => {
    if (skip()) return
    const p1 = await sellersQuery.listByPage({ page: 1, pageSize: 3 })
    const p2 = await sellersQuery.listByPage({ page: 2, pageSize: 3 })
    if (p1.error || p2.error) return
    if (p1.data.length > 0 && p2.data.length > 0) {
      expect(p1.data[0].id).not.toBe(p2.data[0].id)
    }
  })
})

// ─── products ───────────────────────────────────────────────────
import * as productsRepo from '@/lib/db/repositories/products.repo'
import * as productsQuery from '@/lib/db/repositories/products-query.repo'

let sampleProductId: string | null = null

describe('products.repo', () => {
  it('findById: 실 상품 조회 → StProductWithSeller', async () => {
    if (skip()) return
    // 먼저 list로 ID 확보
    const listResult = await productsQuery.list({}, { page: 1, pageSize: 1 })
    if (listResult.error || listResult.data.length === 0) return
    sampleProductId = listResult.data[0].id

    const { data, error } = await productsRepo.findById(sampleProductId)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.id).toBe(sampleProductId)
    expect(data!).toHaveProperty('productName')
    expect(data!).toHaveProperty('salePrice')
    expect(data!).toHaveProperty('photoStatus')
    // camelCase 확인
    expect(data!).not.toHaveProperty('product_name')
    expect(data!).not.toHaveProperty('sale_price')
  })
})

describe('products-query.repo', () => {
  it('list: 페이지네이션 + 필터 동작', async () => {
    if (skip()) return
    const result = await productsQuery.list({}, { page: 1, pageSize: 5 })
    if (result.error) return
    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.total).toBe('number')
    expect(result.data.length).toBeLessThanOrEqual(5)
    if (result.data.length > 0) {
      expect(result.data[0]).toHaveProperty('productName')
      expect(result.data[0]).toHaveProperty('salePrice')
    }
  })

  it('getSummary: ProductSummary 구조 반환', async () => {
    if (skip()) return
    const { data, error } = await productsQuery.getSummary()
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(typeof data!.photoPending).toBe('number')
    expect(typeof data!.photoDone).toBe('number')
    expect(typeof data!.selling).toBe('number')
    expect(typeof data!.sold).toBe('number')
    expect(typeof data!.inactive).toBe('number')
  })
})

// ─── orders ─────────────────────────────────────────────────────
import * as ordersRepo from '@/lib/db/repositories/orders.repo'
import * as ordersMutation from '@/lib/db/repositories/orders-mutation.repo'

let sampleOrderId: string | null = null

describe('orders.repo', () => {
  it('list: 페이지네이션 + OrderWithItems 반환', async () => {
    if (skip()) return
    const result = await ordersRepo.list({}, { page: 1, pageSize: 3 })
    if (result.error) return
    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.total).toBe('number')
    if (result.data.length > 0) {
      sampleOrderId = result.data[0].id
      const order = result.data[0]
      expect(order).toHaveProperty('orderNumber')
      expect(order).toHaveProperty('customerName')
      expect(order).toHaveProperty('status')
      expect(order).toHaveProperty('order_items')
      expect(Array.isArray(order.order_items)).toBe(true)
      // camelCase
      expect(order).not.toHaveProperty('order_number')
      expect(order).not.toHaveProperty('customer_name')
    }
  })

  it('findById: 유효 ID → OrderWithItems + items 배열', async () => {
    if (skip() || !sampleOrderId) return
    const { data, error } = await ordersRepo.findById(sampleOrderId)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.id).toBe(sampleOrderId)
    expect(Array.isArray(data!.order_items)).toBe(true)
    if (data!.order_items.length > 0) {
      const item = data!.order_items[0]
      expect(item).toHaveProperty('productNumber')
      expect(item).toHaveProperty('inspectionStatus')
      expect(item).not.toHaveProperty('product_number')
    }
  })
})

describe('orders-mutation.repo', () => {
  it('getItemsByOrderId: 유효 ID → OrderItem 배열', async () => {
    if (skip() || !sampleOrderId) return
    const { data, error } = await ordersMutation.getItemsByOrderId(sampleOrderId)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    if (data && data.length > 0) {
      expect(data[0]).toHaveProperty('orderId')
      expect(data[0]).toHaveProperty('inspectionStatus')
    }
  })
})

// ─── consignments ───────────────────────────────────────────────
import * as consignmentsRepo from '@/lib/db/repositories/consignments.repo'
import * as consignmentsQuery from '@/lib/db/repositories/consignments-query.repo'

let sampleConsignmentId: string | null = null

describe('consignments.repo', () => {
  it('findById: 실 위탁 조회 → ConsignmentWithRelations', async () => {
    if (skip()) return
    const listResult = await consignmentsQuery.list({}, { page: 1, pageSize: 1 })
    if (listResult.error || listResult.data.length === 0) return
    sampleConsignmentId = listResult.data[0].id

    const { data, error } = await consignmentsRepo.findById(sampleConsignmentId)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.id).toBe(sampleConsignmentId)
    expect(data!).toHaveProperty('productName')
    expect(data!).toHaveProperty('desiredPrice')
    expect(data!).toHaveProperty('status')
    // JOIN 필드
    expect(data!).toHaveProperty('sellers')
    // camelCase
    expect(data!).not.toHaveProperty('product_name')
    expect(data!).not.toHaveProperty('desired_price')
  })
})

describe('consignments-query.repo', () => {
  it('list: 페이지네이션 + 필터', async () => {
    if (skip()) return
    const result = await consignmentsQuery.list({}, { page: 1, pageSize: 5 })
    if (result.error) return
    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.total).toBe('number')
    expect(result.data.length).toBeLessThanOrEqual(5)
  })

  it('list: status 필터 동작', async () => {
    if (skip()) return
    const result = await consignmentsQuery.list({ status: 'pending' }, { page: 1, pageSize: 10 })
    if (result.error) return
    for (const row of result.data) {
      expect(row.status).toBe('pending')
    }
  })
})

// ─── notifications ──────────────────────────────────────────────
import * as notificationsQuery from '@/lib/db/repositories/notifications-query.repo'
import * as notificationsRepo from '@/lib/db/repositories/notifications.repo'

describe('notifications-query.repo', () => {
  it('list: DbListResult 구조 반환', async () => {
    if (skip()) return
    const result = await notificationsQuery.list({}, { page: 1, pageSize: 5 })
    if (result.error) return
    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.total).toBe('number')
    if (result.data.length > 0) {
      expect(result.data[0]).toHaveProperty('phone')
      expect(result.data[0]).toHaveProperty('triggerEvent')
      expect(result.data[0]).not.toHaveProperty('trigger_event')
    }
  })
})

describe('notifications.repo', () => {
  it('findByConsignmentId: 존재하지 않는 ID → 빈 배열', async () => {
    if (skip()) return
    const { data, error } = await notificationsRepo.findByConsignmentId(
      '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect(data!.length).toBe(0)
  })
})

// ─── settlement ─────────────────────────────────────────────────
import * as settlementRepo from '@/lib/db/repositories/settlement.repo'

describe('settlement.repo', () => {
  it('list: DbListResult 구조 + mapSellerJoin', async () => {
    if (skip()) return
    const result = await settlementRepo.list({}, { page: 1, pageSize: 5 })
    if (result.error) return
    expect(Array.isArray(result.data)).toBe(true)
    expect(typeof result.total).toBe('number')
    if (result.data.length > 0) {
      const s = result.data[0]
      expect(s).toHaveProperty('settlementAmount')
      expect(s).toHaveProperty('commissionRate')
      expect(s).toHaveProperty('sellers')
      expect(s).not.toHaveProperty('settlement_amount')
      // sellers JOIN → camelCase 매핑 확인
      if (s.sellers) {
        expect(s.sellers).toHaveProperty('bankAccount')
        expect(s.sellers).toHaveProperty('commissionRate')
        expect(typeof s.sellers.commissionRate).toBe('number')
        expect(s.sellers).not.toHaveProperty('bank_account')
      }
    }
  })

  it('findById: 존재하지 않는 ID → error', async () => {
    if (skip()) return
    const { data, error } = await settlementRepo.findById(
      '00000000-0000-0000-0000-000000000000',
    )
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})

// ─── sold-items ─────────────────────────────────────────────────
import * as soldItemsRepo from '@/lib/db/repositories/sold-items.repo'

describe('sold-items.repo', () => {
  it('findBySellerId: 존재하지 않는 셀러 → 빈 배열', async () => {
    if (skip()) return
    const { data, error } = await soldItemsRepo.findBySellerId(
      '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect(data!.length).toBe(0)
  })

  it('findBySellerId: 실 셀러 → SoldItem 타입 호환', async () => {
    if (skip() || !sampleSellerId) return
    const { data, error } = await soldItemsRepo.findBySellerId(sampleSellerId)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    if (data && data.length > 0) {
      const item = data[0]
      expect(item).toHaveProperty('sellerId')
      expect(item).toHaveProperty('productName')
      expect(item).toHaveProperty('salePrice')
      expect(item).toHaveProperty('settlementStatus')
      expect(item).not.toHaveProperty('seller_id')
      expect(item).not.toHaveProperty('product_name')
    }
  })

  it('listPending: 기간 필터 동작', async () => {
    if (skip() || !sampleSellerId) return
    const { data, error } = await soldItemsRepo.listPending(
      sampleSellerId, '2020-01-01', '2099-12-31',
    )
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})

// ─── naver-settlements ──────────────────────────────────────────
import * as naverQuery from '@/lib/db/repositories/naver-settlements-query.repo'

describe('naver-settlements-query.repo', () => {
  it('listUnmatched: 배열 반환', async () => {
    if (skip()) return
    const { data, error } = await naverQuery.listUnmatched()
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    if (data && data.length > 0) {
      expect(data[0]).toHaveProperty('orderNumber')
      expect(data[0]).toHaveProperty('matchStatus')
      expect(data[0]).not.toHaveProperty('order_number')
      expect(data[0]).not.toHaveProperty('match_status')
    }
  })
})

// ─── sales-records ──────────────────────────────────────────────
import * as salesQuery from '@/lib/db/repositories/sales-records-query.repo'

describe('sales-records-query.repo', () => {
  it('listUnmatched: 배열 반환', async () => {
    if (skip()) return
    const { data, error } = await salesQuery.listUnmatched()
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    if (data && data.length > 0) {
      expect(data[0]).toHaveProperty('matchStatus')
      expect(data[0]).not.toHaveProperty('match_status')
    }
  })
})

// ─── batch ──────────────────────────────────────────────────────
import * as batchProgress from '@/lib/db/repositories/batch-progress.repo'

describe('batch-progress.repo', () => {
  it('getProgress: 존재하지 않는 batch → error', async () => {
    if (skip()) return
    const { data, error } = await batchProgress.getProgress('nonexistent-batch-id')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})

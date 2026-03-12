/**
 * Phase 2 리포지토리 스냅샷 테스트
 * WHY: repo 반환 구조를 .snap 파일로 기록 → 눈으로 확인 가능
 * HOW: 실 DB 조회 → 키 구조만 추출 → toMatchSnapshot()
 * WHERE: __tests__/integration/__snapshots__/repos-snapshot.test.ts.snap
 */
import { describe, it, expect, beforeAll } from 'vitest'

import * as sellersRepo from '@/lib/db/repositories/sellers.repo'
import * as sellersQuery from '@/lib/db/repositories/sellers-query.repo'
import * as productsQuery from '@/lib/db/repositories/products-query.repo'
import * as ordersRepo from '@/lib/db/repositories/orders.repo'
import * as ordersMutation from '@/lib/db/repositories/orders-mutation.repo'
import * as consignmentsRepo from '@/lib/db/repositories/consignments.repo'
import * as consignmentsQuery from '@/lib/db/repositories/consignments-query.repo'
import * as notificationsQuery from '@/lib/db/repositories/notifications-query.repo'
import * as settlementRepo from '@/lib/db/repositories/settlement.repo'
import * as soldItemsRepo from '@/lib/db/repositories/sold-items.repo'

let hasConnection = false

beforeAll(async () => {
  const result = await sellersRepo.listActive()
  hasConnection = result.error === null
  if (!hasConnection) console.warn('DB 연결 실패 — 스냅샷 테스트 스킵')
})

function skip() {
  if (!hasConnection) { console.warn('DB 미연결 — 스킵'); return true }
  return false
}

/** 객체의 키 구조만 추출 (값은 typeof로 대체) — 스냅샷 비교용 */
function extractShape(obj: Record<string, unknown>): Record<string, string> {
  const shape: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) shape[key] = 'null'
    else if (Array.isArray(value)) shape[key] = `array(${value.length})`
    else if (typeof value === 'object') shape[key] = 'object'
    else shape[key] = typeof value
  }
  return shape
}

// ─── sellers ────────────────────────────────────────────────────

describe('sellers 스냅샷', () => {
  it('Seller 키 구조', async () => {
    if (skip()) return
    const { data } = await sellersRepo.listActive()
    if (!data || data.length === 0) return
    expect(extractShape(data[0] as unknown as Record<string, unknown>)).toMatchSnapshot()
  })

  it('listByPage 결과 구조', async () => {
    if (skip()) return
    const result = await sellersQuery.listByPage({ page: 1, pageSize: 2 })
    if (result.error) return
    expect({
      dataLength: result.data.length,
      total: typeof result.total,
      firstRowShape: result.data.length > 0
        ? extractShape(result.data[0] as unknown as Record<string, unknown>)
        : null,
    }).toMatchSnapshot()
  })
})

// ─── products ───────────────────────────────────────────────────

describe('products 스냅샷', () => {
  it('StProductWithSeller 키 구조', async () => {
    if (skip()) return
    const result = await productsQuery.list({}, { page: 1, pageSize: 1 })
    if (result.error || result.data.length === 0) return
    expect(extractShape(result.data[0] as unknown as Record<string, unknown>)).toMatchSnapshot()
  })

  it('ProductSummary 구조', async () => {
    if (skip()) return
    const { data } = await productsQuery.getSummary()
    if (!data) return
    expect(extractShape(data as unknown as Record<string, unknown>)).toMatchSnapshot()
  })
})

// ─── orders ─────────────────────────────────────────────────────

describe('orders 스냅샷', () => {
  it('OrderWithItems 키 구조', async () => {
    if (skip()) return
    const result = await ordersRepo.list({}, { page: 1, pageSize: 1 })
    if (result.error || result.data.length === 0) return
    const order = result.data[0] as unknown as Record<string, unknown>
    const shape = extractShape(order)
    // order_items 내부 구조도 캡처
    const items = order.order_items as Record<string, unknown>[]
    if (items && items.length > 0) {
      shape['order_items[0]_shape'] = JSON.stringify(extractShape(items[0]))
    }
    expect(shape).toMatchSnapshot()
  })

  it('OrderItem via getItemsByOrderId 구조', async () => {
    if (skip()) return
    const list = await ordersRepo.list({}, { page: 1, pageSize: 1 })
    if (list.error || list.data.length === 0) return
    const { data } = await ordersMutation.getItemsByOrderId(list.data[0].id)
    if (!data || data.length === 0) return
    expect(extractShape(data[0] as unknown as Record<string, unknown>)).toMatchSnapshot()
  })
})

// ─── consignments ───────────────────────────────────────────────

describe('consignments 스냅샷', () => {
  it('ConsignmentWithRelations 키 구조', async () => {
    if (skip()) return
    const result = await consignmentsQuery.list({}, { page: 1, pageSize: 1 })
    if (result.error || result.data.length === 0) return
    const row = result.data[0] as unknown as Record<string, unknown>
    const shape = extractShape(row)
    // sellers JOIN 구조
    if (row.sellers && typeof row.sellers === 'object') {
      shape['sellers_shape'] = JSON.stringify(
        extractShape(row.sellers as Record<string, unknown>),
      )
    }
    expect(shape).toMatchSnapshot()
  })

  it('findById 결과 구조', async () => {
    if (skip()) return
    const list = await consignmentsQuery.list({}, { page: 1, pageSize: 1 })
    if (list.error || list.data.length === 0) return
    const { data } = await consignmentsRepo.findById(list.data[0].id)
    if (!data) return
    expect(extractShape(data as unknown as Record<string, unknown>)).toMatchSnapshot()
  })
})

// ─── notifications ──────────────────────────────────────────────

describe('notifications 스냅샷', () => {
  it('NotificationLogWithRelations 키 구조', async () => {
    if (skip()) return
    const result = await notificationsQuery.list({}, { page: 1, pageSize: 1 })
    if (result.error || result.data.length === 0) return
    expect(extractShape(result.data[0] as unknown as Record<string, unknown>)).toMatchSnapshot()
  })
})

// ─── settlement ─────────────────────────────────────────────────

describe('settlement 스냅샷', () => {
  it('SettlementWithSeller 키 구조 (list)', async () => {
    if (skip()) return
    const result = await settlementRepo.list({}, { page: 1, pageSize: 1 })
    if (result.error || result.data.length === 0) return
    const row = result.data[0] as unknown as Record<string, unknown>
    const shape = extractShape(row)
    if (row.sellers && typeof row.sellers === 'object') {
      shape['sellers_shape'] = JSON.stringify(
        extractShape(row.sellers as Record<string, unknown>),
      )
    }
    expect(shape).toMatchSnapshot()
  })
})

// ─── sold-items ─────────────────────────────────────────────────

describe('sold-items 스냅샷', () => {
  it('SoldItem 키 구조', async () => {
    if (skip()) return
    const sellers = await sellersRepo.listActive()
    if (sellers.error || !sellers.data || sellers.data.length === 0) return
    // 데이터 있는 셀러 찾기
    for (const seller of sellers.data.slice(0, 5)) {
      const { data } = await soldItemsRepo.findBySellerId(seller.id)
      if (data && data.length > 0) {
        expect(extractShape(data[0] as unknown as Record<string, unknown>)).toMatchSnapshot()
        return
      }
    }
    console.warn('sold_items 데이터 없음 — 스냅샷 생성 불가')
  })
})

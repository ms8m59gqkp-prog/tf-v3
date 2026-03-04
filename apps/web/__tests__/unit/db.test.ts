/**
 * Phase 2 데이터 레이어 단위 테스트 — mapRow 순수 함수 + client re-export
 * WHY: DB 의존 없이 매핑 로직 검증
 * HOW: V2 snake_case mock 데이터 → V3 camelCase 변환 확인
 * WHERE: __tests__/unit/db.test.ts
 */

import { describe, it, expect } from 'vitest'

// mapRow imports
import { mapRow as mapSeller } from '@/lib/db/repositories/sellers.repo'
import { mapRow as mapOrder, mapItemRow as mapOrderItem } from '@/lib/db/repositories/orders.repo'
import { mapRow as mapProduct } from '@/lib/db/repositories/products.repo'
import { mapSettlementRow, mapSoldItemRow } from '@/lib/db/repositories/settlement.repo'
import { mapRow as mapSalesRecord } from '@/lib/db/repositories/sales-records.repo'
import { mapRow as mapNaverSettlement } from '@/lib/db/repositories/naver-settlements.repo'
import { mapRow as mapConsignment } from '@/lib/db/repositories/consignments.repo'
import { mapRow as mapNotification } from '@/lib/db/repositories/notifications.repo'
import { mapRow as mapBatch } from '@/lib/db/repositories/batch.repo'

// client re-export
import { createAdminClient } from '@/lib/db/client'

describe('client.ts re-export', () => {
  it('exports createAdminClient function', () => {
    expect(typeof createAdminClient).toBe('function')
  })
})

describe('sellers.repo mapRow', () => {
  const row = {
    id: 'uuid-1', name: '테스트셀러', phone: '010-1234-5678',
    seller_code: 'SC001', commission_rate: 0.25, seller_tier: 'general',
    bank_name: '국민은행', bank_account: '123-456', created_at: '2025-01-01T00:00:00Z',
  }

  it('maps V2 snake_case → V3 camelCase', () => {
    const result = mapSeller(row)
    expect(result.sellerName).toBe('테스트셀러')
    expect(result.sellerCode).toBe('SC001')
    expect(result.sellerType).toBe('general')
    expect(result.commissionRate).toBe(0.25)
    expect(result.bankName).toBe('국민은행')
  })

  it('falls back updatedAt to createdAt (V2 has no updated_at)', () => {
    const result = mapSeller(row)
    expect(result.updatedAt).toBe(result.createdAt)
  })

  it('handles null bank fields as undefined', () => {
    const result = mapSeller({ ...row, bank_name: null, bank_account: null })
    expect(result.bankName).toBeUndefined()
    expect(result.bankAccount).toBeUndefined()
  })
})

describe('orders.repo mapRow', () => {
  const row = {
    id: 'uuid-2', order_number: 'ORD-001', customer_name: '김고객',
    phone: '010-9999-8888', address: '서울시', postal_code: '12345',
    status: 'APPLIED', hold_token: null, box_qty: 3,
    total_estimated: 150000, commission: 37500, final_payout: 112500,
    seller_type: 'general', purchase_source: 'naver',
    created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-02T00:00:00Z',
  }

  it('maps order fields correctly', () => {
    const result = mapOrder(row)
    expect(result.orderNumber).toBe('ORD-001')
    expect(result.customerName).toBe('김고객')
    expect(result.status).toBe('APPLIED')
    expect(result.boxQty).toBe(3)
    expect(result.totalEstimated).toBe(150000)
    expect(result.commission).toBe(37500)
    expect(result.finalPayout).toBe(112500)
  })

  it('handles null optional fields', () => {
    const result = mapOrder({ ...row, hold_token: null, address: null })
    expect(result.holdToken).toBeUndefined()
    expect(result.address).toBeUndefined()
  })
})

describe('orders.repo mapItemRow', () => {
  it('maps order item with defaults', () => {
    const row = {
      id: 'uuid-3', order_id: 'uuid-2', product_number: 'P001',
      brand: 'Brand', model: 'Model', category: null, condition: 'A',
      size: 'M', measurements: { shoulder: 44 },
      inspection_status: 'pending', customer_agreed: true,
    }
    const result = mapOrderItem(row)
    expect(result.productNumber).toBe('P001')
    expect(result.customerAgreed).toBe(true)
    expect(result.category).toBeUndefined()
  })

  it('defaults customerAgreed to false when not true', () => {
    const row = {
      id: 'x', order_id: 'x', product_number: 'P', brand: '', model: '',
      inspection_status: null, customer_agreed: null,
    }
    const result = mapOrderItem(row)
    expect(result.customerAgreed).toBe(false)
    expect(result.inspectionStatus).toBe('pending')
  })
})

describe('products.repo mapRow', () => {
  it('maps numeric fields correctly', () => {
    const row = {
      id: 'uuid-4', product_number: 'P001', brand: 'Brand', model: 'Model',
      category: null, sub_category: null, condition: 'A', size: 'M',
      color: 'Black', description: null, original_price: 100000,
      estimated_price: 80000, sold_price: null, measurements: null,
      image_urls: ['url1'], seller_id: 's1', order_id: null,
      status: 'active', created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    }
    const result = mapProduct(row)
    expect(result.originalPrice).toBe(100000)
    expect(result.estimatedPrice).toBe(80000)
    expect(result.soldPrice).toBeUndefined()
    expect(result.imageUrls).toEqual(['url1'])
  })
})

describe('settlement.repo mapSettlementRow', () => {
  const row = {
    id: 'uuid-5', seller_id: 's1', period_start: '2025-01-01',
    period_end: '2025-01-31', total_sales: 500000, commission_rate: 0.25,
    commission_amount: 125000, settlement_amount: 375000,
    status: 'pending', created_at: '2025-02-01T00:00:00Z',
  }

  it('maps DB column names to V3 fields', () => {
    const result = mapSettlementRow(row)
    expect(result.totalCommission).toBe(125000)  // commission_amount → totalCommission
    expect(result.totalPayout).toBe(375000)       // settlement_amount → totalPayout
    expect(result.sellerName).toBe('')            // 없음 → 빈 문자열
    expect(result.sellerType).toBe('')
  })
})

describe('settlement.repo mapSoldItemRow', () => {
  it('maps V2 naver-based fields to V3', () => {
    const row = {
      id: 'uuid-6', naver_order_id: 'NAV-001', sale_price: 50000,
      seller_product_code: 'SPC-001', settlement_status: 'pending',
      sold_at: '2025-01-15T00:00:00Z', seller_id: 's1',
    }
    const result = mapSoldItemRow(row)
    expect(result.orderId).toBe('NAV-001')           // naver_order_id → orderId
    expect(result.productNumber).toBe('SPC-001')     // seller_product_code → productNumber
    expect(result.soldPrice).toBe(50000)             // sale_price → soldPrice
    expect(result.commission).toBe(0)                // 서비스에서 계산
    expect(result.payout).toBe(0)
  })
})

describe('sales-records.repo mapRow', () => {
  it('maps V2 field names to V3', () => {
    const row = {
      id: 'uuid-7', sale_date: '2025-01-10', buyer_name: '구매자',
      naver_order_no: 'N001', brand: 'Brand', product_name: '상품명',
      product_code: 'PC001', product_number: 'PN001',
      original_price: 100000, sale_amount: 80000, quantity: 1,
      final_amount: 80000, is_consignment: true,
      consignment_seller: '위탁셀러', match_status: 'matched',
      upload_session_id: 'sess-1', created_at: '2025-01-10T00:00:00Z',
    }
    const result = mapSalesRecord(row)
    expect(result.model).toBe('상품명')        // product_name → model
    expect(result.soldPrice).toBe(80000)       // sale_amount → soldPrice
    expect(result.sellerName).toBe('위탁셀러')  // consignment_seller → sellerName
    expect(result.soldAt).toBe('2025-01-10')   // sale_date → soldAt
    expect(result.sellerId).toBe('')           // DB에 없음
  })
})

describe('naver-settlements.repo mapRow', () => {
  it('maps all fields', () => {
    const row = {
      id: 'uuid-8', order_no: 'NO001', product_order_no: 'PO001',
      product_name: '상품', buyer_name: '구매자',
      settle_base_date: '2025-01-15', settle_amount: 50000,
      settle_status: 'settled', match_status: 'matched',
      upload_batch: 'batch-1', created_at: '2025-01-15T00:00:00Z',
    }
    const result = mapNaverSettlement(row)
    expect(result.orderNo).toBe('NO001')
    expect(result.settleAmount).toBe(50000)
    expect(result.matchStatus).toBe('matched')
  })
})

describe('consignments.repo mapRow', () => {
  it('maps with empty sellerName fallback', () => {
    const row = {
      id: 'uuid-9', seller_id: 's1', product_name: '위탁상품',
      brand: 'Brand', category: 'Jacket', status: 'pending',
      created_at: '2025-01-01T00:00:00Z',
    }
    const result = mapConsignment(row)
    expect(result.sellerName).toBe('')
    expect(result.productName).toBe('위탁상품')
    expect(result.updatedAt).toBe(result.createdAt)
  })
})

describe('notifications.repo mapRow', () => {
  it('maps phone → recipientPhone', () => {
    const row = {
      id: 'uuid-10', seller_id: 's1', phone: '010-1111-2222',
      message: '테스트 메시지', status: 'sent',
      created_at: '2025-01-01T00:00:00Z',
    }
    const result = mapNotification(row)
    expect(result.recipientPhone).toBe('010-1111-2222')
    expect(result.status).toBe('sent')
  })
})

describe('batch.repo mapRow', () => {
  it('maps DB columns to V3 BatchProgress fields', () => {
    const row = {
      id: 'uuid-11', batch_id: 'BATCH-001', total: 100,
      completed: 95, failed: 5, failed_ids: ['f1', 'f2'],
      status: 'completed', created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T01:00:00Z',
    }
    const result = mapBatch(row)
    expect(result.totalFiles).toBe(100)       // total → totalFiles
    expect(result.processedFiles).toBe(95)    // completed → processedFiles
    expect(result.successCount).toBe(90)      // completed - failed
    expect(result.failCount).toBe(5)
    expect(result.completedAt).toBe('2025-01-01T01:00:00Z')
  })

  it('sets completedAt undefined when status is not completed', () => {
    const row = {
      id: 'uuid-12', batch_id: 'BATCH-002', total: 50,
      completed: 30, failed: 2, failed_ids: [],
      status: 'running', created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:30:00Z',
    }
    const result = mapBatch(row)
    expect(result.completedAt).toBeUndefined()
    expect(result.status).toBe('running')
  })
})

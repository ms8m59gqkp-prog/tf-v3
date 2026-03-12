/**
 * 셀러 활동 이력 집계 리포지토리
 * WHY: seller.service.getHistory()의 DB 직접 호출을 repo로 분리 (arch-spec 4.1)
 * HOW: 각 도메인 테이블별 seller_id 기준 count 쿼리
 * WHERE: seller.service.ts getHistory()에서 호출
 */
import { createAdminClient } from '../../supabase/admin'

export interface SellerHistoryCounts {
  consignmentCount: number
  orderCount: number
  settlementCount: number
}

export async function countBySellerId(
  sellerId: string,
): Promise<{ data: SellerHistoryCounts; error: string | null }> {
  const client = createAdminClient()

  const [consignments, orders, settlements] = await Promise.all([
    client.from('consignment_requests').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId),
    client.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId),
    client.from('settlements').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId),
  ])

  const errors = [consignments, orders, settlements].filter(r => r.error)
  if (errors.length > 0) {
    const msg = errors.map(r => r.error?.message).join(', ')
    return { data: { consignmentCount: 0, orderCount: 0, settlementCount: 0 }, error: msg }
  }

  return {
    data: {
      consignmentCount: consignments.count ?? 0,
      orderCount: orders.count ?? 0,
      settlementCount: settlements.count ?? 0,
    },
    error: null,
  }
}

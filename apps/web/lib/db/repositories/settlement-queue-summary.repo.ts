/**
 * 정산 큐 셀러별 집계
 * WHY: 셀러 단위 정산 요약 — CRUD와 분리
 * HOW: settlement_queue에서 pending 건 집계
 * WHERE: matching.service.ts에서 import
 */
import { createAdminClient } from '../../supabase/admin'
import type { SellerSettlementSummary } from '../../types/domain/settlement'
import type { DbResult } from '../types'

export async function getSellerSummary(): Promise<DbResult<SellerSettlementSummary[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlement_queue')
    .select('seller_id, seller_name, sale_amount, commission_amount, payout_amount')
    .eq('queue_status', 'pending')
  if (error) return { data: null, error: error.message }

  const map = new Map<string, SellerSettlementSummary>()
  for (const row of data as Record<string, unknown>[]) {
    const sid = row.seller_id as string
    const existing = map.get(sid)
    if (existing) {
      existing.totalItems += 1
      existing.totalSaleAmount += Number(row.sale_amount ?? 0)
      existing.totalCommission += Number(row.commission_amount ?? 0)
      existing.totalPayout += Number(row.payout_amount ?? 0)
    } else {
      map.set(sid, {
        sellerId: sid,
        sellerName: row.seller_name as string,
        totalItems: 1,
        totalSaleAmount: Number(row.sale_amount ?? 0),
        totalCommission: Number(row.commission_amount ?? 0),
        totalPayout: Number(row.payout_amount ?? 0),
      })
    }
  }
  return { data: [...map.values()], error: null }
}

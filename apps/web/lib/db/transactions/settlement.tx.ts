/**
 * 정산 생성 트랜잭션 래퍼
 * WHY: create_settlement_with_items RPC 1회 호출로 정산+항목+상태갱신 원자 처리
 * HOW: sold_items FOR UPDATE 잠금 → count 검증 → INSERT settlements/items → UPDATE settled
 * WHERE: 정산 생성 시 호출 (sold_items pending → settled, settlement status='draft')
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbResult } from '../types'

interface CreateSettlementParams {
  sellerId: string
  periodStart: string
  periodEnd: string
  totalSales: number
  commissionRate: number
  commissionAmount: number
  settlementAmount: number
  soldItemIds: string[]
}

export async function createSettlement(
  params: CreateSettlementParams
): Promise<DbResult<{ settlementId: string }>> {
  const client = createAdminClient()

  const { data, error } = await client.rpc(
    'create_settlement_with_items' as never,
    {
      p_seller_id: params.sellerId,
      p_period_start: params.periodStart,
      p_period_end: params.periodEnd,
      p_total_sales: params.totalSales,
      p_commission_rate: params.commissionRate,
      p_commission_amount: params.commissionAmount,
      p_settlement_amount: params.settlementAmount,
      p_sold_item_ids: params.soldItemIds,
    } as never,
  )

  if (error) {
    if (error.code === 'P0001') return { data: null, error: error.message }
    return { data: null, error: error.message }
  }

  const settlementId = data as string
  return { data: { settlementId }, error: null }
}

/**
 * 정산 생성 트랜잭션 — RPC 래퍼
 * WHY: sold_items 잠금 + settlement 원자적 생성
 * HOW: create_settlement_with_items RPC 호출
 * WHERE: settlement 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'

interface CreateSettlementInput {
  sellerId: string
  periodStart: string
  periodEnd: string
  totalSales: number
  commissionRate: number
  commissionAmount: number
  settlementAmount: number
  soldItemIds: string[]
}

export async function createSettlementWithItems(input: CreateSettlementInput): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('create_settlement_with_items', {
    p_seller_id: input.sellerId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_total_sales: input.totalSales,
    p_commission_rate: input.commissionRate,
    p_commission_amount: input.commissionAmount,
    p_settlement_amount: input.settlementAmount,
    p_sold_item_ids: input.soldItemIds,
  })
  if (error) throw new Error(`[settlement.tx] 정산 생성 실패: ${error.message}`)
  return data as string
}

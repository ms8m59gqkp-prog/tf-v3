/**
 * 정산 큐 CRUD + 셀러별 집계
 * WHY: 매칭 -> 정산 생성 전 대기열 관리
 * HOW: settlement_queue 테이블 직접 쿼리
 * WHERE: matching.service.ts, settlement.service.ts에서 import
 */
import { createAdminClient } from '../../supabase/admin'
import type { SettlementQueueItem } from '../../types/domain/settlement'
import type { DbResult } from '../types'

const COLUMNS = `id, match_id, seller_id, seller_name,
  product_name, product_number, sale_amount, commission_rate,
  commission_amount, payout_amount, settle_base_date,
  queue_status, settlement_id, created_at` as const

function mapRow(row: Record<string, unknown>): SettlementQueueItem {
  return {
    id: row.id as string,
    matchId: (row.match_id as string) ?? null,
    sellerId: (row.seller_id as string) ?? null,
    sellerName: row.seller_name as string,
    productName: (row.product_name as string) ?? null,
    productNumber: (row.product_number as string) ?? null,
    saleAmount: row.sale_amount != null ? Number(row.sale_amount) : null,
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : null,
    commissionAmount: row.commission_amount != null ? Number(row.commission_amount) : null,
    payoutAmount: row.payout_amount != null ? Number(row.payout_amount) : null,
    settleBaseDate: (row.settle_base_date as string) ?? null,
    queueStatus: (row.queue_status as string) ?? null,
    settlementId: (row.settlement_id as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
  }
}

export { COLUMNS as QUEUE_COLUMNS, mapRow as mapQueueRow }

export async function bulkCreate(items: Array<{
  matchId: string
  sellerId: string
  sellerName: string
  productName?: string
  productNumber?: string
  saleAmount: number
  commissionRate: number
  commissionAmount: number
  payoutAmount: number
  settleBaseDate?: string
}>): Promise<DbResult<SettlementQueueItem[]>> {
  const client = createAdminClient()
  const rows = items.map(item => ({
    match_id: item.matchId,
    seller_id: item.sellerId,
    seller_name: item.sellerName,
    product_name: item.productName ?? null,
    product_number: item.productNumber ?? null,
    sale_amount: item.saleAmount,
    commission_rate: item.commissionRate,
    commission_amount: item.commissionAmount,
    payout_amount: item.payoutAmount,
    settle_base_date: item.settleBaseDate ?? null,
  }))
  const { data, error } = await client
    .from('settlement_queue')
    .insert(rows)
    .select(COLUMNS)
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function listByStatus(
  status: string,
): Promise<DbResult<SettlementQueueItem[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlement_queue')
    .select(COLUMNS)
    .eq('queue_status', status)
    .order('created_at', { ascending: true })
    .range(0, 4999)
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function listBySeller(
  sellerId: string,
): Promise<DbResult<SettlementQueueItem[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlement_queue')
    .select(COLUMNS)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: true })
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function deleteByStatus(
  status: string,
): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { error, count } = await client
    .from('settlement_queue')
    .delete({ count: 'exact' })
    .eq('queue_status', status)
  if (error) return { data: null, error: error.message }
  return { data: count ?? 0, error: null }
}


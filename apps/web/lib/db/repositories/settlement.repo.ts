/**
 * 정산 리포지토리 — settlements + sold_items 테이블 CRUD
 * WHY: 정산 생성/확인/지급 데이터 접근 + 판매 항목 조회
 * HOW: createAdminClient + mapSettlementRow/mapSoldItemRow
 * WHERE: settlement 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import { chunkArray } from '@/lib/utils/chunk'
import type { Settlement, SettlementStatus, SoldItem, SoldItemSettlementStatus } from '@/lib/types/domain/settlement'

const SETTLEMENT_COLUMNS = 'id, seller_id, period_start, period_end, total_sales, commission_rate, commission_amount, settlement_amount, status, created_at'

const SOLD_ITEM_COLUMNS = 'id, naver_order_id, sale_price, seller_product_code, settlement_status, sold_at, seller_id'

export function mapSettlementRow(row: Record<string, unknown>): Settlement {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    sellerName: '',
    sellerType: '',
    commissionRate: Number(row.commission_rate),
    totalSales: Number(row.total_sales),
    totalCommission: Number(row.commission_amount),
    totalPayout: Number(row.settlement_amount),
    status: row.status as SettlementStatus,
    createdAt: row.created_at as string,
    updatedAt: row.created_at as string,
  }
}

export function mapSoldItemRow(row: Record<string, unknown>): SoldItem {
  return {
    id: row.id as string,
    orderId: (row.naver_order_id as string) || '',
    productNumber: (row.seller_product_code as string) || '',
    brand: '',
    model: '',
    soldPrice: Number(row.sale_price),
    commission: 0,
    payout: 0,
    settlementStatus: row.settlement_status as SoldItemSettlementStatus,
    soldAt: row.sold_at as string,
    createdAt: row.sold_at as string,
    updatedAt: row.sold_at as string,
  }
}

export async function getSettlementById(id: string): Promise<Settlement> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('settlements').select(SETTLEMENT_COLUMNS).eq('id', id).single()
  if (error) throw new Error(`[settlement.getSettlementById] ${error.message}`)
  return mapSettlementRow(data)
}

export async function listSettlementsBySeller(
  sellerId: string,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<Settlement[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('settlements')
    .select(SETTLEMENT_COLUMNS)
    .eq('seller_id', sellerId)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[settlement.listSettlementsBySeller] ${error.message}`)
  return data.map(mapSettlementRow)
}

export async function updateSettlementStatus(
  id: string,
  expectedStatus: SettlementStatus,
  newStatus: SettlementStatus,
): Promise<Settlement> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('settlements')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('status', expectedStatus)
    .select(SETTLEMENT_COLUMNS)
    .single()
  if (error) throw new Error(`[settlement.updateSettlementStatus] ${error.message}`)
  return mapSettlementRow(data)
}

export async function listPendingSoldItems(sellerId: string): Promise<SoldItem[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('sold_items')
    .select(SOLD_ITEM_COLUMNS)
    .eq('seller_id', sellerId)
    .eq('settlement_status', 'pending')
  if (error) throw new Error(`[settlement.listPendingSoldItems] ${error.message}`)
  return data.map(mapSoldItemRow)
}

export async function listSoldItemsByIds(ids: string[]): Promise<SoldItem[]> {
  if (ids.length === 0) return []
  const chunks = chunkArray(ids, 100)
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const sb = createAdminClient()
      const { data, error } = await sb
        .from('sold_items')
        .select(SOLD_ITEM_COLUMNS)
        .in('id', chunk)
      if (error) throw new Error(`[settlement.listSoldItemsByIds] ${error.message}`)
      return data.map(mapSoldItemRow)
    }),
  )
  return results.flatMap((r) => r)
}

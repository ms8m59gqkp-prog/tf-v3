/**
 * 판매기록 리포지토리 — sold_items CRUD + upsert + 상태 갱신
 * WHY: sold_items 테이블 쿼리 일원화 (SELECT * 금지, AV1)
 * HOW: COLUMNS 명시 + mapRow snake→camelCase + onConflict product_order_id
 * WHERE: 정산 처리, 엑셀 업로드, 판매기록 조회
 */
import { createAdminClient } from '../../supabase/admin'
import type { SoldItem, SoldItemStatus } from '../../types/domain/settlement'
import type { DbResult, BulkResult, FailedRow } from '../types'

// DDL 20컬럼 전체 — SELECT * 금지 (AV1)
const COLUMNS = `id, seller_id, channel, order_id, product_name, product_number,
  quantity, sale_price, shipping_fee, sold_at, purchase_confirmed,
  purchase_confirmed_at, settlement_status, settlement_id, return_processed,
  source_file, created_at, product_order_id, naver_product_id, product_code` as const

function mapRow(row: Record<string, unknown>): SoldItem {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    channel: (row.channel as SoldItem['channel']) ?? null,
    orderId: row.order_id as string,
    productName: row.product_name as string,
    productNumber: (row.product_number as string) ?? null,
    quantity: row.quantity as number,
    salePrice: row.sale_price as number,
    shippingFee: (row.shipping_fee as number) ?? null,
    soldAt: row.sold_at as string,
    purchaseConfirmed: (row.purchase_confirmed as boolean) ?? null,
    purchaseConfirmedAt: (row.purchase_confirmed_at as string) ?? null,
    settlementStatus: (row.settlement_status as SoldItem['settlementStatus']) ?? null,
    settlementId: (row.settlement_id as string) ?? null,
    returnProcessed: (row.return_processed as boolean) ?? null,
    sourceFile: (row.source_file as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    productOrderId: (row.product_order_id as string) ?? null,
    naverProductId: (row.naver_product_id as string) ?? null,
    productCode: (row.product_code as string) ?? null,
  }
}

export { COLUMNS, mapRow }
export async function listPending(
  sellerId: string, periodStart: string, periodEnd: string,
): Promise<DbResult<SoldItem[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('sold_items')
    .select(COLUMNS)
    .eq('seller_id', sellerId)
    .eq('settlement_status', 'pending')
    .eq('purchase_confirmed', true)
    .gte('sold_at', periodStart)
    .lte('sold_at', periodEnd)
    .range(0, 4999)
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}
export async function upsertFromExcel(rows: Record<string, unknown>[]): Promise<BulkResult<SoldItem>> {
  const client = createAdminClient()
  const succeeded: SoldItem[] = []
  const failed: FailedRow[] = []

  const { data, error } = await client
    .from('sold_items')
    .upsert(rows, { onConflict: 'product_order_id', ignoreDuplicates: true })
    .select(COLUMNS)

  if (error) {
    // 배치 실패 → 개별 INSERT fallback
    for (let i = 0; i < rows.length; i++) {
      const { data: single, error: singleErr } = await client
        .from('sold_items')
        .upsert([rows[i]], { onConflict: 'product_order_id', ignoreDuplicates: true })
        .select(COLUMNS)
        .single()
      if (singleErr) {
        failed.push({
          rowIndex: i,
          data: rows[i],
          errors: [{ field: 'product_order_id', type: 'duplicate', message: singleErr.message }],
        })
      } else {
        succeeded.push(mapRow(single as Record<string, unknown>))
      }
    }
  } else {
    succeeded.push(...(data as Record<string, unknown>[]).map(mapRow))
  }

  return { succeeded, failed, total: rows.length }
}
export async function updateStatus(ids: string[], status: SoldItemStatus, expectedCurrent: SoldItemStatus): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { error, count } = await client
    .from('sold_items')
    .update({ settlement_status: status })
    .in('id', ids)
    .eq('settlement_status', expectedCurrent)
  if (error) return { data: null, error: error.message }
  return { data: count ?? ids.length, error: null }
}
export async function findBySellerId(sellerId: string): Promise<DbResult<SoldItem[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('sold_items')
    .select(COLUMNS)
    .eq('seller_id', sellerId)
    .order('sold_at', { ascending: false })
    .range(0, 4999)
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}

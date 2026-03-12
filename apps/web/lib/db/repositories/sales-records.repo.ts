/**
 * 매출장 공유 인프라 + 벌크 INSERT
 * WHY: 스마트스토어 매출 엑셀 업로드 → 네이버 정산 매칭용 매출 기록
 * HOW: session 기반 delete+INSERT (Partial Unique Index로 .upsert() 미사용)
 * WHERE: 정산 매칭 워크플로우 (매출 업로드 → 자동매칭 → 수동매칭 → 정산)
 */
import { createAdminClient } from '../../supabase/admin'
import type { SalesRecord, MatchStatus } from '../../types/domain/settlement'
import type { BulkResult, FailedRow } from '../types'

const COLUMNS = [
  'id', 'sale_date', 'buyer_name', 'naver_order_no', 'brand', 'product_name',
  'product_code', 'product_number', 'original_price', 'discount_rate', 'sale_amount',
  'quantity', 'final_amount', 'is_consignment', 'consignment_seller', 'match_status',
  'upload_batch', 'created_at', 'upload_session_id',
].join(', ')

function mapRow(row: Record<string, unknown>): SalesRecord {
  return {
    id: row.id as string,
    saleDate: row.sale_date as string,
    buyerName: (row.buyer_name as string) ?? null,
    naverOrderNo: (row.naver_order_no as string) ?? null,
    brand: (row.brand as string) ?? null,
    productName: (row.product_name as string) ?? null,
    productCode: (row.product_code as string) ?? null,
    productNumber: (row.product_number as string) ?? null,
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    discountRate: row.discount_rate != null ? Number(row.discount_rate) : null,
    saleAmount: row.sale_amount != null ? Number(row.sale_amount) : null,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    finalAmount: row.final_amount != null ? Number(row.final_amount) : null,
    isConsignment: (row.is_consignment as boolean) ?? null,
    consignmentSeller: (row.consignment_seller as string) ?? null,
    matchStatus: (row.match_status as MatchStatus) ?? null,
    uploadBatch: (row.upload_batch as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    uploadSessionId: (row.upload_session_id as string) ?? null,
  }
}

function dupKey(r: Record<string, unknown>): string {
  return `${r.sale_date}|${r.naver_order_no}|${r.buyer_name}|${r.product_name}`
}

export { COLUMNS, mapRow }

/**
 * 벌크 INSERT — session 기반 delete+INSERT
 * 1. 동일 sessionId 기존 건 삭제 (재업로드 시 교체)
 * 2. DB 기존 건과 중복 체크
 * 3. 배치 INSERT 시도 → 23505 시 개별 INSERT fallback
 */
export async function bulkInsert(
  rows: Record<string, unknown>[], batchId: string, sessionId: string,
): Promise<BulkResult<SalesRecord>> {
  const client = createAdminClient()
  const succeeded: SalesRecord[] = []
  const failed: FailedRow[] = []
  await client.from('sales_records').delete().eq('upload_session_id', sessionId)
  const { data: existing } = await client
    .from('sales_records')
    .select('sale_date, naver_order_no, buyer_name, product_name')
    .eq('upload_batch', batchId)
    .range(0, 49999)
  const existingKeys = new Set(
    (existing ?? []).map((r: Record<string, unknown>) => dupKey(r)),
  )
  const toInsert: Record<string, unknown>[] = []
  const originalIndices: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const key = dupKey(rows[i])
    if (existingKeys.has(key)) {
      failed.push({
        rowIndex: i, data: rows[i],
        errors: [{ field: 'naver_order_no', type: 'duplicate', message: '동일 매출 기록 존재' }],
      })
    } else {
      toInsert.push({ ...rows[i], upload_batch: batchId, upload_session_id: sessionId })
      originalIndices.push(i)
      existingKeys.add(key)
    }
  }
  if (toInsert.length === 0) return { succeeded, failed, total: rows.length }
  const { data, error } = await client
    .from('sales_records').insert(toInsert).select(COLUMNS)
  if (!error && data) {
    succeeded.push(...(data as unknown as Record<string, unknown>[]).map(mapRow))
  } else if (error?.code === '23505') {
    for (let i = 0; i < toInsert.length; i++) {
      const { data: single, error: singleErr } = await client
        .from('sales_records').insert(toInsert[i]).select(COLUMNS).single()
      if (singleErr) {
        failed.push({
          rowIndex: originalIndices[i], data: toInsert[i],
          errors: [{ field: 'id', type: 'constraint', message: singleErr.message }],
        })
      } else if (single) {
        succeeded.push(mapRow(single as unknown as Record<string, unknown>))
      }
    }
  } else if (error) {
    for (let i = 0; i < toInsert.length; i++) {
      failed.push({
        rowIndex: originalIndices[i], data: toInsert[i],
        errors: [{ field: 'id', type: 'constraint', message: error.message }],
      })
    }
  }
  return { succeeded, failed, total: rows.length }
}

/**
 * 네이버 정산 공유 인프라 + 벌크 INSERT
 * WHY: 네이버 구매확정 엑셀 업로드 → 매출 매칭용 정산 기록
 * HOW: product_order_no 기존 건 체크 → 신규만 INSERT, 중복은 FailedRow
 * WHERE: 정산 매칭 워크플로우 (구매확정 업로드 → 자동매칭)
 */
import { createAdminClient } from '../../supabase/admin'
import type { NaverSettlement, MatchStatus } from '../../types/domain/settlement'
import type { BulkResult, FailedRow } from '../types'

const COLUMNS = [
  'id', 'order_no', 'product_order_no', 'category', 'product_name',
  'buyer_name', 'settle_base_date', 'settle_scheduled_date', 'settle_amount',
  'settle_status', 'match_status', 'upload_batch', 'created_at',
].join(', ')

function mapRow(row: Record<string, unknown>): NaverSettlement {
  return {
    id: row.id as string,
    orderNo: (row.order_no as string) ?? null,
    productOrderNo: (row.product_order_no as string) ?? null,
    category: (row.category as string) ?? null,
    productName: (row.product_name as string) ?? null,
    buyerName: (row.buyer_name as string) ?? null,
    settleBaseDate: (row.settle_base_date as string) ?? null,
    settleScheduledDate: (row.settle_scheduled_date as string) ?? null,
    settleAmount: row.settle_amount != null ? Number(row.settle_amount) : null,
    settleStatus: (row.settle_status as string) ?? null,
    matchStatus: (row.match_status as MatchStatus) ?? null,
    uploadBatch: (row.upload_batch as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
  }
}

export { COLUMNS, mapRow }

export async function bulkInsert(
  rows: Record<string, unknown>[], batchId: string,
): Promise<BulkResult<NaverSettlement>> {
  const client = createAdminClient()
  const succeeded: NaverSettlement[] = []
  const failed: FailedRow[] = []
  const orderNos = rows.map((r) => r.product_order_no as string).filter(Boolean)
  const existingNos = new Set<string>()
  if (orderNos.length > 0) {
    const { data: existing } = await client
      .from('naver_settlements').select('product_order_no').in('product_order_no', orderNos)
    for (const r of existing ?? []) {
      existingNos.add((r as unknown as Record<string, unknown>).product_order_no as string)
    }
  }
  const toInsert: Record<string, unknown>[] = []
  const originalIndices: number[] = []
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const pon = rows[i].product_order_no as string
    if (pon && (existingNos.has(pon) || seen.has(pon))) {
      failed.push({
        rowIndex: i, data: rows[i],
        errors: [{ field: 'product_order_no', type: 'duplicate', message: '동일 상품주문번호 존재' }],
      })
    } else {
      toInsert.push({ ...rows[i], upload_batch: batchId })
      originalIndices.push(i)
      if (pon) seen.add(pon)
    }
  }
  if (toInsert.length === 0) return { succeeded, failed, total: rows.length }
  const { data, error } = await client
    .from('naver_settlements').insert(toInsert).select(COLUMNS)
  if (!error && data) {
    succeeded.push(...(data as unknown as Record<string, unknown>[]).map(mapRow))
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

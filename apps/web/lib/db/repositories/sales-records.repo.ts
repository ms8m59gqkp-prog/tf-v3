/**
 * 매출기록 리포지토리 — sales_records 테이블 CRUD
 * WHY: 매출 데이터 업로드/조회/삭제 데이터 접근
 * HOW: createAdminClient + mapRow
 * WHERE: sales 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import type { SalesRecord } from '@/lib/types/domain/settlement'

const COLUMNS = 'id, sale_date, buyer_name, naver_order_no, brand, product_name, product_code, product_number, original_price, sale_amount, quantity, final_amount, is_consignment, consignment_seller, match_status, upload_session_id, created_at'

export function mapRow(row: Record<string, unknown>): SalesRecord {
  return {
    id: row.id as string,
    productNumber: (row.product_number as string) || '',
    brand: (row.brand as string) || '',
    model: (row.product_name as string) || '',
    soldPrice: Number(row.sale_amount),
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    sellerId: '',
    sellerName: (row.consignment_seller as string) || '',
    buyerName: (row.buyer_name as string) || undefined,
    soldAt: row.sale_date as string,
    createdAt: row.created_at as string,
  }
}

export async function listByPage({ page, pageSize }: { page: number; pageSize: number }): Promise<SalesRecord[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('sales_records')
    .select(COLUMNS)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[sales-records.listByPage] ${error.message}`)
  return data.map(mapRow)
}

export async function listByMatchStatus(
  matchStatus: string,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<SalesRecord[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('sales_records')
    .select(COLUMNS)
    .eq('match_status', matchStatus)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[sales-records.listByMatchStatus] ${error.message}`)
  return data.map(mapRow)
}

export async function deleteBySession(sessionId: string): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('sales_records')
    .delete()
    .eq('upload_session_id', sessionId)
    .eq('match_status', 'unmatched')
  if (error) throw new Error(`[sales-records.deleteBySession] ${error.message}`)
}

export async function insertWithSession(
  records: Array<Record<string, unknown>>,
  sessionId: string,
): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('sales_records')
    .insert(records.map((r) => ({ ...r, upload_session_id: sessionId })))
  if (error) throw new Error(`[sales-records.insertWithSession] ${error.message}`)
}

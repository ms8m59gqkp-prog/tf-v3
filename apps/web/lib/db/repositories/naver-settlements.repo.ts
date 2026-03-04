/**
 * 네이버 정산 리포지토리 — naver_settlements 테이블 CRUD
 * WHY: 네이버 정산 데이터 업로드/조회 데이터 접근
 * HOW: createAdminClient + mapRow
 * WHERE: naver settlement 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import type { NaverSettlement } from '@/lib/types/domain/settlement'

const COLUMNS = 'id, order_no, product_order_no, product_name, buyer_name, settle_base_date, settle_amount, settle_status, match_status, upload_batch, created_at'

export function mapRow(row: Record<string, unknown>): NaverSettlement {
  return {
    id: row.id as string,
    orderNo: row.order_no as string,
    productOrderNo: (row.product_order_no as string) || undefined,
    productName: (row.product_name as string) || undefined,
    buyerName: (row.buyer_name as string) || undefined,
    settleBaseDate: (row.settle_base_date as string) || undefined,
    settleAmount: Number(row.settle_amount),
    settleStatus: (row.settle_status as string) || undefined,
    matchStatus: (row.match_status as string) || '',
    uploadBatch: (row.upload_batch as string) || undefined,
    createdAt: row.created_at as string,
  }
}

export async function listByPage({ page, pageSize }: { page: number; pageSize: number }): Promise<NaverSettlement[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('naver_settlements')
    .select(COLUMNS)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[naver-settlements.listByPage] ${error.message}`)
  return data.map(mapRow)
}

export async function listByMatchStatus(
  matchStatus: string,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<NaverSettlement[]> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('naver_settlements')
    .select(COLUMNS)
    .eq('match_status', matchStatus)
    .range(from, to)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[naver-settlements.listByMatchStatus] ${error.message}`)
  return data.map(mapRow)
}

export async function getByOrderNo(orderNo: string): Promise<NaverSettlement> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('naver_settlements')
    .select(COLUMNS)
    .eq('order_no', orderNo)
    .single()
  if (error) throw new Error(`[naver-settlements.getByOrderNo] ${error.message}`)
  return mapRow(data)
}

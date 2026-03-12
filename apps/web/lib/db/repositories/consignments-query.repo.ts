/**
 * 위탁 조회 + 상태 전이 + 삭제
 * WHY: consignments.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: 공유 COLUMNS/mapRow/mapJoinRow import + 필터/상태/삭제 일원화
 * WHERE: 위탁 목록 화면, 상태 변경, 일괄 삭제
 */
import { createAdminClient } from '../../supabase/admin'
import type { ConsignmentRequest } from '../../types/domain/consignment'
import { ALLOWED_TRANSITIONS } from '../../types/domain/consignment'
import type { DbResult, DbListResult, PageOptions } from '../types'
import { COLUMNS, JOIN_COLUMNS, mapRow, mapJoinRow, type ConsignmentWithRelations } from './consignments.repo'

export interface ConsignmentFilters {
  status?: string
  sellerId?: string
  search?: string
}

export async function list(
  filters: ConsignmentFilters,
  pageOptions: PageOptions,
): Promise<DbListResult<ConsignmentWithRelations>> {
  const client = createAdminClient()
  const from = (pageOptions.page - 1) * pageOptions.pageSize
  const to = from + pageOptions.pageSize - 1

  let query = client.from('consignment_requests').select(JOIN_COLUMNS, { count: 'exact' })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.sellerId) query = query.eq('seller_id', filters.sellerId)
  if (filters.search) query = query.ilike('product_name', `%${filters.search}%`)
  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await query
  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data as Record<string, unknown>[]).map(mapJoinRow),
    total: count ?? 0,
    error: null,
  }
}

export async function updateStatus(
  id: string,
  newStatus: string,
  extraFields?: Record<string, unknown>,
): Promise<DbResult<ConsignmentRequest>> {
  const client = createAdminClient()
  const { data: current, error: fetchErr } = await client
    .from('consignment_requests').select('status').eq('id', id).single()
  if (fetchErr) return { data: null, error: fetchErr.message }

  const currentStatus = (current as Record<string, unknown>).status as string
  const allowed = ALLOWED_TRANSITIONS[currentStatus as keyof typeof ALLOWED_TRANSITIONS]
  if (!allowed || !allowed.includes(newStatus as never)) {
    return { data: null, error: `상태 전이 불가: ${currentStatus} → ${newStatus}` }
  }

  const updateFields: Record<string, unknown> = { status: newStatus, ...extraFields }
  const { data, error } = await client
    .from('consignment_requests').update(updateFields).eq('id', id).select(COLUMNS).single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

export async function batchDelete(ids: string[]): Promise<DbResult<number>> {
  if (ids.length === 0) return { data: 0, error: null }
  const client = createAdminClient()
  const { error, count } = await client
    .from('consignment_requests').delete({ count: 'exact' }).in('id', ids)
  if (error) return { data: null, error: error.message }
  return { data: count ?? 0, error: null }
}

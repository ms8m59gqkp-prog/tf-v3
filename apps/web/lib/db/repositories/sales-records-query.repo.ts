/**
 * 매출장 조회 + 매칭 상태 관리
 * WHY: sales-records.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: COLUMNS/mapRow 재사용
 * WHERE: 매출 매칭 워크플로우 (조회/상태갱신/삭제)
 */
import { createAdminClient } from '../../supabase/admin'
import type { SalesRecord, MatchStatus } from '../../types/domain/settlement'
import type { DbResult, DbListResult, PageOptions } from '../types'
import { COLUMNS, mapRow } from './sales-records.repo'

export async function listUnmatched(batchIds?: string[]): Promise<DbResult<SalesRecord[]>> {
  const client = createAdminClient()
  let query = client.from('sales_records').select(COLUMNS).eq('match_status', 'unmatched')
  if (batchIds && batchIds.length > 0) {
    query = query.in('upload_batch', batchIds)
  }
  const { data, error } = await query.range(0, 49999)
  if (error) return { data: null, error: error.message }
  return { data: (data as unknown as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function updateMatchStatus(ids: string[], status: MatchStatus, expectedCurrent: MatchStatus): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('sales_records').update({ match_status: status }).in('id', ids).eq('match_status', expectedCurrent).select('id')
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).length, error: null }
}

export async function deleteBatch(batchId: string): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('sales_records').delete().eq('upload_batch', batchId).select('id')
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).length, error: null }
}

export async function hasMatchedInSession(sessionId: string): Promise<DbResult<boolean>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('sales_records').select('id')
    .eq('upload_session_id', sessionId)
    .neq('match_status', 'unmatched')
    .limit(1)
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).length > 0, error: null }
}

/** 조건부 DELETE — unmatched 레코드만 삭제 (TOCTOU 방어) */
export async function deleteBySessionId(sessionId: string): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { error, count } = await client
    .from('sales_records').delete({ count: 'exact' })
    .eq('upload_session_id', sessionId)
    .eq('match_status', 'unmatched')
  if (error) return { data: null, error: error.message }
  return { data: count ?? 0, error: null }
}

export async function list(
  pageOptions?: PageOptions,
): Promise<DbListResult<SalesRecord>> {
  const client = createAdminClient()
  const query = client.from('sales_records').select(COLUMNS, { count: 'exact' })
    .order('sale_date', { ascending: false })
  if (pageOptions) {
    const from = (pageOptions.page - 1) * pageOptions.pageSize
    query.range(from, from + pageOptions.pageSize - 1)
  } else {
    query.range(0, 4999)
  }
  const { data, error, count } = await query
  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data as unknown as Record<string, unknown>[]).map(mapRow),
    total: count ?? 0, error: null,
  }
}

export async function listByBatch(batchId: string): Promise<DbResult<SalesRecord[]>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('sales_records').select(COLUMNS)
    .eq('upload_batch', batchId).order('sale_date', { ascending: false })
    .range(0, 4999)
  if (error) return { data: null, error: error.message }
  return { data: (data as unknown as Record<string, unknown>[]).map(mapRow), error: null }
}

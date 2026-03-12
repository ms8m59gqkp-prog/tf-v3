/**
 * 네이버 정산 조회 + 매칭 상태 관리
 * WHY: naver-settlements.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: COLUMNS/mapRow 재사용
 * WHERE: 정산 매칭 워크플로우 (조회/상태갱신/삭제/정리)
 */
import { createAdminClient } from '../../supabase/admin'
import type { NaverSettlement, MatchStatus } from '../../types/domain/settlement'
import type { DbResult } from '../types'
import { COLUMNS, mapRow } from './naver-settlements.repo'

export async function listUnmatched(batchId?: string): Promise<DbResult<NaverSettlement[]>> {
  const client = createAdminClient()
  let query = client.from('naver_settlements').select(COLUMNS).eq('match_status', 'unmatched')
  if (batchId) query = query.eq('upload_batch', batchId)
  const { data, error } = await query.range(0, 49999)
  if (error) return { data: null, error: error.message }
  return { data: (data as unknown as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function updateMatchStatus(ids: string[], status: MatchStatus): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('naver_settlements').update({ match_status: status }).in('id', ids).select('id')
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).length, error: null }
}

export async function deleteBatch(batchId: string): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('naver_settlements').delete().eq('upload_batch', batchId).select('id')
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).length, error: null }
}

export async function cleanUnmatched(): Promise<DbResult<number>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('naver_settlements').delete().eq('match_status', 'unmatched').select('id')
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).length, error: null }
}

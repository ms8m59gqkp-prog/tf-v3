/**
 * 매칭 결과 CRUD
 * WHY: sales_records <-> naver_settlements 매칭 이력 관리
 * HOW: settlement_matches 테이블 직접 쿼리
 * WHERE: matching.service.ts에서 import
 */
import { createAdminClient } from '../../supabase/admin'
import type { SettlementMatch } from '../../types/domain/settlement'
import type { DbResult } from '../types'

const COLUMNS = `id, sales_record_id, naver_settlement_id,
  match_type, match_score, match_reason, matched_by, matched_at` as const

function mapRow(row: Record<string, unknown>): SettlementMatch {
  return {
    id: row.id as string,
    salesRecordId: (row.sales_record_id as string) ?? null,
    naverSettlementId: (row.naver_settlement_id as string) ?? null,
    matchType: row.match_type as string,
    matchScore: row.match_score != null ? Number(row.match_score) : null,
    matchReason: (row.match_reason as string) ?? null,
    matchedBy: (row.matched_by as string) ?? null,
    matchedAt: (row.matched_at as string) ?? null,
  }
}

export { COLUMNS as MATCH_COLUMNS, mapRow as mapMatchRow }

export async function create(input: {
  salesRecordId: string
  naverSettlementId: string
  matchType: string
  matchScore: number
  matchReason?: string
  matchedBy?: string
}): Promise<DbResult<SettlementMatch>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlement_matches')
    .insert({
      sales_record_id: input.salesRecordId,
      naver_settlement_id: input.naverSettlementId,
      match_type: input.matchType,
      match_score: input.matchScore,
      match_reason: input.matchReason ?? null,
      matched_by: input.matchedBy ?? 'system',
    })
    .select(COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

export async function findByMatchIds(
  ids: string[],
): Promise<DbResult<SettlementMatch[]>> {
  if (ids.length === 0) return { data: [], error: null }
  const client = createAdminClient()
  const { data, error } = await client
    .from('settlement_matches')
    .select(COLUMNS)
    .in('id', ids)
  if (error) return { data: null, error: error.message }
  return { data: (data as Record<string, unknown>[]).map(mapRow), error: null }
}

export async function deleteByIds(
  ids: string[],
): Promise<DbResult<number>> {
  if (ids.length === 0) return { data: 0, error: null }
  const client = createAdminClient()
  const { error, count } = await client
    .from('settlement_matches')
    .delete({ count: 'exact' })
    .in('id', ids)
  if (error) return { data: null, error: error.message }
  return { data: count ?? 0, error: null }
}

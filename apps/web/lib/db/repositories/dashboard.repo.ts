/**
 * 대시보드 집계 리포지토리
 * WHY: dashboard.service의 DB 직접 호출을 repo로 분리 (arch-spec 4.1)
 * HOW: 각 테이블 count 쿼리를 개별 함수로 제공, allSettled로 부분 실패 허용
 * WHERE: dashboard.service.ts에서 호출
 */
import { createAdminClient } from '../../supabase/admin'

interface CountResult {
  count: number
  error: string | null
}

async function countQuery(
  table: string,
  filter?: { column: string; op: 'eq' | 'in' | 'gte'; value: unknown },
): Promise<CountResult> {
  const client = createAdminClient()
  let query = client.from(table).select('id', { count: 'exact', head: true })
  if (filter) {
    if (filter.op === 'eq') query = query.eq(filter.column, filter.value)
    else if (filter.op === 'in') query = query.in(filter.column, filter.value as string[])
    else if (filter.op === 'gte') query = query.gte(filter.column, filter.value)
  }
  const { count, error } = await query
  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

export interface DashboardCounts {
  consTotal: CountResult
  consPending: CountResult
  consInspecting: CountResult
  ordTotal: CountResult
  ordActive: CountResult
  setTotal: CountResult
  setDraft: CountResult
  setConfirmed: CountResult
  todayCons: CountResult
  todaySales: CountResult
}

export async function getAllCounts(today: string): Promise<DashboardCounts> {
  const results = await Promise.allSettled([
    countQuery('consignments'),
    countQuery('consignments', { column: 'status', op: 'eq', value: 'pending' }),
    countQuery('consignments', { column: 'status', op: 'eq', value: 'inspecting' }),
    countQuery('orders'),
    countQuery('orders', { column: 'status', op: 'in', value: ['pending', 'processing'] }),
    countQuery('settlements'),
    countQuery('settlements', { column: 'status', op: 'eq', value: 'draft' }),
    countQuery('settlements', { column: 'status', op: 'eq', value: 'confirmed' }),
    countQuery('consignments', { column: 'created_at', op: 'gte', value: today }),
    countQuery('sold_items', { column: 'sold_at', op: 'gte', value: today }),
  ])

  const safe = (r: PromiseSettledResult<CountResult>): CountResult =>
    r.status === 'fulfilled' ? r.value : { count: 0, error: r.reason?.message ?? 'unknown' }

  return {
    consTotal: safe(results[0]),
    consPending: safe(results[1]),
    consInspecting: safe(results[2]),
    ordTotal: safe(results[3]),
    ordActive: safe(results[4]),
    setTotal: safe(results[5]),
    setDraft: safe(results[6]),
    setConfirmed: safe(results[7]),
    todayCons: safe(results[8]),
    todaySales: safe(results[9]),
  }
}

/**
 * 셀러 조회 전용 리포지토리
 * WHY: sellers.repo.ts 120줄 제한 준수 (AV4)
 * HOW: 페이지네이션 + 이름+전화 조합 검색
 * WHERE: 셀러 목록 화면, 셀러 검색
 */
import { createAdminClient } from '../../supabase/admin'
import type { Seller } from '../../types/domain/seller'
import type { DbResult, DbListResult, PageOptions } from '../types'
import { COLUMNS, mapRow } from './sellers.repo'

export async function findByNameAndPhone(
  name: string,
  phone: string,
): Promise<DbResult<Seller | null>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('sellers')
    .select(COLUMNS)
    .eq('name', name)
    .eq('phone', phone)
    .maybeSingle()
  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }
  return { data: mapRow(data as unknown as Record<string, unknown>), error: null }
}

export async function listByPage(options: PageOptions): Promise<DbListResult<Seller>> {
  const { page, pageSize, sortBy = 'created_at', ascending = false } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const client = createAdminClient()
  const { data, error, count } = await client
    .from('sellers')
    .select(COLUMNS, { count: 'exact' })
    .order(sortBy, { ascending })
    .range(from, to)

  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data as unknown as Record<string, unknown>[]).map(mapRow),
    total: count ?? 0,
    error: null,
  }
}

/**
 * 셀러 배치(대량) 조회
 * WHY: findByPhones 등 IN 쿼리를 sellers.repo.ts(121줄)에서 분리 (§10.1)
 * HOW: chunk() 분할 + 병렬 실행 + COLUMNS/mapRow 재사용
 * WHERE: 위탁/정산 서비스에서 대량 셀러 조회
 */
import { createAdminClient } from '../../supabase/admin'
import type { Seller } from '../../types/domain/seller'
import type { DbResult } from '../types'
import { COLUMNS, mapRow } from './sellers.repo'
import { chunk } from '../../utils/chunk'

const BATCH_SIZE = 200

/** 전화번호 목록으로 셀러 대량 조회 (200건씩 분할) */
export async function findByPhones(phones: string[]): Promise<DbResult<Seller[]>> {
  if (phones.length === 0) return { data: [], error: null }

  const client = createAdminClient()
  const chunks = chunk(phones, BATCH_SIZE)
  const results = await Promise.all(
    chunks.map(batch =>
      client.from('sellers').select(COLUMNS).in('phone', batch),
    ),
  )

  const sellers: Seller[] = []
  for (const { data, error } of results) {
    if (error) return { data: null, error: error.message }
    for (const row of data as unknown as Record<string, unknown>[]) {
      sellers.push(mapRow(row))
    }
  }
  return { data: sellers, error: null }
}

/**
 * 위탁 벌크 생성 (엑셀 대량 업로드)
 * WHY: consignments.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: 행 검증 → 중복 체크(1회 IN 쿼리 + seen Set) → 개별 INSERT
 * WHERE: 엑셀 위탁 일괄 등록
 */
import { createAdminClient } from '../../supabase/admin'
import type { ConsignmentRequest } from '../../types/domain/consignment'
import type { BulkResult, FailedRow } from '../types'
import { COLUMNS, mapRow } from './consignments.repo'

export async function bulkCreate(
  rows: Array<{ rowIndex: number; data: Record<string, unknown> }>,
): Promise<BulkResult<ConsignmentRequest>> {
  const succeeded: ConsignmentRequest[] = []
  const failed: FailedRow[] = []

  const validated: Array<{ rowIndex: number; data: Record<string, unknown> }> = []
  for (const row of rows) {
    const errors = validateRow(row.data)
    if (errors.length > 0) {
      failed.push({ rowIndex: row.rowIndex, data: row.data, errors })
      continue
    }
    validated.push(row)
  }
  if (validated.length === 0) return { succeeded, failed, total: rows.length }

  const pairs = validated.map((r) => ({
    sellerId: r.data.seller_id as string,
    productName: r.data.product_name as string,
  }))
  const existingSet = await checkDuplicates(pairs)
  const seen = new Set<string>()

  const insertReady: Array<{ rowIndex: number; data: Record<string, unknown> }> = []
  for (const row of validated) {
    const key = `${row.data.seller_id}::${row.data.product_name}`
    if (existingSet.has(key) || seen.has(key)) {
      failed.push({
        rowIndex: row.rowIndex, data: row.data,
        errors: [{ field: 'product_name', type: 'duplicate', message: '이미 등록된 위탁 (셀러+상품명 중복)' }],
      })
      continue
    }
    seen.add(key)
    insertReady.push(row)
  }

  const client = createAdminClient()
  for (const row of insertReady) {
    const { data, error } = await client
      .from('consignment_requests').insert(row.data).select(COLUMNS).single()
    if (error) {
      failed.push({
        rowIndex: row.rowIndex, data: row.data,
        errors: [{ field: 'db', type: 'constraint', message: error.message }],
      })
      continue
    }
    succeeded.push(mapRow(data as Record<string, unknown>))
  }

  return { succeeded, failed, total: rows.length }
}

export async function checkDuplicates(
  pairs: Array<{ sellerId: string; productName: string }>,
): Promise<Set<string>> {
  if (pairs.length === 0) return new Set()
  const client = createAdminClient()

  const { data, error } = await client.rpc(
    'check_consignment_duplicates' as never,
    { p_pairs: pairs.map(p => ({ seller_id: p.sellerId, product_name: p.productName })) } as never,
  )

  if (error || !data) return new Set()
  const result = new Set<string>()
  for (const row of data as Array<{ seller_id: string; product_name: string }>) {
    result.add(`${row.seller_id}::${row.product_name}`)
  }
  return result
}

function validateRow(data: Record<string, unknown>): FailedRow['errors'] {
  const errors: FailedRow['errors'] = []
  if (!data.seller_id) errors.push({ field: 'seller_id', type: 'missing', message: '셀러 ID 필수' })
  if (!data.product_name) errors.push({ field: 'product_name', type: 'missing', message: '상품명 필수' })
  if (!data.desired_price || (data.desired_price as number) <= 0) {
    errors.push({ field: 'desired_price', type: 'format', message: '희망가격은 양수 필수', expected: '0보다 큰 정수' })
  }
  if (!data.product_condition) errors.push({ field: 'product_condition', type: 'missing', message: '상품상태 필수' })
  return errors
}

/**
 * 배치 진행률 CRUD (_batch_progress 테이블)
 * WHY: batch.repo.ts 120줄 제한 준수 (§10.1)
 * HOW: createAdminClient + mapBatchRow 재사용, read-modify-write 패턴
 * WHERE: 엑셀 배치 업로드 진행률 추적
 */
import { createAdminClient } from '../../supabase/admin'
import type { BatchProgress } from '../../types/domain/notification'
import type { DbResult } from '../types'
import { BATCH_COLUMNS, mapBatchRow } from './batch.repo'

export async function createProgress(batchId: string, total: number): Promise<DbResult<BatchProgress>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('_batch_progress')
    .insert({ batch_id: batchId, total, status: 'running' })
    .select(BATCH_COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapBatchRow(data as Record<string, unknown>), error: null }
}

export async function incrementCompleted(batchId: string): Promise<DbResult<void>> {
  const client = createAdminClient()
  const { error } = await client.rpc(
    'increment_batch_completed' as never,
    { p_batch_id: batchId } as never,
  )
  if (error) return { data: null, error: error.message }
  return { data: undefined as void, error: null }
}

export async function incrementFailed(batchId: string, failedId: string): Promise<DbResult<void>> {
  const client = createAdminClient()
  const { error } = await client.rpc(
    'increment_batch_failed' as never,
    { p_batch_id: batchId, p_failed_id: failedId } as never,
  )
  if (error) return { data: null, error: error.message }
  return { data: undefined as void, error: null }
}

/**
 * 배치 완료 처리: failed 카운트 기반 상태 결정
 * - failed=0 → 'completed', failed<total → 'partial', else → 'failed'
 */
export async function completeProgress(batchId: string): Promise<DbResult<BatchProgress>> {
  const client = createAdminClient()
  const { data: current, error: readErr } = await client
    .from('_batch_progress')
    .select(BATCH_COLUMNS)
    .eq('batch_id', batchId)
    .single()
  if (readErr) return { data: null, error: readErr.message }

  const row = current as Record<string, unknown>
  const failed = row.failed as number
  const total = row.total as number
  let finalStatus: string
  if (failed === 0) finalStatus = 'completed'
  else if (failed < total) finalStatus = 'partial'
  else finalStatus = 'failed'

  const { data, error } = await client
    .from('_batch_progress')
    .update({ status: finalStatus, updated_at: new Date().toISOString() })
    .eq('batch_id', batchId)
    .select(BATCH_COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapBatchRow(data as Record<string, unknown>), error: null }
}

export async function getProgress(batchId: string): Promise<DbResult<BatchProgress>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('_batch_progress')
    .select(BATCH_COLUMNS)
    .eq('batch_id', batchId)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapBatchRow(data as Record<string, unknown>), error: null }
}

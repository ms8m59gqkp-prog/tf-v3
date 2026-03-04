/**
 * 배치 리포지토리 — _batch_progress 테이블 CRUD
 * WHY: 사진 분류 배치 진행 상태 추적
 * HOW: createAdminClient + mapRow
 * WHERE: batch/photo 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'
import type { BatchProgress, BatchStatus, BatchResult } from '@/lib/types/domain/photo'

const COLUMNS = 'id, batch_id, total, completed, failed, failed_ids, status, created_at, updated_at'

export function mapRow(row: Record<string, unknown>): BatchProgress {
  const completed = Number(row.completed)
  const failed = Number(row.failed)
  return {
    id: row.id as string,
    batchId: row.batch_id as string,
    totalFiles: Number(row.total),
    processedFiles: completed,
    successCount: completed - failed,
    failCount: failed,
    status: row.status as BatchStatus,
    startedAt: row.created_at as string,
    completedAt: row.status === 'completed' ? (row.updated_at as string) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function logBatch(result: BatchResult): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('_batch_progress')
    .upsert(
      {
        batch_id: result.batchId,
        total: result.total,
        completed: result.success + result.failed,
        failed: result.failed,
        failed_ids: result.failedIds,
        status: result.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'batch_id' },
    )
  if (error) throw new Error(`[batch.logBatch] ${error.message}`)
}

export async function getByBatchId(batchId: string): Promise<BatchProgress> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('_batch_progress')
    .select(COLUMNS)
    .eq('batch_id', batchId)
    .single()
  if (error) throw new Error(`[batch.getByBatchId] ${error.message}`)
  return mapRow(data)
}

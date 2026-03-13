/**
 * 배치 진행률 서비스 (L1 Business Layer)
 * WHY: L3 route→L0 repo 직접 호출 방지 (architecture-spec)
 * HOW: batch-progress.repo 래핑
 * WHERE: GET /api/admin/batch/[batchId]/progress
 */
import { AppError } from '../errors'
import * as batchProgressRepo from '../db/repositories/batch-progress.repo'
import type { BatchProgress } from '../types/domain/notification'

export async function getProgress(batchId: string): Promise<BatchProgress> {
  const result = await batchProgressRepo.getProgress(batchId)
  if (result.error !== null) {
    throw new AppError('NOT_FOUND', `배치 진행률을 찾을 수 없습니다: ${batchId}`)
  }
  return result.data
}

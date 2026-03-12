/**
 * GET /api/admin/batch/[batchId]/progress — 배치 진행률 조회
 * WHY: 엑셀 업로드 등 배치 작업의 실시간 진행률 확인
 * HOW: withAdmin → batchId 파라미터 → batch-progress.repo.getProgress → ok
 * WHERE: 배치 업로드 진행률 폴링
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
// eslint-disable-next-line no-restricted-imports -- 단순 조회, 전용 서비스 불필요
import * as batchProgressRepo from '@/lib/db/repositories/batch-progress.repo'

export const GET = withAdmin(async (
  _req: NextRequest,
  ctx: { params: Promise<{ batchId: string }> },
) => {
  try {
    const { batchId } = await ctx.params
    if (!batchId || batchId.trim().length === 0) {
      return validationErr('batchId는 필수입니다')
    }

    const result = await batchProgressRepo.getProgress(batchId)
    if (result.error !== null) {
      return errFrom(new Error(result.error))
    }
    return ok(result.data)
  } catch (e) { return errFrom(e) }
})

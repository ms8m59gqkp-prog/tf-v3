/**
 * POST /api/admin/matching/queue — 정산 대기열 등록
 * DELETE /api/admin/matching/queue — 정산 대기열 초기화
 * WHY: 매칭 완료 건 정산 대기열 적재 + 초기화
 * HOW: withAdmin → matching.queueSettlements/clearQueue → ok
 * WHERE: admin/matching 페이지 (대기열 관리)
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import * as matchingService from '@/lib/services/matching.service'

export const POST = withAdmin(async () => {
  try {
    console.log('[matching/queue] 대기열 등록 시작')
    const result = await matchingService.queueSettlements()
    console.log('[matching/queue] 완료:', result.queued, '건 등록')
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const DELETE = withAdmin(async () => {
  try {
    console.log('[matching/queue] 대기열 초기화')
    await matchingService.clearQueue()
    return ok({ cleared: true })
  } catch (e) { return errFrom(e) }
})

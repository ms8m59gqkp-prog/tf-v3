/**
 * GET /api/admin/matching/queue/summary — 정산 대기열 요약
 * WHY: 셀러별 정산 대기 현황 집계
 * HOW: withAdmin → matching.getQueueSummary → ok
 * WHERE: admin/matching 페이지 (대기열 탭)
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import * as matchingService from '@/lib/services/matching.service'

export const GET = withAdmin(async () => {
  try {
    const result = await matchingService.getQueueSummary()
    return ok(result)
  } catch (e) { return errFrom(e) }
})

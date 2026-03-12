/**
 * GET /api/admin/dashboard — 관리자 대시보드 요약
 * WHY: 위탁/주문/정산/최근활동 집계 데이터 제공
 * HOW: withAdmin → dashboard.service.getSummary → ok
 * WHERE: 관리자 대시보드 메인 페이지
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import * as dashboardService from '@/lib/services/dashboard.service'

export const GET = withAdmin(async () => {
  try {
    const summary = await dashboardService.getSummary()
    return ok(summary)
  } catch (e) { return errFrom(e) }
})

/**
 * POST /api/admin/matching/auto — 자동 매칭 실행
 * WHY: 3단계 자동 매칭 (상품주문번호 → 구매자+금액 → 상품명 Jaccard)
 * HOW: withAdmin → matching.autoMatch → ok
 * WHERE: admin/matching 페이지 (자동매칭 버튼)
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import * as matchingService from '@/lib/services/matching.service'

export const POST = withAdmin(async () => {
  try {
    console.log('[matching/auto] 시작')
    const result = await matchingService.autoMatch()
    console.log('[matching/auto] 완료:', result.matched, '건 매칭')
    return ok(result)
  } catch (e) { return errFrom(e) }
})

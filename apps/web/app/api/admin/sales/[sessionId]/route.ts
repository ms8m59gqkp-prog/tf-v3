/**
 * DELETE /api/admin/sales/[sessionId] — 세션별 매출 기록 삭제
 * WHY: 잘못 업로드된 매출 세션을 통째로 삭제
 * HOW: withAdmin → UUID → match_status 선검증 → sales.deleteBySession → ok
 * WHERE: admin/sales 업로드 이력 삭제 버튼
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as salesService from '@/lib/services/sales.service'

export const DELETE = withAdmin<{ sessionId: string }>(async (_req, { params }) => {
  try {
    const { sessionId } = await params
    const idCheck = uuidSchema.safeParse(sessionId)
    if (!idCheck.success) return validationErr('유효한 세션 UUID가 아닙니다')

    const deleted = await salesService.deleteBySession(sessionId)
    return ok({ deleted })
  } catch (e) { return errFrom(e) }
})

/**
 * DELETE /api/admin/matching/[id] — 매칭 취소
 * WHY: 잘못된 매칭 건 되돌리기
 * HOW: withAdmin → UUID 검증 → matching.cancelMatch → ok
 * WHERE: admin/matching 페이지 (매칭 취소 버튼)
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as matchingService from '@/lib/services/matching.service'

export const DELETE = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    await matchingService.cancelMatch(id)
    return ok({ deleted: true })
  } catch (e) { return errFrom(e) }
})

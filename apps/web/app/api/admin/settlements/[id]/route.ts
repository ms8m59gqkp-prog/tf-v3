/**
 * GET /api/admin/settlements/[id] — 정산 단건 조회
 * WHY: 정산 상세 내역 확인
 * HOW: withAdmin → UUID 검증 → settlement.getById → ok
 * WHERE: admin/settlement/detail 페이지
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as settlementService from '@/lib/services/settlement.service'

export const GET = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await settlementService.getById(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

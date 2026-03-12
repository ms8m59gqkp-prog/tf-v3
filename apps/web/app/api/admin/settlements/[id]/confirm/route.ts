/**
 * POST /api/admin/settlements/[id]/confirm — 정산 확정
 * WHY: draft → confirmed 상태 전이
 * HOW: withAdmin → UUID 검증 → settlement.confirm → ok
 * WHERE: admin/settlement/detail 페이지 (확정 버튼)
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as settlementService from '@/lib/services/settlement.service'

export const POST = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await settlementService.confirm(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

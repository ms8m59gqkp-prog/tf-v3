/**
 * POST /api/admin/consignments/[id]/approve — 위탁 승인
 * WHY: 검수 완료 후 승인 처리 (상품번호 자동 생성)
 * HOW: withAdmin → UUID 검증 → consignment.approveConsignment → ok
 * WHERE: admin/consignment/detail 페이지 (승인 버튼)
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as consignmentService from '@/lib/services/consignment.service'

export const POST = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await consignmentService.approveConsignment(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

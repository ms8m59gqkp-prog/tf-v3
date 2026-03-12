/**
 * GET /api/admin/orders/[id]/items — 주문 아이템 목록 조회
 * WHY: 주문 내 개별 상품 상세 목록
 * HOW: withAdmin → UUID 검증 → order.getItems → ok
 * WHERE: admin/orders/detail 페이지 (아이템 탭)
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as orderService from '@/lib/services/order.service'

export const GET = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await orderService.getItems(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

/**
 * GET /api/admin/orders/[id] — 주문 단건 조회
 * PATCH /api/admin/orders/[id] — 주문 상태 변경
 * WHY: 주문 상세 조회 + 상태 전이
 * HOW: withAdmin → UUID 검증 → 서비스 위임 → ok
 * WHERE: admin/orders/detail 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import { UpdateOrderSchema } from './schema'
import * as orderService from '@/lib/services/order.service'

export const GET = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await orderService.getById(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const PATCH = withAdmin<{ id: string }>(async (req: NextRequest, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const body = await req.json().catch(() => ({}))
    const parsed = UpdateOrderSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await orderService.updateStatus(id, parsed.data.status)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

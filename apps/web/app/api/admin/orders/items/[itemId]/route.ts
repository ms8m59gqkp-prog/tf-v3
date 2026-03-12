/**
 * PATCH /api/admin/orders/items/[itemId] — 주문 아이템 수정
 * WHY: 검수 결과, 가격 등 아이템 단위 업데이트
 * HOW: withAdmin → UUID 검증 → Zod → order.updateItem → ok
 * WHERE: admin/orders/detail 페이지 (아이템 수정)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import { UpdateOrderItemSchema } from './schema'
import * as orderService from '@/lib/services/order.service'

export const PATCH = withAdmin<{ itemId: string }>(async (req: NextRequest, { params }) => {
  try {
    const { itemId } = await params
    const idCheck = uuidSchema.safeParse(itemId)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const body = await req.json().catch(() => ({}))
    const parsed = UpdateOrderItemSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await orderService.updateItem(itemId, parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

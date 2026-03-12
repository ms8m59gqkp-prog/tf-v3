/**
 * PATCH /api/admin/orders/[id]/measurement — 주문 아이템 치수 업데이트
 * WHY: 실측 데이터(치수/사이즈) 반영
 * HOW: withAdmin → UUID + Zod → order.updateMeasurement → ok
 * WHERE: admin/orders/detail 치수 탭
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import { UpdateMeasurementSchema } from './schema'
import * as orderService from '@/lib/services/order.service'

export const PATCH = withAdmin<{ id: string }>(async (req: NextRequest, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 주문 UUID가 아닙니다')

    const body = await req.json().catch(() => ({}))
    const parsed = UpdateMeasurementSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const { itemId, ...fields } = parsed.data
    const result = await orderService.updateMeasurement(itemId, fields)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

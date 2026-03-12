/**
 * GET/PATCH/DELETE /api/admin/consignments/[id] — 위탁 조회/상태변경/삭제
 * WHY: 위탁 상세 조회 + 상태 전이 + 단건 삭제
 * HOW: withAdmin → UUID 검증 → 서비스 위임 → ok
 * WHERE: admin/consignment/detail 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import { UpdateConsignmentSchema } from './schema'
import * as consignmentService from '@/lib/services/consignment.service'

export const GET = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await consignmentService.getById(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const PATCH = withAdmin<{ id: string }>(async (req: NextRequest, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const body = await req.json().catch(() => ({}))
    const parsed = UpdateConsignmentSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const { status, ...extra } = parsed.data
    const result = await consignmentService.updateStatus(id, status, extra)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const DELETE = withAdmin<{ id: string }>(async (_req, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const deleted = await consignmentService.batchDelete([id])
    return ok({ deleted })
  } catch (e) { return errFrom(e) }
})

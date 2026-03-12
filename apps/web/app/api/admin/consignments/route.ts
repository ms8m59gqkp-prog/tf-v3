/**
 * GET /api/admin/consignments — 위탁 목록 조회
 * POST /api/admin/consignments — 위탁 단건 생성
 * WHY: 위탁 관리 메인 목록 + 개별 접수
 * HOW: withAdmin → 쿼리파라미터/Zod → consignment.list/create → ok
 * WHERE: admin/consignments 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { safePage } from '@/lib/utils/validation'
import { CreateConsignmentSchema } from './schema'
import * as consignmentService from '@/lib/services/consignment.service'

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl
    const { page, pageSize } = safePage(url)
    const status = url.searchParams.get('status') ?? undefined
    const sellerId = url.searchParams.get('sellerId') ?? undefined
    const search = url.searchParams.get('search') ?? undefined

    const result = await consignmentService.list(
      { status, sellerId, search },
      { page, pageSize },
    )
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = CreateConsignmentSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await consignmentService.create(parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

/**
 * GET /api/admin/sellers/[id] — 셀러 상세 조회
 * PATCH /api/admin/sellers/[id] — 셀러 정보 수정
 * WHY: 셀러 상세 페이지 데이터 + 관리자 수정
 * HOW: withAdmin → UUID 검증 → seller.getById/update → ok
 * WHERE: admin/sellers/[id] 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import { UpdateSellerSchema } from './schema'
import * as sellerService from '@/lib/services/seller.service'

export const GET = withAdmin(async (
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await ctx.params
    const idParsed = uuidSchema.safeParse(id)
    if (!idParsed.success) return validationErr(idParsed.error.issues[0].message)

    const result = await sellerService.getById(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const PATCH = withAdmin(async (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await ctx.params
    const idParsed = uuidSchema.safeParse(id)
    if (!idParsed.success) return validationErr(idParsed.error.issues[0].message)

    const body = await req.json().catch(() => ({}))
    const parsed = UpdateSellerSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await sellerService.update(id, parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

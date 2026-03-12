/**
 * GET /api/admin/sellers/[id]/history — 셀러 활동 이력 요약
 * WHY: 셀러 상세 페이지에서 위탁/주문/정산 건수 집계 표시
 * HOW: withAdmin → UUID 검증 → seller.getHistory → ok
 * WHERE: admin/sellers/[id] 상세 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as sellerService from '@/lib/services/seller.service'

export const GET = withAdmin(async (
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await ctx.params
    const idParsed = uuidSchema.safeParse(id)
    if (!idParsed.success) return validationErr(idParsed.error.issues[0].message)

    const result = await sellerService.getHistory(id)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

/**
 * GET /api/admin/sellers — 셀러 목록 조회
 * WHY: 셀러 관리 페이지 데이터 제공
 * HOW: withAdmin → 쿼리파라미터 → seller.list → ok
 * WHERE: admin/sellers 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import { safePage } from '@/lib/utils/validation'
import * as sellerService from '@/lib/services/seller.service'

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl
    const { page, pageSize } = safePage(url)
    const status = url.searchParams.get('status') ?? undefined
    const search = url.searchParams.get('search') ?? undefined

    const result = await sellerService.list(
      { status, search },
      { page, pageSize },
    )
    return ok(result)
  } catch (e) { return errFrom(e) }
})

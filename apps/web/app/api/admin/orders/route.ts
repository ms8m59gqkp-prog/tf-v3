/**
 * GET /api/admin/orders — 주문 목록 조회
 * WHY: 주문 관리 페이지 메인 목록
 * HOW: withAdmin → 쿼리파라미터 파싱 → order.list → ok
 * WHERE: admin/orders 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import { safePage } from '@/lib/utils/validation'
import * as orderService from '@/lib/services/order.service'

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl
    const { page, pageSize } = safePage(url)
    const status = url.searchParams.get('status') ?? undefined
    const search = url.searchParams.get('search') ?? undefined

    const result = await orderService.list(
      { status, search },
      { page, pageSize },
    )
    return ok(result)
  } catch (e) { return errFrom(e) }
})

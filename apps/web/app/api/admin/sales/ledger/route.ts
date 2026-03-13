/**
 * GET /api/admin/sales/ledger — 매출장부 목록 조회
 * WHY: 업로드된 매출 기록의 페이지네이션 조회
 * HOW: withAdmin → page/pageSize 파싱 → sales.listLedger → ok
 * WHERE: admin 매출장부 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import { safePage } from '@/lib/utils/validation'
import * as salesService from '@/lib/services/sales.service'

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const { page, pageSize } = safePage(req.nextUrl)
    const result = await salesService.listLedger(page, pageSize)
    return ok({ data: result.data, total: result.total, page, pageSize })
  } catch (e) { return errFrom(e) }
})

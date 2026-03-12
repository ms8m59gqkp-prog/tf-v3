/**
 * GET /api/admin/settlements — 정산 목록 조회
 * WHY: 정산 관리 페이지 메인 목록
 * HOW: withAdmin → 쿼리파라미터 파싱 → settlement.list → ok
 * WHERE: admin/settlement 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import { safePage } from '@/lib/utils/validation'
import * as settlementService from '@/lib/services/settlement.service'
import type { SettlementStatus } from '@/lib/types/domain/settlement'

const VALID_STATUSES = new Set(['draft', 'confirmed', 'paid', 'failed'])

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl
    const { page, pageSize } = safePage(url)
    const statusParam = url.searchParams.get('status') ?? undefined
    const status = statusParam && VALID_STATUSES.has(statusParam)
      ? statusParam as SettlementStatus : undefined
    const periodFrom = url.searchParams.get('periodFrom') ?? undefined
    const periodTo = url.searchParams.get('periodTo') ?? undefined
    const sellerId = url.searchParams.get('sellerId') ?? undefined

    const result = await settlementService.list(
      { status, periodFrom, periodTo, sellerId },
      { page, pageSize },
    )
    return ok(result)
  } catch (e) { return errFrom(e) }
})

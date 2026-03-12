/**
 * GET /api/admin/sales/detect-consignment — 위탁 매출 감지
 * WHY: 매출 데이터에서 위탁 판매 건 자동 식별
 * HOW: withAdmin → batchId 쿼리 → sales.detectConsignmentSales → ok
 * WHERE: admin/sales 페이지 (위탁감지 버튼)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as salesService from '@/lib/services/sales.service'

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const batchId = req.nextUrl.searchParams.get('batchId')
    if (!batchId) return validationErr('batchId는 필수입니다')
    const idCheck = uuidSchema.safeParse(batchId)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const result = await salesService.detectConsignmentSales(batchId)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

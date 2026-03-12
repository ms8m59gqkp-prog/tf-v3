/**
 * POST /api/admin/sales/upload — 매출대장 업로드
 * WHY: 엑셀 기반 매출대장 데이터 일괄 등록
 * HOW: withAdmin → Zod → sales.uploadSalesLedger → ok
 * WHERE: admin/sales 페이지 (업로드 버튼)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { SalesUploadSchema } from './schema'
import * as salesService from '@/lib/services/sales.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = SalesUploadSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    console.log('[sales/upload] 시작:', parsed.data.rows.length, '행')
    const result = await salesService.uploadSalesLedger(parsed.data.rows, parsed.data.sessionId)
    console.log('[sales/upload] 완료:', result.inserted, '건 삽입')
    return ok(result)
  } catch (e) { return errFrom(e) }
})

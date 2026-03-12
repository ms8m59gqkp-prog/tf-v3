/**
 * POST /api/admin/sales/naver/upload — 네이버 정산 데이터 업로드
 * WHY: 네이버 스마트스토어 정산 엑셀 일괄 등록
 * HOW: withAdmin → Zod → sales.uploadNaverSettle → ok
 * WHERE: admin/sales/naver 페이지 (업로드 버튼)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { NaverUploadSchema } from './schema'
import * as salesService from '@/lib/services/sales.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = NaverUploadSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    console.log('[sales/naver/upload] 시작:', parsed.data.rows.length, '행')
    const result = await salesService.uploadNaverSettle(parsed.data.rows, parsed.data.batchId)
    console.log('[sales/naver/upload] 완료:', result.inserted, '건 삽입')
    return ok(result)
  } catch (e) { return errFrom(e) }
})

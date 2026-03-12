/**
 * POST /api/admin/products/bulk-export-naver — 네이버 스마트스토어 일괄 내보내기
 * WHY: 복수 상품을 네이버 등록 양식으로 변환
 * HOW: withAdmin → Zod → naver-export.service → ok/errFrom
 * WHERE: 상품 목록 화면 일괄 내보내기 버튼
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { BulkExportNaverSchema } from './schema'
import * as naverExportService from '@/lib/services/naver-export.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = BulkExportNaverSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const rows = await naverExportService.bulkExport(parsed.data.productIds)
    return ok({ rows, count: rows.length })
  } catch (e) { return errFrom(e) }
})

/**
 * POST /api/admin/consignments/bulk — 위탁 일괄 등록
 * WHY: 엑셀 파싱 결과를 일괄 등록 (V2 대량 접수 대응)
 * HOW: withAdmin → Zod 검증 → consignment.bulkCreate → ok
 * WHERE: admin/consignments 페이지 (엑셀 업로드)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { BulkConsignmentSchema } from './schema'
import * as consignmentService from '@/lib/services/consignment.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = BulkConsignmentSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await consignmentService.bulkCreate(parsed.data.rows)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

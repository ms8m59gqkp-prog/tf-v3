/**
 * POST /api/admin/matching/manual — 수동 매칭
 * WHY: 자동 매칭 실패 건에 대한 관리자 수동 매칭
 * HOW: withAdmin → Zod → matching.manualMatch → ok
 * WHERE: admin/matching 페이지 (수동매칭 모달)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { ManualMatchSchema } from './schema'
import * as matchingService from '@/lib/services/matching.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = ManualMatchSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const { salesRecordId, naverSettlementId, reason } = parsed.data
    const result = await matchingService.manualMatch(salesRecordId, naverSettlementId, reason)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

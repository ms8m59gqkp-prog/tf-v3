/**
 * POST /api/admin/settlements/generate — 정산 일괄 생성
 * WHY: 기간 기반 정산 생성 (V2 정산 워크플로 핵심)
 * HOW: withAdmin → Zod 검증 → settlement.generate → ok
 * WHERE: admin/settlement/workflow 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { GenerateSettlementSchema } from './schema'
import * as settlementService from '@/lib/services/settlement.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = GenerateSettlementSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    console.log('[settlements/generate] 시작:', parsed.data)
    const result = await settlementService.generate(parsed.data)
    console.log('[settlements/generate] 완료:', result.createdCount, '건')
    return ok(result)
  } catch (e) { return errFrom(e) }
})

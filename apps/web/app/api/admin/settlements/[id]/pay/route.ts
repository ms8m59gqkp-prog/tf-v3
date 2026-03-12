/**
 * POST /api/admin/settlements/[id]/pay — 정산 지급 처리
 * WHY: confirmed → paid 상태 전이 (TOCTOU 방어 — optimistic lock)
 * HOW: withAdmin → UUID 검증 → Zod → settlement.pay → ok
 * WHERE: admin/settlement/detail 페이지 (지급 버튼)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import { PaySettlementSchema } from './schema'
import * as settlementService from '@/lib/services/settlement.service'

export const POST = withAdmin<{ id: string }>(async (req: NextRequest, { params }) => {
  try {
    const { id } = await params
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) return validationErr('유효한 UUID가 아닙니다')

    const body = await req.json().catch(() => ({}))
    const parsed = PaySettlementSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await settlementService.pay(id, parsed.data.paidBy, parsed.data.transferRef)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

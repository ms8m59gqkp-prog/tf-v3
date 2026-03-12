/**
 * POST /api/admin/price-estimate — 네이버 기반 가격 추정
 * WHY: 상품 등록/수정 시 정가 추정 기능 제공
 * HOW: withAdmin → Zod → price-estimate.service → ok/errFrom
 * WHERE: 상품 등록 화면에서 호출
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { PriceEstimateSchema } from './schema'
import * as priceEstimateService from '@/lib/services/price-estimate.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = PriceEstimateSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await priceEstimateService.estimate(parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

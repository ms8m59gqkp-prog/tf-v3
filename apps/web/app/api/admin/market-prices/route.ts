/**
 * GET /api/admin/market-prices — 시세 목록 조회
 * POST /api/admin/market-prices — 시세 데이터 등록
 * WHY: 브랜드/카테고리별 시세 관리
 * HOW: withAdmin → 필터/Zod → market-price.service → ok/errFrom
 * WHERE: 시세 관리 화면에서 호출
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { safePage } from '@/lib/utils/validation'
import { CreateMarketPriceSchema } from './schema'
import * as marketPriceService from '@/lib/services/market-price.service'

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl
    const { page, pageSize } = safePage(url)
    const brand = url.searchParams.get('brand') ?? undefined
    const category = url.searchParams.get('category') ?? undefined
    const condition = url.searchParams.get('condition') ?? undefined
    const source = url.searchParams.get('source') ?? undefined

    const result = await marketPriceService.list(
      { brand, category, condition, source },
      { page, pageSize },
    )
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = CreateMarketPriceSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await marketPriceService.create(parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})

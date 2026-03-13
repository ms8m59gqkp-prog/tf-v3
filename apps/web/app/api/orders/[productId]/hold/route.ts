/**
 * GET/POST /api/orders/[productId]/hold — 주문 보류 공개 API
 * WHY: 고객이 토큰으로 보류 상품 조회/동의 (인증 없음, 토큰이 유일한 보안 게이트)
 * HOW: tokenSchema 검증 → order-hold.service 위임 → ok
 * WHERE: 고객 주문 보류 공개 페이지
 */
import type { NextRequest } from 'next/server'
import { ok, errFrom, validationErr, rateLimitErr } from '@/lib/api/response'
import { tokenSchema } from '@/lib/utils/validation'
import { checkRateLimit } from '@/lib/ratelimit'
import { HoldResponseSchema } from './schema'
import * as holdService from '@/lib/services/order-hold.service'

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ productId: string }> },
) {
  try {
    const { allowed } = checkRateLimit(getIp(req))
    if (!allowed) return rateLimitErr()

    const token = req.nextUrl.searchParams.get('token') ?? ''
    const check = tokenSchema.safeParse(token)
    if (!check.success) return validationErr('유효하지 않은 토큰입니다')

    const { productId } = await ctx.params
    const result = await holdService.getByToken(token)
    if (!result.items.some(i => i.productNumber === productId)) {
      return validationErr('해당 상품을 찾을 수 없습니다')
    }
    return ok(result)
  } catch (e) { return errFrom(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { allowed } = checkRateLimit(getIp(req))
    if (!allowed) return rateLimitErr()

    const body = await req.json().catch(() => ({}))
    const parsed = HoldResponseSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const { token, itemId, agreed } = parsed.data
    const result = await holdService.respondToHold(token, itemId, agreed)
    return ok(result)
  } catch (e) { return errFrom(e) }
}

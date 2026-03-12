/**
 * GET/POST /api/consignment/adjust/[token] — 위탁 가격 조정 공개 API
 * WHY: 셀러가 토큰으로 가격 조정 조회/응답 (인증 없음, 토큰이 유일한 보안 게이트)
 * HOW: tokenSchema 검증 → consignment-adjust.service 위임 → ok
 * WHERE: 셀러 가격 조정 공개 페이지
 */
import type { NextRequest } from 'next/server'
import { ok, errFrom, validationErr, rateLimitErr } from '@/lib/api/response'
import { tokenSchema } from '@/lib/utils/validation'
import { checkRateLimit } from '@/lib/ratelimit'
import { AdjustResponseSchema } from './schema'
import * as adjustService from '@/lib/services/consignment-adjust.service'

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const { allowed } = checkRateLimit(getIp(req))
    if (!allowed) return rateLimitErr()

    const { token } = await ctx.params
    const check = tokenSchema.safeParse(token)
    if (!check.success) return validationErr('유효하지 않은 토큰입니다')

    const result = await adjustService.getByToken(token)
    return ok(result)
  } catch (e) { return errFrom(e) }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const { allowed } = checkRateLimit(getIp(req))
    if (!allowed) return rateLimitErr()

    const { token } = await ctx.params
    const check = tokenSchema.safeParse(token)
    if (!check.success) return validationErr('유효하지 않은 토큰입니다')

    const body = await req.json().catch(() => ({}))
    const parsed = AdjustResponseSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await adjustService.respondToAdjust(
      token, parsed.data.response, parsed.data.counterPrice,
    )
    return ok(result)
  } catch (e) { return errFrom(e) }
}

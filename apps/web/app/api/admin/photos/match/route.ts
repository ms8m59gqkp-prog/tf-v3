/**
 * POST /api/admin/photos/match — 사진-상품 매칭
 * WHY: 메타데이터+비전 기반 사진 그룹↔상품 매칭
 * HOW: withAdmin → Zod → photo.match → ok
 * WHERE: admin/photos 페이지 (매칭 실행)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { PhotoMatchSchema } from './schema'
import * as photoService from '@/lib/services/photo.service'
import type { StProduct } from '@/lib/types/domain/product'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = PhotoMatchSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await photoService.match(
      parsed.data.photoGroups,
      // Zod 검증 후 구조적 타이핑 안전
      parsed.data.products as unknown as StProduct[],
    )
    return ok(result)
  } catch (e) { return errFrom(e) }
})

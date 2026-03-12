/**
 * POST /api/admin/photos/classify — AI 사진 분류
 * WHY: Claude Vision 기반 브랜드/카테고리/컨디션 자동 분류
 * HOW: withAdmin → Zod → photo.classify → ok
 * WHERE: admin/photos 페이지 (분류 실행)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { ClassifySchema } from './schema'
import * as photoService from '@/lib/services/photo.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = ClassifySchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    console.log('[photos/classify] 시작:', parsed.data.images.length, '장')
    const result = await photoService.classify(parsed.data.images, parsed.data.options)
    console.log('[photos/classify] 완료:', result.length, '건')
    return ok(result)
  } catch (e) { return errFrom(e) }
})

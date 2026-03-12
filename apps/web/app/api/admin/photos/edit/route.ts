/**
 * POST /api/admin/photos/edit — 사진 편집(배경 제거)
 * WHY: PhotoRoom 기반 배경 제거 파이프라인 실행
 * HOW: withAdmin → Zod → photo-edit.editPhotos → ok
 * WHERE: admin/photos 페이지 (편집 실행)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { PhotoEditSchema } from './schema'
import * as photoEditService from '@/lib/services/photo-edit.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = PhotoEditSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    console.log('[photos/edit] 시작:', parsed.data.photoIds.length, '건')
    const result = await photoEditService.editPhotos(parsed.data.photoIds)
    console.log('[photos/edit] 완료:', result.length, '건')
    return ok(result)
  } catch (e) { return errFrom(e) }
})

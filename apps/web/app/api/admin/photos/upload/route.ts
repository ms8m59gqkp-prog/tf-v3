/**
 * POST /api/admin/photos/upload — 사진 업로드 메타데이터 등록
 * WHY: 프론트엔드 Storage 업로드 후 DB에 메타 기록
 * HOW: withAdmin → Zod → photo-upload.upload → ok
 * WHERE: admin/photos 페이지 (업로드 실행)
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { PhotoUploadSchema } from './schema'
import * as photoUploadService from '@/lib/services/photo-upload.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = PhotoUploadSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    console.log('[photos/upload] 시작:', parsed.data.files.length, '건')
    const result = await photoUploadService.upload(parsed.data)
    console.log('[photos/upload] 완료:', result.length, '건')
    return ok(result)
  } catch (e) { return errFrom(e) }
})

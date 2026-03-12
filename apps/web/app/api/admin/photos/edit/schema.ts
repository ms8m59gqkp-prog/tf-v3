/**
 * POST /api/admin/photos/edit 요청 스키마
 * WHY: 사진 편집 대상 검증
 * HOW: Zod + uuidSchema
 * WHERE: photos/edit/route.ts
 */
import { z } from 'zod'
import { uuidSchema } from '@/lib/utils/validation'

export const PhotoEditSchema = z.object({
  photoIds: z.array(uuidSchema)
    .min(1, '최소 1개 사진을 선택해야 합니다')
    .max(20, '최대 20개까지 편집 가능합니다'),
})

/**
 * POST /api/admin/products/bulk-export-naver — 일괄 내보내기 스키마
 * WHY: productIds 배열 검증
 * HOW: Zod — UUID 배열, 1~200개 제한
 * WHERE: bulk-export-naver/route.ts에서 import
 */
import { z } from 'zod'
import { uuidSchema } from '@/lib/utils/validation'

export const BulkExportNaverSchema = z.object({
  productIds: z
    .array(uuidSchema)
    .min(1, '상품 ID가 비어있습니다')
    .max(200, '한 번에 최대 200개까지 내보내기 가능합니다'),
})

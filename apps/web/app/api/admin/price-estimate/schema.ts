/**
 * POST /api/admin/price-estimate — 가격 추정 요청 스키마
 * WHY: 브랜드/모델/카테고리/상태 입력값 검증
 * HOW: Zod 스키마 — 필수 4필드
 * WHERE: price-estimate/route.ts에서 import
 */
import { z } from 'zod'

export const PriceEstimateSchema = z.object({
  brand: z.string().min(1, '브랜드는 필수입니다'),
  model: z.string().min(1, '모델명은 필수입니다'),
  category: z.string().min(1, '카테고리는 필수입니다'),
  condition: z.string().min(1, '상태는 필수입니다'),
})

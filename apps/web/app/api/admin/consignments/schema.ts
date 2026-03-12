/**
 * POST /api/admin/consignments 입력 검증
 * WHY: 위탁 단건 생성 시 필드 검증
 * HOW: Zod 스키마 — sellerId UUID + productName + desiredPrice + productCondition
 * WHERE: consignments/route.ts POST 핸들러
 */
import { z } from 'zod'
import { uuidSchema, priceSchema } from '@/lib/utils/validation'
import { CONSIGNMENT_SOURCES } from '@/lib/types/domain/consignment'

export const CreateConsignmentSchema = z.object({
  sellerId: uuidSchema,
  productName: z.string().min(1, '상품명을 입력해주세요').max(200),
  desiredPrice: priceSchema.max(999_999_999, '가격이 너무 큽니다'),
  productCondition: z.string().min(1, '상태를 입력해주세요').max(50),
  source: z.enum(CONSIGNMENT_SOURCES).optional(),
  memo: z.string().max(500).optional(),
})

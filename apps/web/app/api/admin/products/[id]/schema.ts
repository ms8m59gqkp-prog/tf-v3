/**
 * PATCH /api/admin/products/[id] — 상품 수정 스키마
 * WHY: StProduct 필드 기반 partial 업데이트 검증
 * HOW: 모든 필드 optional, 최소 1개 필수
 * WHERE: [id]/route.ts에서 import
 */
import { z } from 'zod'
import { PRODUCT_TYPES } from '@/lib/types/domain/product'

export const UpdateProductSchema = z.object({
  productName: z.string().min(1).optional(),
  salePrice: z.number().nonnegative().optional(),
  sellerId: z.string().uuid().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  productCondition: z.string().optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  origin: z.string().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: '수정할 필드가 최소 1개 필요합니다',
})

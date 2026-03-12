/**
 * POST /api/admin/products — 상품 등록 스키마
 * WHY: CreateProductInput 기반 입력값 검증
 * HOW: productName + salePrice 필수, 나머지 optional
 * WHERE: products/route.ts에서 import
 */
import { z } from 'zod'

export const CreateProductSchema = z.object({
  productName: z.string().min(1, '상품명은 필수입니다'),
  salePrice: z.number().nonnegative('판매가는 0 이상이어야 합니다'),
  sellerId: z.string().uuid().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  productCondition: z.string().optional(),
  productType: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  origin: z.string().optional(),
})

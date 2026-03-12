/**
 * /api/admin/market-prices — 시세 목록/등록 스키마
 * WHY: brand/category/price 입력값 검증
 * HOW: Zod 스키마 — 등록 시 필수 3필드 + 선택 필드
 * WHERE: market-prices/route.ts에서 import
 */
import { z } from 'zod'

export const CreateMarketPriceSchema = z.object({
  brand: z.string().min(1, '브랜드는 필수입니다'),
  category: z.string().min(1, '카테고리는 필수입니다'),
  price: z.number().positive('가격은 0보다 커야 합니다'),
  size: z.string().optional(),
  condition: z.string().optional(),
  material: z.string().optional(),
  color: z.string().optional(),
  measurements: z.record(z.string(), z.unknown()).optional(),
  source: z.string().optional(),
  sourceUrl: z.string().url('올바른 URL 형식이 아닙니다').optional(),
  sourceDate: z.string().optional(),
  imagePaths: z.array(z.string()).optional(),
  productName: z.string().optional(),
})

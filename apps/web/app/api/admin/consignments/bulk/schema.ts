/**
 * POST /api/admin/consignments/bulk — 위탁 일괄 등록 스키마
 * WHY: Zod 검증으로 엑셀 파싱 결과 배열 타입 안전성 보장
 * HOW: 행 단위 검증, 전화번호/조건/가격 규칙 적용
 * WHERE: bulk/route.ts에서 import
 */
import { z } from 'zod'
import { phoneSchema, priceSchema } from '@/lib/utils/validation'

const ConsignmentRowSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다'),
  phone: phoneSchema,
  productName: z.string().min(1, '상품명은 필수입니다'),
  desiredPrice: priceSchema,
  productCondition: z.enum(['N', 'S', 'A', 'B'], { message: '조건은 N/S/A/B 중 하나입니다' }),
  source: z.string().optional(),
  memo: z.string().optional(),
})

export const BulkConsignmentSchema = z.object({
  rows: z.array(ConsignmentRowSchema).min(1, '최소 1개 행이 필요합니다').max(500, '최대 500행까지 가능합니다'),
})

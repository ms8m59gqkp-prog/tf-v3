/**
 * POST /api/admin/settlements/generate — 정산 생성 스키마
 * WHY: 기간 파라미터 검증 (YYYY-MM-DD 형식 필수)
 * HOW: dateSchema 기반 Zod 검증
 * WHERE: generate/route.ts에서 import
 */
import { z } from 'zod'
import { dateSchema } from '@/lib/utils/validation'

export const GenerateSettlementSchema = z.object({
  periodStart: dateSchema,
  periodEnd: dateSchema,
})

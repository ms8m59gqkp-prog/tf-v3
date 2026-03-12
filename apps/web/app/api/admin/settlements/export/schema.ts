/**
 * POST /api/admin/settlements/export 입력 검증
 * WHY: settlementId UUID 형식 검증
 * HOW: Zod + uuidSchema 재사용
 * WHERE: settlements/export/route.ts POST 핸들러
 */
import { z } from 'zod'
import { uuidSchema } from '@/lib/utils/validation'

export const ExportSettlementSchema = z.object({
  settlementId: uuidSchema,
})

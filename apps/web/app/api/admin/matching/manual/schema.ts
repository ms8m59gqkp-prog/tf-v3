/**
 * POST /api/admin/matching/manual — 수동 매칭 스키마
 * WHY: salesRecordId + naverSettlementId 필수 검증
 * HOW: UUID 쌍 + optional 사유
 * WHERE: manual/route.ts에서 import
 */
import { z } from 'zod'

export const ManualMatchSchema = z.object({
  salesRecordId: z.string().uuid('유효한 매출 레코드 ID가 아닙니다'),
  naverSettlementId: z.string().uuid('유효한 네이버 정산 ID가 아닙니다'),
  reason: z.string().optional(),
})

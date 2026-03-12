/**
 * POST /api/admin/settlements/[id]/pay — 지급 처리 스키마
 * WHY: paidBy 필수 + transferRef 선택적 검증
 * HOW: 지급자 ID + 이체참조번호
 * WHERE: pay/route.ts에서 import
 */
import { z } from 'zod'

export const PaySettlementSchema = z.object({
  paidBy: z.string().min(1, '지급자 정보는 필수입니다'),
  transferRef: z.string().optional(),
})

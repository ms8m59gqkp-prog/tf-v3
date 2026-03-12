/**
 * PATCH /api/admin/consignments/[id] — 위탁 상태 변경 스키마
 * WHY: 상태 전이 입력값 검증 + 부가 정보 타입 안전성
 * HOW: ConsignmentStatus enum + optional 부가 필드
 * WHERE: [id]/route.ts에서 import
 */
import { z } from 'zod'
import { CONSIGNMENT_STATUSES } from '@/lib/types/domain/consignment'

export const UpdateConsignmentSchema = z.object({
  status: z.enum(CONSIGNMENT_STATUSES, { message: '유효한 상태값이 아닙니다' }),
  memo: z.string().optional(),
  inspectionImage: z.string().optional(),
  adjustmentPrice: z.number().nonnegative().optional(),
  adjustmentToken: z.string().optional(),
  receivedAt: z.string().optional(),
  inspectedAt: z.string().optional(),
})

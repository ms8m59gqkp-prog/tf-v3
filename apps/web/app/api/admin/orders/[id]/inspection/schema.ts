/**
 * PATCH /api/admin/orders/[id]/inspection 입력 검증
 * WHY: 검수 필드만 화이트리스트 허용 (시스템 컬럼 수정 차단)
 * HOW: Zod — itemId UUID + inspectionStatus enum + hold 관련 optional
 * WHERE: orders/[id]/inspection/route.ts
 */
import { z } from 'zod'
import { uuidSchema } from '@/lib/utils/validation'
import { INSPECTION_STATUSES } from '@/lib/types/domain/order'

export const UpdateInspectionSchema = z.object({
  itemId: uuidSchema,
  inspectionStatus: z.enum(INSPECTION_STATUSES).optional(),
  holdAdjustedPrice: z.number().int().nonnegative().max(999_999_999, '가격이 너무 큽니다').optional(),
  holdReason: z.string().max(500).optional(),
  holdPhotoUrl: z.string().url().max(2048).optional(),
  holdDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
}).refine(
  (d) => d.inspectionStatus !== undefined || d.holdAdjustedPrice !== undefined
    || d.holdReason !== undefined || d.holdPhotoUrl !== undefined || d.holdDate !== undefined,
  '수정할 필드를 1개 이상 입력해주세요',
)

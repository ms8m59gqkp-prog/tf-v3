/**
 * PATCH /api/admin/orders/[id]/measurement 입력 검증
 * WHY: 치수 필드만 화이트리스트 허용
 * HOW: Zod — itemId UUID + measurements JSON + size string
 * WHERE: orders/[id]/measurement/route.ts
 */
import { z } from 'zod'
import { uuidSchema } from '@/lib/utils/validation'

export const UpdateMeasurementSchema = z.object({
  itemId: uuidSchema,
  measurements: z.record(z.string(), z.unknown())
    .refine((obj) => JSON.stringify(obj).length <= 10000, 'measurements 데이터가 너무 큽니다 (10KB 이하)')
    .optional(),
  size: z.string().max(50).optional(),
}).refine(
  (d) => d.measurements !== undefined || d.size !== undefined,
  '수정할 필드를 1개 이상 입력해주세요',
)

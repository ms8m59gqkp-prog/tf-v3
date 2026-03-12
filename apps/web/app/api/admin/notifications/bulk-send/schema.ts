/**
 * POST /api/admin/notifications/bulk-send 입력 검증
 * WHY: 대량 SMS 발송 시 배열 상한 + 전화번호 형식 검증
 * HOW: Zod — phones 배열(max 50) + message 필수
 * WHERE: notifications/bulk-send/route.ts
 */
import { z } from 'zod'
import { phoneSchema, uuidSchema } from '@/lib/utils/validation'

export const BulkSendSchema = z.object({
  phones: z.array(phoneSchema).min(1, '발송 대상을 입력해주세요').max(50, '한 번에 최대 50건까지 발송 가능합니다'),
  message: z.string().min(1, '메시지를 입력해주세요').max(2000),
  sellerId: uuidSchema.optional(),
})

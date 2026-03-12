/**
 * 주문 보류 고객 응답 스키마
 * WHY: 고객 동의/거절 요청 검증
 * HOW: Zod — token + itemId + agreed boolean
 * WHERE: /api/orders/[productId]/hold POST
 */
import { z } from 'zod'
import { tokenSchema, uuidSchema } from '@/lib/utils/validation'

export const HoldResponseSchema = z.object({
  token: tokenSchema,
  itemId: uuidSchema,
  agreed: z.boolean(),
})

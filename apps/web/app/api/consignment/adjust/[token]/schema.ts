/**
 * 위탁 가격 조정 응답 스키마
 * WHY: 셀러 응답 (수락/역제안/거절) 요청 검증
 * HOW: Zod refine — counter 시 counterPrice 필수
 * WHERE: /api/consignment/adjust/[token] POST
 */
import { z } from 'zod'
import { SELLER_RESPONSES } from '@/lib/types/domain/consignment'
import { priceSchema } from '@/lib/utils/validation'

export const AdjustResponseSchema = z.object({
  response: z.enum(SELLER_RESPONSES),
  counterPrice: priceSchema.max(999_999_999).optional(),
}).refine(
  (data) => data.response !== 'counter' || data.counterPrice !== undefined,
  { message: '역제안 시 희망 가격을 입력해주세요', path: ['counterPrice'] },
)

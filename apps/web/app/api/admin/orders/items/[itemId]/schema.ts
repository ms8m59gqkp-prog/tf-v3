/**
 * PATCH /api/admin/orders/items/[itemId] — 주문 아이템 수정 스키마
 * WHY: 검수 결과 반영, 가격 조정 등 아이템 단위 수정
 * HOW: OrderItem 필드 기반 partial Zod 스키마
 * WHERE: [itemId]/route.ts에서 import
 */
import { z } from 'zod'
import { INSPECTION_STATUSES } from '@/lib/types/domain/order'

export const UpdateOrderItemSchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  category: z.string().optional(),
  condition: z.string().optional(),
  estimatedPrice: z.number().nonnegative().optional(),
  finalPrice: z.number().nonnegative().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  inspectionStatus: z.enum(INSPECTION_STATUSES).optional(),
  inspectionNote: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: '수정할 필드가 최소 1개 필요합니다',
})

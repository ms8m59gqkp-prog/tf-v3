/**
 * PATCH /api/admin/orders/[id] — 주문 상태 변경 스키마
 * WHY: ORDER_TRANSITIONS 기반 상태 전이 입력값 검증
 * HOW: OrderStatus enum 기반 Zod 검증
 * WHERE: [id]/route.ts에서 import
 */
import { z } from 'zod'
import { ORDER_STATUSES } from '@/lib/types/domain/order'

export const UpdateOrderSchema = z.object({
  status: z.enum(ORDER_STATUSES, { message: '유효한 주문 상태값이 아닙니다' }),
})

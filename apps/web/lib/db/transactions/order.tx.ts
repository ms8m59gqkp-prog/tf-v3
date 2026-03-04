/**
 * 주문 생성 트랜잭션 — RPC 래퍼
 * WHY: order + order_items 원자적 생성
 * HOW: create_order_with_items RPC 호출
 * WHERE: order 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'

interface OrderItemInput {
  product_number: string
  brand: string
  model?: string
  category?: string
  condition?: string
  size?: string
  measurements?: Record<string, number>
}

interface CreateOrderInput {
  orderNumber: string
  customerName: string
  customerPhone: string
  status: string
  items: OrderItemInput[]
}

export async function createOrderWithItems(input: CreateOrderInput): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('create_order_with_items', {
    p_order_number: input.orderNumber,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_status: input.status,
    p_items: input.items,
  })
  if (error) throw new Error(`[order.tx] 주문 생성 실패: ${error.message}`)
  return data as string
}

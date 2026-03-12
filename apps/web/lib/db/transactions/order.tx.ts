/**
 * 주문+아이템 원자적 생성 트랜잭션 래퍼
 * WHY: V2 순차 INSERT+수동 롤백 제거 → RPC 1회 호출로 원자적 처리
 * HOW: generate_order_number RPC → create_order_with_items RPC
 * WHERE: 주문 생성 API (Phase 3 Service에서 호출)
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbResult } from '../types'

interface OrderItemInput {
  product_number: string
  brand: string
  model: string
  category?: string
  condition?: string
  size?: string
  measurements?: Record<string, unknown>
  inspection_status?: string
  customer_agreed?: boolean
}

interface CreateOrderParams {
  customerName: string
  customerPhone: string
  status: string
  items: OrderItemInput[]
}

export async function createOrderWithItems(
  params: CreateOrderParams,
): Promise<DbResult<{ orderId: string }>> {
  const client = createAdminClient()

  // Step 1: 주문번호 사전 생성 (YYYYMMDD-NNNNNN)
  const { data: orderNumber, error: numError } = await client.rpc(
    'generate_order_number' as never,
  )
  if (numError) return { data: null, error: numError.message }

  // Step 2: 원자적 주문+아이템 생성 (p_items: jsonb, JSON.stringify 금지)
  const { data, error } = await client.rpc(
    'create_order_with_items' as never,
    {
      p_order_number: orderNumber as string,
      p_customer_name: params.customerName,
      p_customer_phone: params.customerPhone,
      p_status: params.status,
      p_items: params.items,
    } as never,
  )

  if (error) {
    if (error.code === 'P0001') {
      return { data: null, error: error.message }
    }
    if (error.code === '23505') {
      return { data: null, error: '중복 데이터 (주문번호 충돌)' }
    }
    return { data: null, error: error.message }
  }

  return { data: { orderId: data as string }, error: null }
}

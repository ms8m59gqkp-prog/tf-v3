/**
 * 위탁 완료 트랜잭션 래퍼
 * WHY: complete_consignment RPC 1회 호출로 상품 생성+주문 생성+상태 전이 원자 처리
 * HOW: generate_product_number → complete_consignment 2단계 RPC
 * WHERE: 위탁 검수 완료 시 호출 (approved → completed)
 */
import { createAdminClient } from '../../supabase/admin'
import type { DbResult } from '../types'

interface CompleteConsignmentParams {
  consignmentId: string
  sellerId: string
  productName?: string
  salePrice?: number
  brand?: string
  category?: string
  condition?: string
  size?: string
  color?: string
  measurements?: Record<string, unknown>
  orderNumber?: string
  customerName?: string
  customerPhone?: string
}

export async function completeConsignment(
  params: CompleteConsignmentParams
): Promise<DbResult<{ productId: string; orderId?: string }>> {
  const client = createAdminClient()

  // Step 1: 13자리 상품번호 생성
  const { data: productNumber, error: genError } = await client.rpc(
    'generate_product_number' as never,
    { p_seller_id: params.sellerId } as never,
  )
  if (genError) return { data: null, error: genError.message }

  // Step 2: 위탁 완료 RPC (14 파라미터)
  const { data, error } = await client.rpc(
    'complete_consignment' as never,
    {
      p_consignment_id: params.consignmentId,
      p_product_number: productNumber as string,
      p_product_name: params.productName ?? null,
      p_sale_price: params.salePrice ?? 0,
      p_seller_id: params.sellerId,
      p_brand: params.brand ?? null,
      p_category: params.category ?? null,
      p_condition: params.condition ?? null,
      p_size: params.size ?? null,
      p_color: params.color ?? null,
      p_measurements: params.measurements ?? null,
      p_order_number: params.orderNumber ?? null,
      p_customer_name: params.customerName ?? null,
      p_customer_phone: params.customerPhone ?? null,
    } as never,
  )

  if (error) {
    if (error.code === 'P0001') return { data: null, error: error.message }
    if (error.code === '23505') return { data: null, error: '상품번호가 이미 존재합니다' }
    return { data: null, error: error.message }
  }

  // RPC RETURNS uuid (product_id only) — orderId는 RPC 내부 생성이므로 미반환
  const productId = data as string
  return { data: { productId }, error: null }
}

/**
 * 위탁 완료 트랜잭션 — RPC 래퍼
 * WHY: 위탁 상태검증 + 상품등록 + 주문생성 원자적 처리
 * HOW: complete_consignment RPC 호출
 * WHERE: consignment 서비스에서 참조
 */

import { createAdminClient } from '@/lib/db/client'

interface CompleteConsignmentInput {
  consignmentId: string
  productNumber: string
  brand?: string
  category?: string
  condition?: string
  size?: string
  color?: string
  measurements?: Record<string, number>
  orderNumber?: string
  customerName?: string
  customerPhone?: string
}

export async function completeConsignment(input: CompleteConsignmentInput): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('complete_consignment', {
    p_consignment_id: input.consignmentId,
    p_product_number: input.productNumber,
    p_brand: input.brand ?? null,
    p_category: input.category ?? null,
    p_condition: input.condition ?? null,
    p_size: input.size ?? null,
    p_color: input.color ?? null,
    p_measurements: input.measurements ?? null,
    p_order_number: input.orderNumber ?? null,
    p_customer_name: input.customerName ?? null,
    p_customer_phone: input.customerPhone ?? null,
  })
  if (error) throw new Error(`[consignment.tx] 위탁 완료 실패: ${error.message}`)
  return data as string
}

/**
 * 주문 보류 토큰 기반 조회/응답 리포지토리
 * WHY: 고객 공개 페이지에서 hold_token(orders 테이블)으로 보류 아이템 조회 + 동의 저장
 * HOW: orders.hold_token JOIN order_items → customer_agreed/agreed_at UPDATE
 * WHERE: order-hold.service.ts에서 호출
 */
import { createAdminClient } from '../../supabase/admin'
import type { OrderItem } from '../../types/domain/order'
import type { DbResult } from '../types'
import {
  ORDER_ITEM_COLUMNS, mapOrderItemRow,
  ORDER_COLUMNS, mapOrderRow,
} from './orders.repo'
import type { Order } from '../../types/domain/order'

/** 보류 주문 + 아이템 뷰 */
export interface HoldOrderView {
  order: Order
  items: OrderItem[]
}

/** hold_token 기반으로 주문 + 보류 아이템 조회 (만료 체크 포함) */
export async function findByHoldToken(
  token: string,
): Promise<DbResult<HoldOrderView>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(${ORDER_ITEM_COLUMNS})`)
    .eq('hold_token', token)
    .maybeSingle()
  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'NOT_FOUND: 유효하지 않은 토큰입니다' }
  const row = data as unknown as Record<string, unknown>
  /* expires_at NULL = 만료 미설정(영구 유효). .or() 금지(§5.2)로 JS 체크 */
  const expiresAt = row.hold_token_expires_at as string | null
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return { data: null, error: 'NOT_FOUND: 유효하지 않은 토큰입니다' }
  }
  const order = mapOrderRow(row)
  const rawItems = (row.order_items as unknown as Record<string, unknown>[]) ?? []
  const items = rawItems.map(mapOrderItemRow)

  return { data: { order, items }, error: null }
}

/** 고객 동의 응답 업데이트 (order_items) */
export async function updateCustomerResponse(
  itemId: string,
  agreed: boolean,
): Promise<DbResult<OrderItem>> {
  const client = createAdminClient()
  const { data, error } = await client
    .from('order_items')
    .update({
      customer_agreed: agreed,
      customer_agreed_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .is('customer_agreed_at', null)
    .select(ORDER_ITEM_COLUMNS)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: mapOrderItemRow(data as Record<string, unknown>), error: null }
}

/**
 * 주문 도메인 타입 — 8값 상태 + 전환 맵
 * WHY: V2 상태 전이 검증 없음 → 잘못된 전이 가능
 * HOW: ALLOWED_TRANSITIONS 맵으로 허용 전이만 정의
 * WHERE: 주문 서비스, 라우트에서 상태 전이 검증
 */

export const ORDER_STATUSES = [
  'RECEIVED',
  'IMAGE_COMPLETE',
  'HOLD_REQUEST',
  'CHECKING_ITEMS',
  'SHIPPING',
  'DELIVERED',
  'CONFIRMED',
  'CANCELLED',
] as const

export type OrderStatus = typeof ORDER_STATUSES[number]

export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  RECEIVED: ['IMAGE_COMPLETE', 'CANCELLED'],
  IMAGE_COMPLETE: ['HOLD_REQUEST', 'CHECKING_ITEMS', 'CANCELLED'],
  HOLD_REQUEST: ['CHECKING_ITEMS', 'CANCELLED'],
  CHECKING_ITEMS: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED'],
  DELIVERED: ['CONFIRMED'],
  CONFIRMED: [],
  CANCELLED: [],
}

export type Condition = 'S' | 'A' | 'B' | 'C' | 'D'

export const CONDITION_LABELS: Record<Condition, string> = {
  S: '미사용급',
  A: '최상',
  B: '상',
  C: '중',
  D: '하',
}

export interface OrderItem {
  id: string
  orderId: string
  productNumber: string
  brand: string
  model: string
  category?: string
  condition?: string
  size?: string
  measurements?: Record<string, number>
  inspectionStatus: string
  customerAgreed: boolean
}

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  phone: string
  address?: string
  postalCode?: string
  status: OrderStatus
  holdToken?: string
  boxQty?: number
  totalEstimated?: number
  commission?: number
  finalPayout?: number
  sellerType?: string
  purchaseSource?: string
  createdAt: string
  updatedAt: string
}

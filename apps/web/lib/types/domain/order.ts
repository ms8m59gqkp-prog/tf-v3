/**
 * 주문 도메인 타입 — V2 10값 상태 + V2 워크플로우 전환 맵
 * WHY: V2 상태 전이 검증 없음 → 잘못된 전이 가능
 * HOW: ALLOWED_TRANSITIONS 맵으로 허용 전이만 정의 (V2 워크플로우 기반 + CONFIRMED/CANCELLED 추가)
 * WHERE: 주문 서비스, 라우트에서 상태 전이 검증
 */

export const ORDER_STATUSES = [
  'APPLIED',
  'SHIPPING',
  'COLLECTED',
  'INSPECTED',
  'PRICE_ADJUSTING',
  'RE_INSPECTED',
  'IMAGE_PREPARING',
  'IMAGE_COMPLETE',
  'CONFIRMED',
  'CANCELLED',
] as const

export type OrderStatus = typeof ORDER_STATUSES[number]

export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  APPLIED:         ['SHIPPING', 'CANCELLED'],
  SHIPPING:        ['COLLECTED', 'CANCELLED'],
  COLLECTED:       ['INSPECTED', 'CANCELLED'],
  INSPECTED:       ['PRICE_ADJUSTING', 'IMAGE_PREPARING', 'CANCELLED'],
  PRICE_ADJUSTING: ['RE_INSPECTED', 'CANCELLED'],
  RE_INSPECTED:    ['IMAGE_PREPARING', 'CANCELLED'],
  IMAGE_PREPARING: ['IMAGE_COMPLETE', 'CANCELLED'],
  IMAGE_COMPLETE:  ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:       [],
  CANCELLED:       [],
}

export type Condition = 'N' | 'S' | 'A' | 'B'

export const CONDITION_LABELS: Record<Condition, string> = {
  N: 'NEW',
  S: '민트급',
  A: '사용감 적음',
  B: '사용감 있음',
}

const CONDITION_RATIOS: Record<Condition, number> = { N: 1, S: 0.85, A: 0.7, B: 0.5 }

/**
 * 원가 기준으로 등급별 예상 판매가를 계산한다.
 * V2 검증 완료 로직 계승. 1000원 단위 반올림.
 */
export function derivePrices(originalPrice: number): Record<Condition, number> {
  const round = (v: number) => Math.round(v / 1000) * 1000
  return {
    N: originalPrice,
    S: round(originalPrice * 0.85),
    A: round(originalPrice * 0.70),
    B: round(originalPrice * 0.50),
  }
}

/**
 * 예상 판매가 + 등급으로 역산해 원가를 추정한다.
 * 1000원 단위 반올림.
 */
export function deriveOriginalPrice(estimatedPrice: number, condition: Condition): number {
  return Math.round((estimatedPrice / (CONDITION_RATIOS[condition] ?? 0.7)) / 1000) * 1000
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

/**
 * 주문 도메인 타입
 * WHY: V2 orders + order_items 테이블과 1:1 대응
 * HOW: 인터페이스 + CHECK 상수 + Condition 라벨
 * WHERE: 주문/검수 관련 모든 코드에서 import
 */

// V2 리팩토링 8값 + V3 확장 2값 = 10값 (신청관리 전용)
export const ORDER_STATUSES = [
  'APPLIED', 'SHIPPING', 'COLLECTED', 'INSPECTED',
  'PRICE_ADJUSTING', 'RE_INSPECTED', 'IMAGE_PREPARING', 'IMAGE_COMPLETE',
  'CONFIRMED', 'CANCELLED',
] as const satisfies readonly string[]
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const INSPECTION_STATUSES = ['pending', 'completed', 'hold'] as const satisfies readonly string[]
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number]

export const CONDITION_LABELS: Record<string, string> = {
  N: 'NEW',
  S: 'S급',
  A: 'A급',
  B: 'B급',
} as const

// V2 워크플로우 기반 주문 상태 전이
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
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
} as const

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  phone: string
  address?: string | null
  postalCode?: string | null
  visitDate?: string | null
  arrivalDate?: string | null
  boxQty?: number | null
  totalEstimated?: number | null
  commission?: number | null
  finalPayout?: number | null
  status?: OrderStatus | null
  createdAt?: string | null
  updatedAt?: string | null
  sellerType: string
  purchaseSource?: string | null
  customCommissionRate?: number | null
  holdToken?: string | null
}

export interface OrderItem {
  id: string
  orderId: string
  productNumber: string
  brand: string
  model: string
  category?: string | null
  condition?: string | null
  estimatedPrice?: number | null
  finalPrice?: number | null
  status?: string | null
  imageUrl?: string | null
  createdAt?: string | null
  customerPrice?: number | null
  size?: string | null
  inspectionStatus: InspectionStatus
  itemType?: string | null
  measurements?: Record<string, unknown> | null
  holdAdjustedPrice?: number | null
  holdReason?: string | null
  holdPhotoUrl?: string | null
  holdDate?: string | null
  customerAgreed: boolean
  customerAgreedAt?: string | null
}

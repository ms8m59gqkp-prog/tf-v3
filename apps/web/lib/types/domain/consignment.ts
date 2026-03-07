/**
 * 위탁 요청 도메인 타입
 * WHY: V2 consignment_requests 테이블과 1:1 대응
 * HOW: 인터페이스 + CHECK 상수 + 상태 전이 맵
 * WHERE: 위탁 관련 모든 코드에서 import
 */

export const CONSIGNMENT_STATUSES = ['pending', 'received', 'inspecting', 'on_hold', 'approved', 'rejected', 'completed'] as const satisfies readonly string[]
export type ConsignmentStatus = (typeof CONSIGNMENT_STATUSES)[number]

export const CONSIGNMENT_SOURCES = ['naver_form', 'employee', 'manual', 'direct'] as const satisfies readonly string[]
export type ConsignmentSource = (typeof CONSIGNMENT_SOURCES)[number]

export const SELLER_RESPONSES = ['accepted', 'counter', 'cancelled'] as const satisfies readonly string[]
export type SellerResponse = (typeof SELLER_RESPONSES)[number]

// V2 워크플로우 기반 상태 전이 (옵션 C)
export const ALLOWED_TRANSITIONS: Record<ConsignmentStatus, readonly ConsignmentStatus[]> = {
  pending: ['received', 'rejected'],
  received: ['inspecting'],
  inspecting: ['approved', 'on_hold', 'rejected'],
  on_hold: ['inspecting', 'rejected'],
  approved: ['completed'],
  rejected: [],
  completed: [],
} as const

export interface ConsignmentRequest {
  id: string
  sellerId: string
  productName: string
  desiredPrice: number
  productCondition: string
  status?: ConsignmentStatus | null
  approvedAt?: string | null
  productId?: string | null
  source?: ConsignmentSource | null
  memo?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  imageUrl?: string | null
  appliedAt?: string | null
  employeePurchaseDate?: string | null
  privacyConsent?: string | null
  productNumber?: string | null
  receivedAt?: string | null
  inspectedAt?: string | null
  measurements?: Record<string, unknown> | null
  itemType?: string | null
  inspectionImage?: string | null
  adjustmentToken?: string | null
  adjustmentPrice?: number | null
  sellerResponse?: SellerResponse | null
  sellerCounterPrice?: number | null
  origin?: string | null
  composition?: string | null
}

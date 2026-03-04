/**
 * 위탁 도메인 타입 — 7값 상태 + 전환 맵
 * WHY: V2 TypeScript 3값 vs DB CHECK 7값 불일치 해소 (Phase 0에서 통일)
 * HOW: CONSIGNMENT_STATUSES 배열 + CONSIGNMENT_TRANSITIONS 맵
 * WHERE: 위탁 서비스, 상태 전이 검증
 */

export const CONSIGNMENT_STATUSES = [
  'pending',
  'received',
  'inspecting',
  'approved',
  'on_hold',
  'rejected',
  'completed',
] as const

export type ConsignmentStatus = typeof CONSIGNMENT_STATUSES[number]

export const CONSIGNMENT_TRANSITIONS: Record<ConsignmentStatus, readonly ConsignmentStatus[]> = {
  pending: ['received', 'rejected'],
  received: ['inspecting', 'rejected'],
  inspecting: ['approved', 'on_hold', 'rejected'],
  approved: ['completed'],
  on_hold: ['inspecting', 'rejected'],
  rejected: [],
  completed: [],
}

export interface ConsignmentRequest {
  id: string
  sellerId: string
  sellerName: string
  status: ConsignmentStatus
  productName?: string
  brand?: string
  category?: string
  adjustmentToken?: string
  createdAt: string
  updatedAt: string
}

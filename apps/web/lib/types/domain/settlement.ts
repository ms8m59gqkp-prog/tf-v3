/**
 * 정산 도메인 타입 — V3 통합 파이프라인
 * WHY: V2 이중 파이프라인(A/B) → V3 단일 통합
 * HOW: SettlementStatus + Settlement + SoldItem 인터페이스
 * WHERE: 정산 서비스, RPC 래퍼에서 참조
 */

export const SETTLEMENT_STATUSES = ['pending', 'confirmed', 'paid'] as const
export type SettlementStatus = typeof SETTLEMENT_STATUSES[number]

export const SOLD_ITEM_STATUSES = ['pending', 'settled'] as const
export type SoldItemSettlementStatus = typeof SOLD_ITEM_STATUSES[number]

export interface Settlement {
  id: string
  sellerId: string
  sellerName: string
  sellerType: string
  commissionRate: number
  totalSales: number
  totalCommission: number
  totalPayout: number
  status: SettlementStatus
  confirmedAt?: string
  paidAt?: string
  createdAt: string
  updatedAt: string
}

export interface SoldItem {
  id: string
  orderId: string
  productNumber: string
  brand: string
  model: string
  soldPrice: number
  commission: number
  payout: number
  settlementStatus: SoldItemSettlementStatus
  settlementId?: string
  soldAt: string
  createdAt: string
  updatedAt: string
}

export interface SettlementItem {
  id: string
  settlementId: string
  soldItemId: string
  productNumber: string
  brand: string
  model: string
  soldPrice: number
  commission: number
  payout: number
  createdAt: string
}

export interface SettlementQueue {
  id: string
  settlementId: string
  sellerId: string
  status: SettlementStatus
  scheduledAt: string
  processedAt?: string
  errorMessage?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface SalesRecord {
  id: string
  productNumber: string
  brand: string
  model: string
  category?: string
  condition?: string
  soldPrice: number
  originalPrice?: number
  sellerId: string
  sellerName: string
  buyerName?: string
  soldAt: string
  channel?: string
  createdAt: string
}

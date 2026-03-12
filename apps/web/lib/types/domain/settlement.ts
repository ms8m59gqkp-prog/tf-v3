/**
 * 정산 도메인 타입
 * WHY: V2 정산 관련 5개 테이블과 1:1 대응
 * HOW: settlements + settlement_items(3필드) + sold_items + sales_records + naver_settlements
 * WHERE: 정산 관련 모든 코드에서 import
 */

export const SETTLEMENT_STATUSES = ['draft', 'confirmed', 'paid', 'failed'] as const satisfies readonly string[]
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

export const SOLD_ITEM_STATUSES = ['pending', 'calculated', 'settled', 'returned'] as const satisfies readonly string[]
export type SoldItemStatus = (typeof SOLD_ITEM_STATUSES)[number]

export const SALES_CHANNELS = ['smart_store', 'self_mall'] as const satisfies readonly string[]
export type SalesChannel = (typeof SALES_CHANNELS)[number]

export const MATCH_STATUSES = ['unmatched', 'auto_matched', 'manual_matched'] as const satisfies readonly string[]
export type MatchStatus = (typeof MATCH_STATUSES)[number]

export interface Settlement {
  id: string
  sellerId: string
  settlementPeriodStart: string
  settlementPeriodEnd: string
  totalSales: number
  commissionRate: number
  commissionAmount: number
  returnDeduction: number
  settlementAmount: number
  itemCount: number
  status?: SettlementStatus | null
  paidAt?: string | null
  paidBy?: string | null
  transferReference?: string | null
  createdAt?: string | null
  confirmedAt?: string | null
  failReason?: string | null
}

// V2 settlement_items: 순수 join 테이블 (3컬럼)
export interface SettlementItem {
  id: string
  settlementId: string
  soldItemId: string
}

// JOIN 결과용 확장 (Phase 4 서비스에서 사용)
export interface SettlementItemDetail extends SettlementItem {
  productName: string
  productNumber?: string | null
  salePrice: number
  soldAt: string
}

// V2 sold_items 20컬럼 — brand, model, commission, payout 없음
export interface SoldItem {
  id: string
  sellerId: string
  channel?: SalesChannel | null
  orderId: string
  productName: string
  productNumber?: string | null
  quantity: number
  salePrice: number
  shippingFee?: number | null
  soldAt: string
  purchaseConfirmed?: boolean | null
  purchaseConfirmedAt?: string | null
  settlementStatus?: SoldItemStatus | null
  settlementId?: string | null
  returnProcessed?: boolean | null
  sourceFile?: string | null
  createdAt?: string | null
  productOrderId?: string | null
  naverProductId?: string | null
  productCode?: string | null
}

// V2 sales_records 19컬럼
export interface SalesRecord {
  id: string
  saleDate: string
  buyerName?: string | null
  naverOrderNo?: string | null
  brand?: string | null
  productName?: string | null
  productCode?: string | null
  productNumber?: string | null
  originalPrice?: number | null
  discountRate?: number | null
  saleAmount?: number | null
  quantity?: number | null
  finalAmount?: number | null
  isConsignment?: boolean | null
  consignmentSeller?: string | null
  matchStatus?: MatchStatus | null
  uploadBatch?: string | null
  createdAt?: string | null
  uploadSessionId?: string | null
}

// V2 naver_settlements 13컬럼
export interface NaverSettlement {
  id: string
  orderNo?: string | null
  productOrderNo?: string | null
  category?: string | null
  productName?: string | null
  buyerName?: string | null
  settleBaseDate?: string | null
  settleScheduledDate?: string | null
  settleAmount?: number | null
  settleStatus?: string | null
  matchStatus?: MatchStatus | null
  uploadBatch?: string | null
  createdAt?: string | null
}

// 정산 상태 전이 (§1.4 — 서비스 1차 검증 + repo 2차 optimistic lock)
export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, readonly SettlementStatus[]> = {
  draft:     ['confirmed', 'failed'],
  confirmed: ['paid', 'failed'],
  paid:      [],
  failed:    [],
} as const

// V2 settlement_matches 8컬럼
export interface SettlementMatch {
  id: string
  salesRecordId?: string | null
  naverSettlementId?: string | null
  matchType: string
  matchScore?: number | null
  matchReason?: string | null
  matchedBy?: string | null
  matchedAt?: string | null
}

// V2 settlement_queue 14컬럼
export interface SettlementQueueItem {
  id: string
  matchId?: string | null
  sellerId?: string | null
  sellerName: string
  productName?: string | null
  productNumber?: string | null
  saleAmount?: number | null
  commissionRate?: number | null
  commissionAmount?: number | null
  payoutAmount?: number | null
  settleBaseDate?: string | null
  queueStatus?: string | null
  settlementId?: string | null
  createdAt?: string | null
}

// 셀러별 정산 큐 집계 (getSellerSummary용)
export interface SellerSettlementSummary {
  sellerId: string
  sellerName: string
  totalItems: number
  totalSaleAmount: number
  totalCommission: number
  totalPayout: number
}

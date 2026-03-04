/**
 * 판매자 도메인 타입 — 커미션 요율 유일한 소스
 * WHY: V2에서 커미션 5곳 분산 정의 → 과징수 가능
 * HOW: COMMISSION_RATES를 이 파일에서만 export
 * WHERE: settlement 계산, 판매자 생성 시 참조
 */

export type SellerTier = 'general' | 'employee' | 'vip'

export const COMMISSION_RATES = {
  general: 0.25,
  employee: 0.20,
  vip: 0.20,
} as const satisfies Record<SellerTier, number>

export interface Seller {
  id: string
  sellerName: string
  phone: string
  sellerCode: string
  sellerType: SellerTier
  commissionRate: number
  bankName?: string
  bankAccount?: string
  createdAt: string
  updatedAt: string
}

/**
 * 판매자 도메인 타입
 * WHY: V2 sellers 테이블과 1:1 대응
 * HOW: 인터페이스 + CHECK 상수 정의
 * WHERE: 판매자 관련 모든 코드에서 import
 */

export const SELLER_STATUSES = ['pending', 'active', 'inactive', 'suspended', 'expired'] as const satisfies readonly string[]
export type SellerStatus = (typeof SELLER_STATUSES)[number]

export const SELLER_TIERS = ['general', 'employee', 'vip'] as const satisfies readonly string[]
export type SellerTier = (typeof SELLER_TIERS)[number]

export const CHANNEL_TYPES = ['half_size', 'full_size', 'both'] as const satisfies readonly string[]
export type ChannelType = (typeof CHANNEL_TYPES)[number]

// V2 get_commission_rate() 정확 재현 — 단일 소스
export const COMMISSION_RATES: Record<SellerTier, number> = {
  general: 0.25,
  employee: 0.20,
  vip: 0.20,
} as const

export function getCommissionRate(seller: { commissionRate?: number | null; sellerTier: SellerTier }): number {
  if (seller.commissionRate != null && seller.commissionRate > 0) {
    return seller.commissionRate
  }
  return COMMISSION_RATES[seller.sellerTier] ?? 0.25
}

export interface Seller {
  id: string
  sellerCode: string
  name: string
  phone: string
  email?: string | null
  idCardNumber?: string | null
  idCardVerified?: boolean | null
  idCardFileUrl?: string | null
  bankName?: string | null
  bankAccount?: string | null
  bankHolder?: string | null
  bankVerified?: boolean | null
  commissionRate?: number | null
  contractStart?: string | null
  contractEnd?: string | null
  channelType?: ChannelType | null
  status?: SellerStatus | null
  createdAt?: string | null
  updatedAt?: string | null
  sellerTier?: SellerTier | null
  taggingCode?: string | null
  nickname?: string | null
  marketingConsent?: boolean | null
  marketingConsentAt?: string | null
  address?: string | null
}

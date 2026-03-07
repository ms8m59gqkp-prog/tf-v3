/**
 * 상품 도메인 타입
 * WHY: V2 st_products 테이블과 1:1 대응
 * HOW: 인터페이스 + CHECK 상수
 * WHERE: 상품 관련 모든 코드에서 import
 */

export const PRODUCT_TYPES = ['consignment', 'inventory'] as const satisfies readonly string[]
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const PHOTO_STATUSES = ['pending', 'shooting', 'editing', 'completed'] as const satisfies readonly string[]
export type PhotoStatus = (typeof PHOTO_STATUSES)[number]

export const SMARTSTORE_STATUSES = ['draft', 'ready', 'uploaded', 'selling'] as const satisfies readonly string[]
export type SmartstoreStatus = (typeof SMARTSTORE_STATUSES)[number]

export const RETAIL_PRICE_SOURCES = ['naver_estimate', 'manual', 'desired_price'] as const satisfies readonly string[]
export type RetailPriceSource = (typeof RETAIL_PRICE_SOURCES)[number]

export interface StProduct {
  id: string
  productNumber?: string | null
  legacyCode?: string | null
  productName: string
  sellerId?: string | null
  salePrice: number
  productType?: ProductType | null
  isActive?: boolean | null
  smartStoreRegistered?: boolean | null
  consignmentDate?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  brand?: string | null
  size?: string | null
  origin?: string | null
  material?: string | null
  measurements?: Record<string, unknown> | null
  naverProductId?: string | null
  sellerPayment?: number | null
  productCondition?: string | null
  unsellableReason?: string | null
  soldAt?: string | null
  soldAmount?: number | null
  salesRecordId?: string | null
  buyerName?: string | null
  referenceImage?: string | null
  photos?: unknown[] | null
  photoStatus?: PhotoStatus | null
  smartstoreStatus?: SmartstoreStatus | null
  smartstoreData?: Record<string, unknown> | null
  composition?: string | null
  category?: string | null
  retailPrice?: number | null
  retailPriceSource?: RetailPriceSource | null
  retailPriceConfidence?: number | null
  color?: string | null
}

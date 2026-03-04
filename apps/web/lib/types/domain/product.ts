/**
 * 상품(st_products) 도메인 타입
 * WHY: 상품 정보 중앙 타입 정의
 * HOW: StProduct 인터페이스 + MEASUREMENT_FIELDS 상수
 * WHERE: 상품 리포지토리, 서비스에서 참조
 */

export const MEASUREMENT_FIELDS = [
  'shoulder', 'chest', 'sleeve', 'length',
  'waist', 'hip', 'inseam', 'rise',
] as const

export type MeasurementField = typeof MEASUREMENT_FIELDS[number]

export interface StProduct {
  id: string
  productNumber: string
  brand: string
  model: string
  category?: string
  subCategory?: string
  condition?: string
  size?: string
  color?: string
  description?: string
  originalPrice?: number
  estimatedPrice?: number
  soldPrice?: number
  measurements?: Partial<Record<MeasurementField, number>>
  imageUrls?: string[]
  sellerId?: string
  orderId?: string
  status: string
  createdAt: string
  updatedAt: string
}

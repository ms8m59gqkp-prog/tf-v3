/**
 * 네이버 스마트스토어 일괄 등록용 데이터 생성 서비스 (L1 Business Layer)
 * WHY: 상품 데이터를 네이버 스마트스토어 양식으로 변환
 * HOW: products.repo 조회 → 네이버 카테고리 매핑 → NaverExportRow 생성
 * WHERE: bulk-export-naver, [id]/naver-export API route에서 호출
 */
import * as productsRepo from '../db/repositories/products.repo'
import type { StProduct } from '../types/domain/product'
import { AppError } from '../errors'

export interface NaverExportRow {
  상품명: string
  판매가: number
  카테고리코드: string
  상품상태: string
  이미지URL: string
  상세설명: string
  옵션: string
  재고: number
  배송비: string
  반품비: string
  교환비: string
  AS정보: string
  제조사: string
  브랜드: string
  모델명: string
  원산지: string
  인증정보: string
}

/** 카테고리 → 네이버 카테고리코드 매핑 (9종) */
const CATEGORY_MAP: Record<string, string> = {
  '가방': '50000804',
  '지갑': '50000805',
  '의류': '50000803',
  '신발': '50000806',
  '시계': '50000807',
  '주얼리': '50000808',
  '액세서리': '50000809',
  '벨트': '50000810',
  '스카프': '50000811',
}

const DEFAULT_CATEGORY_CODE = '50000804'

function mapConditionToNaver(condition: string | null | undefined): string {
  if (!condition) return '중고'
  if (condition === 'N') return '새상품'
  return '중고'
}

function buildDescription(product: StProduct): string {
  const parts: string[] = []
  if (product.brand) parts.push(`브랜드: ${product.brand}`)
  if (product.category) parts.push(`카테고리: ${product.category}`)
  if (product.material) parts.push(`소재: ${product.material}`)
  if (product.color) parts.push(`색상: ${product.color}`)
  if (product.size) parts.push(`사이즈: ${product.size}`)
  if (product.productCondition) parts.push(`상태: ${product.productCondition}`)
  if (product.composition) parts.push(`구성: ${product.composition}`)
  return parts.join('\n')
}

function getMainImage(product: StProduct): string {
  if (product.photos && product.photos.length > 0) {
    const first = product.photos[0] as string | { url?: string }
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first) return first.url ?? ''
  }
  return product.referenceImage ?? ''
}

function toExportRow(product: StProduct): NaverExportRow {
  const categoryCode = product.category
    ? (CATEGORY_MAP[product.category] ?? DEFAULT_CATEGORY_CODE)
    : DEFAULT_CATEGORY_CODE

  return {
    상품명: product.productName,
    판매가: product.salePrice,
    카테고리코드: categoryCode,
    상품상태: mapConditionToNaver(product.productCondition),
    이미지URL: getMainImage(product),
    상세설명: buildDescription(product),
    옵션: '',
    재고: 1,
    배송비: '무료',
    반품비: '5000',
    교환비: '5000',
    AS정보: '판매자 문의',
    제조사: product.brand ?? '',
    브랜드: product.brand ?? '',
    모델명: product.productName,
    원산지: product.origin ?? '해외',
    인증정보: '해당없음',
  }
}

/** 단일 상품 네이버 내보내기 데이터 */
export async function getExportData(productId: string): Promise<NaverExportRow> {
  const result = await productsRepo.findById(productId)
  if (result.error !== null) {
    throw new AppError('NOT_FOUND', `상품을 찾을 수 없습니다: ${productId}`)
  }
  return toExportRow(result.data)
}

/** 복수 상품 일괄 내보내기 */
export async function bulkExport(productIds: string[]): Promise<NaverExportRow[]> {
  if (productIds.length === 0) {
    throw new AppError('VALIDATION', '상품 ID가 비어있습니다')
  }
  if (productIds.length > 200) {
    throw new AppError('VALIDATION', '한 번에 최대 200개까지 내보내기 가능합니다')
  }

  const result = await productsRepo.findByIds(productIds)
  if (result.error !== null) {
    throw new AppError('INTERNAL', `상품 조회 실패: ${result.error}`)
  }
  if (result.data.length < productIds.length) {
    const foundIds = new Set(result.data.map(p => p.id))
    const missing = productIds.filter(id => !foundIds.has(id))
    console.warn(`[naver-export] ${missing.length}건 누락:`, missing.slice(0, 5).join(', '))
  }
  return result.data.map(toExportRow)
}

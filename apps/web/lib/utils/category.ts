/**
 * 카테고리 유틸리티
 * WHY: V2 st_products.category 기반 카테고리 정규화
 * HOW: 한글/영문 매핑 + 정규화 함수
 * WHERE: 위탁 접수, 상품 등록 시 카테고리 정규화
 */

export const CATEGORIES = [
  '가방', '지갑', '시계', '주얼리', '의류', '신발', '벨트', '스카프', '선글라스', '기타',
] as const satisfies readonly string[]

export type Category = (typeof CATEGORIES)[number]

const CATEGORY_ALIASES: Record<string, string> = {
  bag: '가방', bags: '가방', handbag: '가방',
  wallet: '지갑', wallets: '지갑',
  watch: '시계', watches: '시계',
  jewelry: '주얼리', jewellery: '주얼리',
  clothing: '의류', clothes: '의류',
  shoes: '신발', shoe: '신발',
  belt: '벨트', belts: '벨트',
  scarf: '스카프', scarves: '스카프',
  sunglasses: '선글라스',
  other: '기타', others: '기타', etc: '기타',
}

export function normalizeCategory(input: string): string {
  const lower = input.trim().toLowerCase()
  if (CATEGORIES.includes(lower as Category)) return lower
  return CATEGORY_ALIASES[lower] ?? input.trim()
}

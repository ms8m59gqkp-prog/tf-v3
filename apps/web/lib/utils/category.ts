/**
 * 카테고리 추론
 * WHY: 상품명/브랜드로부터 카테고리 자동 분류
 * HOW: 키워드 매칭 기반 inferCategory
 * WHERE: 상품 등록, 엑셀 업로드
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '자켓': ['자켓', 'jacket', '블레이저', 'blazer'],
  '코트': ['코트', 'coat', '오버코트', 'overcoat'],
  '셔츠': ['셔츠', 'shirt'],
  '바지': ['바지', 'pants', 'trousers', '팬츠', '슬랙스'],
  '니트': ['니트', 'knit', 'sweater', '스웨터', '가디건', 'cardigan'],
  '가방': ['가방', 'bag', '백팩', '토트', '클러치'],
  '신발': ['신발', 'shoes', '구두', '스니커즈', 'sneakers', '로퍼', 'loafer'],
  '액세서리': [
    '넥타이', 'tie', '벨트', 'belt', '스카프', 'scarf',
    '모자', 'hat', 'cap', '워치', 'watch', '선글라스', 'sunglasses',
  ],
}

/**
 * 상품명에서 카테고리를 추론한다.
 * 키워드 매칭 기반이며, 매칭되지 않으면 '기타' 반환.
 */
export function inferCategory(productName: string): string {
  const lower = productName.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category
    }
  }
  return '기타'
}

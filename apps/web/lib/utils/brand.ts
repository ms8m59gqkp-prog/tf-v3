/**
 * 브랜드명 정규화 및 별칭 매핑
 * WHY: "에르메스" vs "Hermes" vs "HERMES" → 동일 브랜드로 인식 필요
 * HOW: BRAND_ALIAS_MAP + normalizeBrand (소문자 변환 + 별칭 해소)
 * WHERE: 상품 등록, 매칭
 */

export const BRAND_ALIAS_MAP: Record<string, string> = {
  '에르메스': 'HERMES',
  'hermes': 'HERMES',
  'hermès': 'HERMES',
  '루이비통': 'LOUIS VUITTON',
  'louis vuitton': 'LOUIS VUITTON',
  'lv': 'LOUIS VUITTON',
  '구찌': 'GUCCI',
  'gucci': 'GUCCI',
  '프라다': 'PRADA',
  'prada': 'PRADA',
  '샤넬': 'CHANEL',
  'chanel': 'CHANEL',
  '버버리': 'BURBERRY',
  'burberry': 'BURBERRY',
  '디올': 'DIOR',
  'dior': 'DIOR',
  'christian dior': 'DIOR',
  '발렌시아가': 'BALENCIAGA',
  'balenciaga': 'BALENCIAGA',
  '보테가': 'BOTTEGA VENETA',
  '보테가 베네타': 'BOTTEGA VENETA',
  'bottega veneta': 'BOTTEGA VENETA',
  '톰 브라운': 'THOM BROWNE',
  'thom browne': 'THOM BROWNE',
  '생로랑': 'SAINT LAURENT',
  'saint laurent': 'SAINT LAURENT',
  'ysl': 'SAINT LAURENT',
  '셀린느': 'CELINE',
  'celine': 'CELINE',
  'céline': 'CELINE',
  '펜디': 'FENDI',
  'fendi': 'FENDI',
  '지방시': 'GIVENCHY',
  'givenchy': 'GIVENCHY',
  '발렌티노': 'VALENTINO',
  'valentino': 'VALENTINO',
  '베르사체': 'VERSACE',
  'versace': 'VERSACE',
  '몽클레르': 'MONCLER',
  'moncler': 'MONCLER',
  '아미리': 'AMIRI',
  'amiri': 'AMIRI',
  '롤렉스': 'ROLEX',
  'rolex': 'ROLEX',
  '오메가': 'OMEGA',
  'omega': 'OMEGA',
  '마르지엘라': 'MAISON MARGIELA',
  'maison margiela': 'MAISON MARGIELA',
  '릭 오웬스': 'RICK OWENS',
  'rick owens': 'RICK OWENS',
  '로에베': 'LOEWE',
  'loewe': 'LOEWE',
}

/**
 * 브랜드명을 정규화한다.
 * 별칭 맵에 있으면 정규 이름 반환, 없으면 대문자 변환.
 */
export function normalizeBrand(brand: string): string {
  const lower = brand.trim().toLowerCase()
  return BRAND_ALIAS_MAP[lower] ?? brand.trim().toUpperCase()
}

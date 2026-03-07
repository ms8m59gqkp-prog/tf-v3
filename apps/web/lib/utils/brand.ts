/**
 * 브랜드 별칭 매핑
 * WHY: V2 brand_aliases 43개 + V3 추가 16개 = 59개 병합
 * HOW: 정규화된 이름으로 매핑 (대소문자 무시)
 * WHERE: 위탁 접수, 상품 등록 시 브랜드 정규화
 */

export const BRAND_ALIASES: Record<string, string> = {
  // V2 원본 43개
  '루이비통': 'LOUIS VUITTON', 'louis vuitton': 'LOUIS VUITTON', 'lv': 'LOUIS VUITTON',
  '샤넬': 'CHANEL', 'chanel': 'CHANEL',
  '에르메스': 'HERMES', 'hermes': 'HERMES', 'hermès': 'HERMES',
  '구찌': 'GUCCI', 'gucci': 'GUCCI',
  '프라다': 'PRADA', 'prada': 'PRADA',
  '발렌시아가': 'BALENCIAGA', 'balenciaga': 'BALENCIAGA',
  '디올': 'DIOR', 'dior': 'DIOR', 'christian dior': 'DIOR',
  '셀린느': 'CELINE', 'celine': 'CELINE', 'céline': 'CELINE',
  '보테가베네타': 'BOTTEGA VENETA', 'bottega veneta': 'BOTTEGA VENETA', 'bottega': 'BOTTEGA VENETA',
  '버버리': 'BURBERRY', 'burberry': 'BURBERRY',
  '펜디': 'FENDI', 'fendi': 'FENDI',
  '생로랑': 'SAINT LAURENT', 'saint laurent': 'SAINT LAURENT', 'ysl': 'SAINT LAURENT',
  '지방시': 'GIVENCHY', 'givenchy': 'GIVENCHY',
  '발렌티노': 'VALENTINO', 'valentino': 'VALENTINO',
  '톰브라운': 'THOM BROWNE', 'thom browne': 'THOM BROWNE',
  '롤렉스': 'ROLEX', 'rolex': 'ROLEX',
  '오메가': 'OMEGA', 'omega': 'OMEGA',
  // V3 추가 16개
  '미우미우': 'MIU MIU', 'miu miu': 'MIU MIU',
  '로에베': 'LOEWE', 'loewe': 'LOEWE',
  '막스마라': 'MAX MARA', 'max mara': 'MAX MARA',
  '몽클레르': 'MONCLER', 'moncler': 'MONCLER',
  '골든구스': 'GOLDEN GOOSE', 'golden goose': 'GOLDEN GOOSE',
  '메종마르지엘라': 'MAISON MARGIELA', 'maison margiela': 'MAISON MARGIELA',
  '아미': 'AMI', 'ami': 'AMI', 'ami paris': 'AMI',
  '아크네': 'ACNE STUDIOS', 'acne studios': 'ACNE STUDIOS',
}

export function normalizeBrand(input: string): string {
  const lower = input.trim().toLowerCase()
  return BRAND_ALIASES[lower] ?? input.trim()
}

export function isKnownBrand(input: string): boolean {
  const lower = input.trim().toLowerCase()
  return lower in BRAND_ALIASES
}

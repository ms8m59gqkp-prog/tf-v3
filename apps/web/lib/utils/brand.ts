/**
 * 브랜드명 정규화 및 별칭 매핑 — V2 43개 클래식 + V3 16개 럭셔리 = 59개 정규 브랜드
 * WHY: V2 4곳 분산 브랜드맵(brand-aliases, brand-search, scoreCalculator, product-matcher) 통합
 * HOW: BRAND_ALIAS_MAP (별칭→정규명) + normalizeBrand (소문자 변환 + 별칭 해소)
 * WHERE: 상품 등록, 매칭, 정산
 */

export const BRAND_ALIAS_MAP: Record<string, string> = {
  // ── V2 클래식 남성복 (43개 정규명) ──────────────────────────────

  // Drake's
  '드레이크스': "DRAKE'S",
  '드레익스': "DRAKE'S",
  'drakes': "DRAKE'S",
  "drake's": "DRAKE'S",

  // Ralph Lauren
  '랄프로렌': 'RALPH LAUREN',
  '랄프 로렌': 'RALPH LAUREN',
  'ralph lauren': 'RALPH LAUREN',
  'polo ralph lauren': 'RALPH LAUREN',

  // Engineered Garments
  '엔지니어드가먼츠': 'ENGINEERED GARMENTS',
  '엔지니어드 가먼츠': 'ENGINEERED GARMENTS',
  'engineered garments': 'ENGINEERED GARMENTS',
  'eg': 'ENGINEERED GARMENTS',

  // Alden
  '올든': 'ALDEN',
  '알덴': 'ALDEN',
  'alden': 'ALDEN',

  // Brooks Brothers
  '브룩스브라더스': 'BROOKS BROTHERS',
  '브룩스 브라더스': 'BROOKS BROTHERS',
  'brooks brothers': 'BROOKS BROTHERS',

  // J.Press
  '제이프레스': 'J.PRESS',
  '제이 프레스': 'J.PRESS',
  'j.press': 'J.PRESS',
  'j press': 'J.PRESS',
  'jpress': 'J.PRESS',

  // Beams
  '빔즈': 'BEAMS',
  'beams': 'BEAMS',

  // United Arrows
  '유나이티드아로우즈': 'UNITED ARROWS',
  '유나이티드 애로우즈': 'UNITED ARROWS',
  'united arrows': 'UNITED ARROWS',

  // Barbour
  '바버': 'BARBOUR',
  'barbour': 'BARBOUR',

  // Paraboot
  '파라부트': 'PARABOOT',
  'paraboot': 'PARABOOT',

  // Church's
  '처치스': "CHURCH'S",
  '처치': "CHURCH'S",
  "church's": "CHURCH'S",
  'churchs': "CHURCH'S",

  // Crockett & Jones
  '크로켓앤존스': 'CROCKETT & JONES',
  '크로켓 앤 존스': 'CROCKETT & JONES',
  'crockett & jones': 'CROCKETT & JONES',
  'crockett and jones': 'CROCKETT & JONES',

  // John Lobb
  '존롭': 'JOHN LOBB',
  '존 로브': 'JOHN LOBB',
  '존로브': 'JOHN LOBB',
  'john lobb': 'JOHN LOBB',

  // Edward Green
  '에드워드그린': 'EDWARD GREEN',
  '에드워드 그린': 'EDWARD GREEN',
  'edward green': 'EDWARD GREEN',

  // Lardini
  '라르디니': 'LARDINI',
  'lardini': 'LARDINI',

  // Brunello Cucinelli
  '브루넬로쿠치넬리': 'BRUNELLO CUCINELLI',
  '브루넬로 쿠치넬리': 'BRUNELLO CUCINELLI',
  '쿠치넬리': 'BRUNELLO CUCINELLI',
  'brunello cucinelli': 'BRUNELLO CUCINELLI',

  // Isaia
  '이자이아': 'ISAIA',
  '이사이아': 'ISAIA',
  'isaia': 'ISAIA',

  // Boglioli
  '볼리올리': 'BOGLIOLI',
  '보리올리': 'BOGLIOLI',
  'boglioli': 'BOGLIOLI',

  // Ring Jacket
  '링자켓': 'RING JACKET',
  '링재킷': 'RING JACKET',
  '링 재킷': 'RING JACKET',
  'ring jacket': 'RING JACKET',

  // Carmina
  '카르미나': 'CARMINA',
  'carmina': 'CARMINA',

  // Berwick
  '버윅': 'BERWICK',
  'berwick': 'BERWICK',

  // Neil Barrett
  '닐바렛': 'NEIL BARRETT',
  'neil barrett': 'NEIL BARRETT',

  // Anatomica
  '아나토미카': 'ANATOMICA',
  'anatomica': 'ANATOMICA',

  // Pierre Balmain
  '피에르발망': 'PIERRE BALMAIN',
  '발망': 'PIERRE BALMAIN',
  'pierre balmain': 'PIERRE BALMAIN',
  'balmain': 'PIERRE BALMAIN',

  // BRCM
  '비알씨엠': 'BRCM',
  'brcm': 'BRCM',

  // Kenzo
  '켄조': 'KENZO',
  'kenzo': 'KENZO',

  // Loro Piana
  '로로피아나': 'LORO PIANA',
  '로로 피아나': 'LORO PIANA',
  'loro piana': 'LORO PIANA',

  // Kiton
  '키톤': 'KITON',
  'kiton': 'KITON',

  // Brioni
  '브리오니': 'BRIONI',
  'brioni': 'BRIONI',

  // Tom Ford
  '톰포드': 'TOM FORD',
  'tom ford': 'TOM FORD',

  // Zegna
  '제냐': 'ZEGNA',
  'zegna': 'ZEGNA',
  'ermenegildo zegna': 'ZEGNA',

  // Ferragamo
  '페라가모': 'FERRAGAMO',
  'ferragamo': 'FERRAGAMO',
  'salvatore ferragamo': 'FERRAGAMO',

  // Canada Goose
  '캐나다구스': 'CANADA GOOSE',
  'canada goose': 'CANADA GOOSE',

  // Stone Island
  '스톤아일랜드': 'STONE ISLAND',
  'stone island': 'STONE ISLAND',

  // The North Face
  '노스페이스': 'THE NORTH FACE',
  'the north face': 'THE NORTH FACE',
  'tnf': 'THE NORTH FACE',

  // Patagonia
  '파타고니아': 'PATAGONIA',
  'patagonia': 'PATAGONIA',

  // ── V2+V3 공통 (7개, V2 brand-aliases.ts에도 존재) ────────────

  // Hermes
  '에르메스': 'HERMES',
  'hermes': 'HERMES',
  'hermès': 'HERMES',

  // Gucci
  '구찌': 'GUCCI',
  'gucci': 'GUCCI',

  // Prada
  '프라다': 'PRADA',
  'prada': 'PRADA',

  // Burberry
  '버버리': 'BURBERRY',
  'burberry': 'BURBERRY',

  // Saint Laurent
  '생로랑': 'SAINT LAURENT',
  'saint laurent': 'SAINT LAURENT',
  'ysl': 'SAINT LAURENT',

  // Bottega Veneta
  '보테가': 'BOTTEGA VENETA',
  '보테가 베네타': 'BOTTEGA VENETA',
  '보테가베네타': 'BOTTEGA VENETA',
  'bottega veneta': 'BOTTEGA VENETA',

  // Moncler
  '몽클레르': 'MONCLER',
  'moncler': 'MONCLER',

  // ── V3 고유 럭셔리 (16개) ──────────────────────────────────────

  // Louis Vuitton
  '루이비통': 'LOUIS VUITTON',
  'louis vuitton': 'LOUIS VUITTON',
  'lv': 'LOUIS VUITTON',

  // Chanel
  '샤넬': 'CHANEL',
  'chanel': 'CHANEL',

  // Dior
  '디올': 'DIOR',
  'dior': 'DIOR',
  'christian dior': 'DIOR',

  // Balenciaga
  '발렌시아가': 'BALENCIAGA',
  'balenciaga': 'BALENCIAGA',

  // Thom Browne
  '톰 브라운': 'THOM BROWNE',
  'thom browne': 'THOM BROWNE',

  // Celine
  '셀린느': 'CELINE',
  'celine': 'CELINE',
  'céline': 'CELINE',

  // Fendi
  '펜디': 'FENDI',
  'fendi': 'FENDI',

  // Givenchy
  '지방시': 'GIVENCHY',
  'givenchy': 'GIVENCHY',

  // Valentino
  '발렌티노': 'VALENTINO',
  'valentino': 'VALENTINO',

  // Versace
  '베르사체': 'VERSACE',
  'versace': 'VERSACE',

  // Amiri
  '아미리': 'AMIRI',
  'amiri': 'AMIRI',

  // Rolex
  '롤렉스': 'ROLEX',
  'rolex': 'ROLEX',

  // Omega
  '오메가': 'OMEGA',
  'omega': 'OMEGA',

  // Maison Margiela
  '마르지엘라': 'MAISON MARGIELA',
  'maison margiela': 'MAISON MARGIELA',

  // Rick Owens
  '릭 오웬스': 'RICK OWENS',
  'rick owens': 'RICK OWENS',

  // Loewe
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

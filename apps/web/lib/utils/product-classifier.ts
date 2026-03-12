/**
 * 상품코드 파싱 + 위탁 분류
 * WHY: V2 product-classifier.ts 재현 — "위탁." prefix 기반 위탁 상품 식별
 * HOW: 순수 문자열 파싱, DB/HTTP 미사용
 * WHERE: consignment.service.ts, sales.service.ts에서 import
 */

const CONSIGNMENT_PREFIX = '위탁.'

export interface ClassifiedProduct {
  original: string
  isConsignment: boolean
  sellerName: string | null
  productName: string | null
}

/** "위탁.홍길동.라르디니 코트" → { isConsignment: true, sellerName: "홍길동", productName: "라르디니 코트" } */
export function classifyProduct(code: string): ClassifiedProduct {
  const trimmed = code.trim()
  if (!trimmed.startsWith(CONSIGNMENT_PREFIX)) {
    return { original: trimmed, isConsignment: false, sellerName: null, productName: null }
  }
  const rest = trimmed.slice(CONSIGNMENT_PREFIX.length)
  const dotIdx = rest.indexOf('.')
  if (dotIdx === -1) {
    return { original: trimmed, isConsignment: true, sellerName: rest || null, productName: null }
  }
  const sellerName = rest.slice(0, dotIdx).trim() || null
  const productName = rest.slice(dotIdx + 1).trim() || null
  return { original: trimmed, isConsignment: true, sellerName, productName }
}

export function isConsignmentCode(code: string): boolean {
  return code.trim().startsWith(CONSIGNMENT_PREFIX)
}

export function filterConsignmentCodes(codes: string[]): ClassifiedProduct[] {
  return codes.map(classifyProduct).filter(c => c.isConsignment)
}

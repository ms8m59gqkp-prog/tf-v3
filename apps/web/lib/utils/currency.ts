/**
 * 한국 원화 포맷/파싱
 * WHY: 금액 표시 일관성 + 엑셀 파싱 시 쉼표 제거
 * HOW: formatKRW (숫자→쉼표+원), parseKRW (문자열→숫자)
 * WHERE: 정산, 주문, 프론트엔드
 */

/**
 * 숫자를 한국 원화 포맷으로 변환
 * 1234567 → "1,234,567원"
 */
export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/**
 * 원화 포맷 문자열을 숫자로 파싱
 * "1,234,567원" → 1234567
 */
export function parseKRW(formatted: string): number {
  const cleaned = formatted.replace(/[^\d.-]/g, '')
  if (cleaned === '') {
    throw new Error(`금액 파싱 실패: ${formatted}`)
  }
  const num = Number(cleaned)
  if (isNaN(num)) {
    throw new Error(`금액 파싱 실패: ${formatted}`)
  }
  return num
}

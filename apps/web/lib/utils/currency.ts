/**
 * 통화 포맷 유틸리티
 * WHY: V2 DB는 integer 원화 저장, UI는 포맷된 문자열 필요
 * HOW: Intl.NumberFormat 사용
 * WHERE: 가격 표시하는 모든 UI에서 사용
 */

const formatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

export function formatCurrency(amount: number): string {
  return formatter.format(amount)
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount)
}

export function parseCurrency(text: string): number {
  const digits = text.replace(/[^\d-]/g, '')
  return parseInt(digits, 10) || 0
}

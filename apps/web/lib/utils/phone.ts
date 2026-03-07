/**
 * 전화번호 포맷 유틸리티
 * WHY: V2 DB는 숫자만 저장, UI는 하이픈 포맷 필요
 * HOW: 숫자 추출 → 010-XXXX-XXXX 포맷
 * WHERE: 판매자/주문 표시, SMS 발송에서 사용
 */

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone)
  return /^01[016789]\d{7,8}$/.test(digits)
}

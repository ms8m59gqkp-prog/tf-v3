/**
 * 한국 전화번호 정규화/포맷/검증
 * WHY: V2 하이픈 유무 혼용 → 판매자 매칭 실패
 * HOW: normalizePhone (숫자만 추출+정규화), formatPhone (표시용 하이픈)
 * WHERE: 판매자/주문 생성, SMS 발송
 */

const KOREAN_PHONE_REGEX = /^01[016789]\d{7,8}$/

/**
 * 전화번호에서 숫자만 추출하여 정규화
 * "010-1234-5678" → "01012345678"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!KOREAN_PHONE_REGEX.test(digits)) {
    throw new Error(`유효하지 않은 전화번호: ${phone}`)
  }
  return digits
}

/**
 * 정규화된 전화번호를 하이픈 포맷으로 변환
 * "01012345678" → "010-1234-5678"
 */
export function formatPhone(phone: string): string {
  const digits = normalizePhone(phone)
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  // 10자리 (010XXXXXXX 형태)
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * 한국 전화번호 유효성 검사
 */
export function isValidKoreanPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return KOREAN_PHONE_REGEX.test(digits)
}

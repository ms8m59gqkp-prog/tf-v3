/**
 * 날짜 유틸리티 (UTC-only 원칙)
 * WHY: V2 KST/UTC 혼용 → 정산 기간 하루 오차 (DAT-02)
 * HOW: 저장은 UTC, 표시는 KST 변환 (Intl.DateTimeFormat 사용)
 * WHERE: 정산 기간, 주문일, 위탁일 처리
 */

const KST_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const KST_DATETIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * UTC ISO 문자열 → "YYYY-MM-DD" (KST)
 */
export function toKSTDate(utcIso: string): string {
  const parts = KST_DATE_FORMATTER.formatToParts(new Date(utcIso))
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

/**
 * UTC ISO 문자열 → "YYYY-MM-DD HH:mm" (KST)
 */
export function toKSTDateTime(utcIso: string): string {
  const parts = KST_DATETIME_FORMATTER.formatToParts(new Date(utcIso))
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  const h = parts.find((p) => p.type === 'hour')?.value
  const min = parts.find((p) => p.type === 'minute')?.value
  return `${y}-${m}-${d} ${h}:${min}`
}

/**
 * 날짜 범위를 표시용 문자열로 포맷
 */
export function formatDateRange(start: string, end: string): string {
  return `${start} ~ ${end}`
}

/**
 * YYYY-MM-DD 형식인지 검사
 */
export function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}

/**
 * "YYYY-MM-DD" → 해당 날짜 UTC 자정 (00:00:00.000Z)
 */
export function toStartOfDay(dateStr: string): Date {
  if (!isValidDateString(dateStr)) {
    throw new Error(`유효하지 않은 날짜 형식: ${dateStr}`)
  }
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/**
 * "YYYY-MM-DD" → 해당 날짜 UTC 끝 (23:59:59.999Z)
 */
export function toEndOfDay(dateStr: string): Date {
  if (!isValidDateString(dateStr)) {
    throw new Error(`유효하지 않은 날짜 형식: ${dateStr}`)
  }
  return new Date(`${dateStr}T23:59:59.999Z`)
}

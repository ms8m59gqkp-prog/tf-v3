/**
 * 날짜 포맷 유틸리티
 * WHY: V2 DB는 date/timestamptz 저장, UI는 다양한 포맷 필요
 * HOW: Date 파싱 → 포맷 변환
 * WHERE: 날짜 표시하는 모든 UI에서 사용
 */

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const dateStr = formatDate(d)
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dateStr} ${h}:${min}`
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 30) return `${diffDay}일 전`
  return formatDate(d)
}

export function toDateString(date: Date): string {
  return formatDate(date)
}

export function isValidDate(value: string): boolean {
  const d = new Date(value)
  return !isNaN(d.getTime())
}

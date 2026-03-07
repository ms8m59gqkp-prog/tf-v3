/**
 * ID/번호 생성 유틸리티
 * WHY: V2 generate_order_number() 클라이언트 사이드 재현
 * HOW: YYYYMMDD-XXXXXX (날짜 + 6자리 랜덤 숫자)
 * WHERE: 주문 생성 시 사용 (상품번호/셀러코드는 DB RPC 대체)
 */
import crypto from 'crypto'

export function generateOrderNumber(date?: Date): string {
  const d = date ?? new Date()
  const prefix = d.toISOString().slice(0, 10).replace(/-/g, '')
  const num = crypto.randomInt(0, 1000000)
  const suffix = String(num).padStart(6, '0')
  return `${prefix}-${suffix}`
}

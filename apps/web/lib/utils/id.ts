/**
 * 주문번호/상품번호 생성
 * WHY: V2에서 2곳 중복 정의 + Math.random 사용
 * HOW: YYYYMMDD + 6자리 랜덤 (crypto.randomInt 사용)
 * WHERE: 주문 생성, 위탁 완료 시
 */
import { randomInt } from 'crypto'

/**
 * 주문번호 생성: ORD-YYYYMMDD-XXXXXX
 */
export function generateOrderNumber(date?: Date): string {
  const d = date ?? new Date()
  const prefix = d.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = String(randomInt(100000, 999999))
  return `ORD-${prefix}-${suffix}`
}

/**
 * 상품번호 생성: PRD-YYYYMMDD-XXXXXX
 */
export function generateProductNumber(date?: Date): string {
  const d = date ?? new Date()
  const prefix = d.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = String(randomInt(100000, 999999))
  return `PRD-${prefix}-${suffix}`
}

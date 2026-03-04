/**
 * 주문번호/상품번호 생성 — V2 형식 계승
 * WHY: V2에서 2곳 중복 정의 + Math.random 사용
 * HOW: YYYYMMDD + 랜덤 (crypto.randomInt 사용, V2 보안 취약점 개선)
 * WHERE: 주문 생성, 위탁 완료 시
 */
import { randomInt } from 'crypto'

/**
 * 주문번호 생성: YYYYMMDD-XXXXXX (6자리 숫자)
 * V2 형식: 20260304-482917
 */
export function generateOrderNumber(date?: Date): string {
  const d = date ?? new Date()
  const prefix = d.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = String(randomInt(100000, 999999))
  return `${prefix}-${suffix}`
}

/**
 * 상품번호 생성 (직접접수): YYYYMMDD-AAAAAA (6자리 대문자 알파벳)
 * V2 형식: 20260304-TKBMXF
 * 위탁 상품번호는 DB RPC generate_product_number() 사용 (CT-{SELLER_CODE}-{SEQ:3})
 */
export function generateProductNumber(date?: Date): string {
  const d = date ?? new Date()
  const prefix = d.toISOString().slice(0, 10).replace(/-/g, '')
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const suffix = Array.from({ length: 6 }, () =>
    chars[randomInt(0, 26)]
  ).join('')
  return `${prefix}-${suffix}`
}

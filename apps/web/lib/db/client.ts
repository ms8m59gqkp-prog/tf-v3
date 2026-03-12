/**
 * Supabase 쿼리 래퍼
 * WHY: 에러 핸들링 + snake_case→camelCase 매핑 일원화
 * HOW: createAdminClient() 래핑 + toCamelCase 재귀 변환
 * WHERE: apps/web/lib/db/repositories/*.repo.ts에서 import
 */
import { createAdminClient } from '../supabase/admin'

/** 모든 리포지토리가 사용하는 DB 클라이언트 */
export function getClient() {
  return createAdminClient()
}

/**
 * snake_case 키를 camelCase로 변환
 * - JSONB 필드(measurements, photos, failed_ids 등)는 그대로 전달 (내부 구조 변환 안 함)
 * - NUMERIC 필드(commission_rate 등)는 mapRow에서 Number() 변환 (여기선 미처리)
 * - 중첩 객체/배열은 재귀 처리하되, JSONB 도메인 데이터는 mapRow 책임
 */
export function toCamelCase(
  row: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) =>
      c.toUpperCase()
    )
    const value = row[key]

    if (Array.isArray(value)) {
      // PostgREST JOIN 결과 배열 (예: order_items, settlement_items)
      result[camelKey] = value.map((item) =>
        isPlainObject(item) ? toCamelCase(item as Record<string, unknown>) : item
      )
    } else if (isPlainObject(value)) {
      // PostgREST FK 단일 JOIN (예: sellers, st_products)
      result[camelKey] = toCamelCase(value as Record<string, unknown>)
    } else {
      result[camelKey] = value
    }
  }

  return result
}

/** null/Date/배열이 아닌 순수 객체인지 판별 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  )
}

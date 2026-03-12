/**
 * 공용 Zod 검증 스키마
 * WHY: 여러 도메인에서 공통 사용하는 검증 규칙 중앙화
 * HOW: Zod 스키마 정의 (phone, sellerCode, productNumber, orderId, price, UUID, page 등)
 * WHERE: API 라우트 schema.ts, 폼 검증에서 import
 */
import { z } from 'zod'

// ─── 도메인 스키마 ───

export const phoneSchema = z
  .string()
  .regex(/^01[016789]\d{7,8}$/, '올바른 전화번호 형식이 아닙니다 (예: 01012345678)')

export const sellerCodeSchema = z
  .string()
  .regex(/^\d{5}$/, '셀러코드는 5자리 숫자여야 합니다')

export const productNumberSchema = z
  .string()
  .regex(/^\d{13}$/, '상품번호는 13자리 숫자여야 합니다')

export const orderIdSchema = z
  .string()
  .regex(/^\d{8}-\d{6}$/, '주문번호 형식이 올바르지 않습니다 (예: 20260304-000042)')

export const priceSchema = z
  .number()
  .int('가격은 정수여야 합니다')
  .nonnegative('가격은 0 이상이어야 합니다')

// ─── Phase 5 공용 스키마 (P0-4: 동적 세그먼트 Zod 검증 표준) ───

/** UUID v4 검증 — [id], [itemId], [productId], [sessionId] 등 동적 세그먼트용 */
export const uuidSchema = z
  .string()
  .uuid('유효한 UUID 형식이 아닙니다')

/** 토큰 검증 — [token] 동적 세그먼트용 (adjustment_token, hold_token) */
export const tokenSchema = z
  .string()
  .min(32, '유효하지 않은 토큰 형식입니다')
  .max(255, '토큰이 너무 깁니다')
  .regex(/^[a-zA-Z0-9_\-]+$/, '유효하지 않은 토큰 형식입니다')

/** 날짜 문자열 검증 — YYYY-MM-DD 형식 + 유효 범위 (2월 30일 등 자동 보정 방어) */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다 (예: 2026-01-15)')
  .refine((s) => {
    const d = new Date(s + 'T00:00:00')
    if (isNaN(d.getTime())) return false
    const [y, m, day] = s.split('-').map(Number)
    return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day
  }, '유효하지 않은 날짜입니다')

/** 페이지네이션 검증 — 라우트 쿼리파라미터용 */
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** 쿼리파라미터에서 안전한 페이지네이션 값 추출 (NaN/음수/초과 방어) */
export function safePage(url: URL): { page: number; pageSize: number } {
  const raw = {
    page: url.searchParams.get('page') ?? '1',
    pageSize: url.searchParams.get('pageSize') ?? '20',
  }
  const parsed = pageSchema.safeParse(raw)
  return parsed.success ? parsed.data : { page: 1, pageSize: 20 }
}

/**
 * 공용 Zod 스키마 5개만 정의
 * WHY: 라우트별 스키마는 라우트 옆에 co-locate (연쇄 변경 방지)
 * HOW: 여러 라우트에서 공통으로 사용하는 원자적 스키마만
 * WHERE: Phase 5 라우트에서 import
 */
import { z } from 'zod'

export const PhoneSchema = z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/)

export const UuidSchema = z.string().uuid()

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const PositiveAmountSchema = z.number().positive()

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

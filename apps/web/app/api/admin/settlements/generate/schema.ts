/**
 * POST /api/admin/settlements/generate — 정산 생성 스키마
 * WHY: 기간 파라미터 검증 (YYYY-MM-DD 형식 필수)
 * HOW: dateSchema 기반 Zod 검증
 * WHERE: generate/route.ts에서 import
 */
import { z } from 'zod'
import { dateSchema } from '@/lib/utils/validation'

/** 정산 생성 가능 최대 기간 (일) — 주 1회 정산, ±5일 여유 */
const MAX_PERIOD_DAYS = 12

export const GenerateSettlementSchema = z.object({
  periodStart: dateSchema,
  periodEnd: dateSchema,
}).refine(
  (data) => data.periodStart <= data.periodEnd,
  { message: '시작일이 종료일보다 클 수 없습니다', path: ['periodEnd'] },
).refine(
  (data) => {
    const diffMs = new Date(data.periodEnd).getTime() - new Date(data.periodStart).getTime()
    return diffMs <= MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000
  },
  { message: `정산 기간은 최대 ${MAX_PERIOD_DAYS}일을 초과할 수 없습니다`, path: ['periodEnd'] },
).refine(
  (data) => {
    const end = new Date(data.periodEnd)
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(now.getFullYear() - 1)
    return new Date(data.periodStart) >= oneYearAgo && end <= now
  },
  { message: '정산 기간은 최근 1년 이내여야 하며 미래 날짜는 불가합니다', path: ['periodStart'] },
)

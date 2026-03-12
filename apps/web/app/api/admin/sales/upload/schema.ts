/**
 * POST /api/admin/sales/upload — 매출대장 업로드 스키마
 * WHY: rows 배열 + sessionId 검증
 * HOW: Record 배열 최대 5000행 + UUID sessionId
 * WHERE: upload/route.ts에서 import
 */
import { z } from 'zod'

export const SalesUploadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, '데이터가 비어있습니다').max(5000),
  sessionId: z.string().uuid('유효한 세션 ID가 아닙니다'),
})

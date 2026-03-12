/**
 * POST /api/admin/sales/naver/upload — 네이버 정산 업로드 스키마
 * WHY: rows 배열 + batchId 검증
 * HOW: Record 배열 최대 5000행 + UUID batchId
 * WHERE: upload/route.ts에서 import
 */
import { z } from 'zod'

export const NaverUploadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, '데이터가 비어있습니다').max(5000),
  batchId: z.string().uuid('유효한 배치 ID가 아닙니다'),
})

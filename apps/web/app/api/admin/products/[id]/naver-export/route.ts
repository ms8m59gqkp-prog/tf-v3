/**
 * GET /api/admin/products/[id]/naver-export — 단일 상품 네이버 내보내기
 * WHY: 개별 상품의 네이버 스마트스토어 등록 데이터 조회
 * HOW: withAdmin → UUID 검증 → naver-export.service → ok/errFrom
 * WHERE: 상품 상세 화면 네이버 내보내기 버튼
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { uuidSchema } from '@/lib/utils/validation'
import * as naverExportService from '@/lib/services/naver-export.service'

export const GET = withAdmin(async (
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await ctx.params
    const parsed = uuidSchema.safeParse(id)
    if (!parsed.success) return validationErr('유효한 상품 ID가 아닙니다')

    const row = await naverExportService.getExportData(parsed.data)
    return ok(row)
  } catch (e) { return errFrom(e) }
})

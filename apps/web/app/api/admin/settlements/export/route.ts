/**
 * POST /api/admin/settlements/export — 정산 엑셀 다운로드
 * WHY: 관리자가 정산 상세를 엑셀로 내려받기
 * HOW: withAdmin → Zod → exportToExcel → 바이너리 응답
 * WHERE: 정산 상세 페이지 엑셀 내보내기 버튼
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { errFrom, validationErr } from '@/lib/api/response'
import { ExportSettlementSchema } from './schema'
import * as exportService from '@/lib/services/settlement-export.service'

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = ExportSettlementSchema.safeParse(body)
    if (!parsed.success) {
      return validationErr(parsed.error.issues[0]?.message ?? '입력값 오류')
    }

    const { fileName, buffer } = await exportService.exportToExcel(
      parsed.data.settlementId,
    )

    const uint8 = new Uint8Array(buffer)
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    })
  } catch (e) { return errFrom(e) }
})

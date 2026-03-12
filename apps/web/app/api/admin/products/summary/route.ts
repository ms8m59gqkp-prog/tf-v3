/**
 * GET /api/admin/products/summary — 상품 요약 통계
 * WHY: 대시보드용 상품 집계 데이터
 * HOW: withAdmin → product.getSummary → ok
 * WHERE: admin/dashboard 또는 products 페이지 상단
 */
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom } from '@/lib/api/response'
import * as productService from '@/lib/services/product.service'

export const GET = withAdmin(async () => {
  try {
    const result = await productService.getSummary()
    return ok(result)
  } catch (e) { return errFrom(e) }
})

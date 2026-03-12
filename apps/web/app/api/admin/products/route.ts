/**
 * GET /api/admin/products — 상품 목록 조회
 * POST /api/admin/products — 상품 등록
 * WHY: 상품 관리 메인 목록 + 등록
 * HOW: withAdmin → 필터/Zod → product.list/create → ok
 * WHERE: admin/products 페이지
 */
import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { ok, errFrom, validationErr } from '@/lib/api/response'
import { safePage } from '@/lib/utils/validation'
import { CreateProductSchema } from './schema'
import * as productService from '@/lib/services/product.service'

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = req.nextUrl
    const { page, pageSize } = safePage(url)
    const sellerId = url.searchParams.get('sellerId') ?? undefined
    const brand = url.searchParams.get('brand') ?? undefined
    const search = url.searchParams.get('search') ?? undefined
    const isActive = url.searchParams.get('isActive')
    const filters = {
      sellerId, brand, search,
      ...(isActive !== null ? { isActive: isActive === 'true' } : {}),
    }

    const result = await productService.list(filters, { page, pageSize })
    return ok(result)
  } catch (e) { return errFrom(e) }
})

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = CreateProductSchema.safeParse(body)
    if (!parsed.success) return validationErr(parsed.error.issues[0].message)

    const result = await productService.create(parsed.data)
    return ok(result)
  } catch (e) { return errFrom(e) }
})
